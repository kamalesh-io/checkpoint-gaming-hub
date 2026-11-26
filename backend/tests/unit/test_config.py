"""Unit tests for application configuration and secrets handling."""

from pathlib import Path
from app.core.config import Settings, settings


def test_config_defaults():
    """Verify application default configuration."""
    assert "CHECKPOINT" in settings.APP_NAME.upper()
    assert "sqlite+aiosqlite" in settings.get_database_url()
    assert settings.HOST in ("127.0.0.1", "localhost")
    assert settings.PORT in (8765, 8000)


def test_secrets_redaction():
    """Ensure secret credentials are not exposed in plaintext string representation."""
    repr_str = repr(settings)
    if settings.IGDB_CLIENT_SECRET:
        secret_plain = settings.IGDB_CLIENT_SECRET.get_secret_value()
        if len(secret_plain) > 5:
            assert secret_plain not in repr_str
            
    if settings.STEAMGRIDDB_API_KEY:
        key_plain = settings.STEAMGRIDDB_API_KEY.get_secret_value()
        if len(key_plain) > 5:
            assert key_plain not in repr_str


def test_ensure_directories(tmp_path: Path):
    """Verify directory creation logic handles nested paths without errors."""
    test_settings = Settings(
        APP_ENV="testing",
        DATA_DIR=tmp_path / "CheckpointTest",
        ARTWORK_CACHE_DIR=tmp_path / "CheckpointTest" / "cache",
    )
    test_settings.ensure_directories()
    
    assert test_settings.DATA_DIR.exists()
    assert test_settings.ARTWORK_CACHE_DIR.exists()
    assert (test_settings.ARTWORK_CACHE_DIR / "covers").exists()
    assert (test_settings.ARTWORK_CACHE_DIR / "heroes").exists()
    assert (test_settings.ARTWORK_CACHE_DIR / "logos").exists()


def test_credentials_persistence_in_custom_data_dir(tmp_path: Path, monkeypatch):
    """Verify credentials.json is encrypted with Windows DPAPI and supports transparent plaintext migration."""
    import json
    from app.core.config import get_credentials_path, read_saved_credentials

    custom_dir = tmp_path / "CheckpointAppData"
    custom_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("CHECKPOINT_DATA_DIR", str(custom_dir))

    cred_path = get_credentials_path()
    assert cred_path == custom_dir / "credentials.json"

    isolated_settings = Settings(APP_ENV="testing")
    isolated_settings.update_credentials(
        igdb_id="test_client_id",
        igdb_secret="test_client_secret",
        sgdb_key="test_sgdb_key",
    )

    assert cred_path.exists()
    raw_disk_text = cred_path.read_text(encoding="utf-8")
    raw_disk_json = json.loads(raw_disk_text)
    assert raw_disk_json["format"] == "dpapi-v1"
    assert "payload" in raw_disk_json
    # Plaintext secrets must NEVER be present on disk
    assert "test_client_id" not in raw_disk_text
    assert "test_client_secret" not in raw_disk_text
    assert "test_sgdb_key" not in raw_disk_text

    loaded = read_saved_credentials()
    assert loaded["igdb_client_id"] == "test_client_id"
    assert loaded["igdb_client_secret"] == "test_client_secret"
    assert loaded["steamgriddb_api_key"] == "test_sgdb_key"
    assert isolated_settings.get_igdb_client_id() == "test_client_id"
    assert isolated_settings.get_igdb_client_secret() == "test_client_secret"
    assert isolated_settings.STEAMGRIDDB_API_KEY is not None
    assert isolated_settings.STEAMGRIDDB_API_KEY.get_secret_value() == "test_sgdb_key"

    # Legacy plaintext migration preserves all credentials cleanly while encrypting in place
    legacy_path = tmp_path / "LegacyAppData"
    legacy_path.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("CHECKPOINT_DATA_DIR", str(legacy_path))
    legacy_cred = get_credentials_path()
    legacy_cred.write_text(
        json.dumps({
            "igdb_client_id": "legacy_id_val",
            "igdb_client_secret": "legacy_secret_val",
            "steamgriddb_api_key": "legacy_sgdb_val",
        }),
        encoding="utf-8",
    )
    migrated = read_saved_credentials()
    assert migrated == {
        "igdb_client_id": "legacy_id_val",
        "igdb_client_secret": "legacy_secret_val",
        "steamgriddb_api_key": "legacy_sgdb_val",
    }
    after_disk = json.loads(legacy_cred.read_text(encoding="utf-8"))
    assert after_disk["format"] == "dpapi-v1"
    assert "legacy_secret_val" not in legacy_cred.read_text(encoding="utf-8")
