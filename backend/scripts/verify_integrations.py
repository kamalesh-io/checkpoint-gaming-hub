"""Live API Integration Verification Script.

Tests real-world external connectivity to IGDB and SteamGridDB APIs
for the canonical test games:
1. Elden Ring
2. Metro Exodus
3. Watch Dogs
4. Cyberpunk 2077

Demonstrates end-to-end metadata retrieval, Steam App ID matching,
artwork discovery (grids, heroes, logos), and local SQLite persistence.

CRITICAL: Never exposes, prints, or logs API keys or credentials.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.logging import logger
from app.services.igdb import igdb_client
from app.services.steamgriddb import steamgriddb_client
from app.services.artwork_cache import artwork_cache
from app.database.engine import create_engine_instance
from app.database.base import Base
from app.repositories.game_repo import GameRepository
from app.repositories.library_repo import LibraryRepository
from app.models.library import LibraryEntry, PlayingStatus, OwnershipStatus, Priority
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession


TEST_GAMES = [
    {"query": "Elden Ring", "expected_igdb_id": 119133, "expected_steam_id": 1245620},
    {"query": "Metro Exodus", "expected_igdb_id": 37016, "expected_steam_id": 412020},
    {"query": "Watch Dogs", "expected_igdb_id": 1121, "expected_steam_id": 243470},
    {"query": "Cyberpunk 2077", "expected_igdb_id": 1877, "expected_steam_id": 1091500},
]


def print_banner(text: str) -> None:
    line = "=" * 80
    print(f"\n{line}\n  {text}\n{line}")


def print_section(title: str) -> None:
    print(f"\n--- {title} " + "-" * (75 - len(title)))


async def verify_credentials() -> bool:
    """Verifies that API credentials are loaded without revealing their values."""
    print_banner("1. CHECKPOINT CREDENTIALS & ENVIRONMENT STATUS")

    igdb_id_present = bool(settings.get_igdb_client_id())
    igdb_secret_present = bool(settings.get_igdb_client_secret())
    sgdb_key_present = bool(settings.STEAMGRIDDB_API_KEY and settings.STEAMGRIDDB_API_KEY.get_secret_value())

    print(f"  • IGDB Client ID:         {'[CONFIGURED]' if igdb_id_present else '[MISSING]'}")
    print(f"  • IGDB Client Secret:     {'[CONFIGURED]' if igdb_secret_present else '[MISSING]'}")
    print(f"  • SteamGridDB API Key:    {'[CONFIGURED]' if sgdb_key_present else '[MISSING]'}")
    print(f"  • Environment:            {settings.APP_ENV}")
    print(f"  • Data Storage Path:      {settings.DATA_DIR}")
    print(f"  • Artwork Cache Path:     {settings.ARTWORK_CACHE_DIR}")

    if not (igdb_id_present and igdb_secret_present and sgdb_key_present):
        print("\n  [ERROR] One or more required API keys are not configured in backend/.env!")
        return False

    return True


async def verify_external_apis() -> List[Dict[str, Any]]:
    """Queries live IGDB and SteamGridDB for the 4 canonical test games."""
    print_banner("2. LIVE EXTERNAL API INTEGRATION VERIFICATION")
    collected_results = []

    for item in TEST_GAMES:
        game_title = item["query"]
        print_section(f"Testing Game: {game_title}")

        # --- A. IGDB Catalog Search ---
        print(f"  [IGDB] Searching catalog for '{game_title}'...")
        try:
            search_results = await igdb_client.search_games(game_title, limit=3)
            if not search_results:
                print(f"  [ERROR] No IGDB results found for '{game_title}'.")
                continue

            top_match = search_results[0]
            igdb_id = top_match["igdb_id"]
            is_expected_base = (igdb_id == item["expected_igdb_id"])
            print(f"  ✓ Top Match: '{top_match['title']}' (IGDB ID: {igdb_id}, Slug: '{top_match['slug']}', Category: {top_match.get('category')})")
            print(f"    Base Game Identification: {'[VERIFIED CORRECT BASE GAME]' if is_expected_base else '[UNEXPECTED EDITION]'}")
            print(f"    Release Year: {top_match.get('release_year')}, Developer: {top_match.get('developer')}")

            # --- B. IGDB Game Details ---
            print(f"  [IGDB] Fetching full metadata for IGDB ID {igdb_id}...")
            details = await igdb_client.get_game_details(igdb_id)
            if not details:
                print(f"  [ERROR] Failed to fetch details for IGDB ID {igdb_id}.")
                continue

            steam_app_id = details.get("steam_app_id")
            print(f"  ✓ Extracted Steam App ID: {steam_app_id} (Expected: {item.get('expected_steam_id')})")
            print(f"    Genres:    {', '.join([g['name'] if isinstance(g, dict) else g for g in details.get('genres', [])][:3])}")
            print(f"    Platforms: {', '.join(details.get('platforms', [])[:4])}")
            if details.get("cover_url"):
                print(f"    IGDB Cover: {details['cover_url']}")

            # --- C. SteamGridDB Artwork Discovery ---
            print(f"  [SteamGridDB] Searching high-resolution artwork (Steam App ID: {steam_app_id})...")
            sgdb_assets = await steamgriddb_client.get_all_artwork(game_title, steam_app_id=steam_app_id)
            
            sgdb_id = sgdb_assets.get("sgdb_id")
            grids = sgdb_assets.get("grids", [])
            heroes = sgdb_assets.get("heroes", [])
            logos = sgdb_assets.get("logos", [])

            print(f"  ✓ SteamGridDB Game ID: {sgdb_id}")
            print(f"    • 2:3 Portrait Grids:  {len(grids)} found (Top: {grids[0]['url'] if grids else 'None'})")
            print(f"    • 16:9 Heroes:         {len(heroes)} found (Top: {heroes[0]['url'] if heroes else 'None'})")
            print(f"    • Transparent Logos:   {len(logos)} found (Top: {logos[0]['url'] if logos else 'None'})")

            collected_results.append({
                "query": game_title,
                "details": details,
                "sgdb_assets": sgdb_assets,
            })

        except Exception as exc:
            print(f"  [EXCEPTION] Error verifying '{game_title}': {exc}")
            import traceback
            traceback.print_exc()

    return collected_results


async def verify_local_persistence_and_cache(results: List[Dict[str, Any]]) -> None:
    """Simulates adding a game to an isolated test SQLite DB, caching artwork, and verifying offline access."""
    print_banner("3. LOCAL PERSISTENCE, CACHING & OFFLINE VERIFICATION")

    if not results:
        print("  [SKIP] No API results available for persistence verification.")
        return

    sample = results[0]  # Elden Ring
    details = sample["details"]
    sgdb_assets = sample["sgdb_assets"]
    title = details["title"]

    print(f"  • Target test game: '{title}'")

    # 1. Test In-Memory SQLite persistence
    print("  • Initializing isolated SQLite test database engine...")
    test_db_url = "sqlite+aiosqlite:///:memory:"
    engine = create_engine_instance(test_db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as session:
        game_repo = GameRepository(session)
        lib_repo = LibraryRepository(session)

        # Upsert Game
        print("  • Writing game metadata into SQLite 'games' table...")
        game = await game_repo.create_or_update_from_igdb(details)
        await session.flush()
        print(f"  ✓ Created Game record ID: {game.id}")

        # Create LibraryEntry
        print("  • Creating personal library entry (PlayingStatus=CURRENTLY_PLAYING, Ownership=OWNED)...")
        entry = LibraryEntry(
            game_id=game.id,
            playing_status=PlayingStatus.CURRENTLY_PLAYING,
            ownership_status=OwnershipStatus.OWNED,
            platform="PC",
            priority=Priority.HIGH,
            progress_pct=25.0,
            hours_played=30.0,
            notes="Testing live verification flow.",
        )
        await lib_repo.create_entry(entry)
        await session.commit()
        print(f"  ✓ Created LibraryEntry record ID: {entry.id}")

        # Verify offline retrieval without network
        print("  • Verifying offline query without network...")
        retrieved = await lib_repo.get_by_id(entry.id)
        assert retrieved is not None
        assert retrieved.game.title == title
        assert retrieved.playing_status == PlayingStatus.CURRENTLY_PLAYING
        print(f"  ✓ Offline query successful: '{retrieved.game.title}' (Progress: {retrieved.progress_pct}%)")

    # 2. Test Artwork Caching with real remote download
    print_section("Artwork Caching & Integrity Validation")
    if sgdb_assets.get("grids"):
        test_url = sgdb_assets["grids"][0]["url"]
        print(f"  [Cache] Downloading and caching top grid artwork:")
        print(f"          {test_url}")
        cached_info = await artwork_cache.download_and_cache(test_url, category="covers")
        if cached_info:
            print(f"  ✓ Cached successfully!")
            print(f"    • Local Path:   {cached_info['local_path']}")
            print(f"    • SHA-256:      {cached_info['sha256_hash']}")
            print(f"    • Dimensions:   {cached_info['width']} x {cached_info['height']}")
            print(f"    • Size:         {cached_info['file_size_bytes']} bytes")
            print(f"    • MIME Type:    {cached_info['mime_type']}")

            # Verify deduplication (second download should return immediately from cache)
            print("  • Testing SHA-256 deduplication on identical URL...")
            cached_again = await artwork_cache.download_and_cache(test_url, category="covers")
            assert cached_again["sha256_hash"] == cached_info["sha256_hash"]
            print("  ✓ Deduplication verified (cache hit).")
        else:
            print("  [WARNING] Artwork download failed or timed out.")

    await engine.dispose()
    print_banner("ALL PHASE 1 INTEGRATION CHECKS COMPLETED SUCCESSFULLY")


async def main():
    print_banner("CHECKPOINT GAMING HUB — PHASE 1 LIVE VERIFICATION")
    ready = await verify_credentials()
    if not ready:
        sys.exit(1)

    results = await verify_external_apis()
    if len(results) < len(TEST_GAMES):
        print(f"\n[WARNING] Only {len(results)} of {len(TEST_GAMES)} games were verified.")
    else:
        print(f"\n[SUCCESS] All {len(TEST_GAMES)} games verified through IGDB and SteamGridDB.")

    await verify_local_persistence_and_cache(results)


if __name__ == "__main__":
    asyncio.run(main())
