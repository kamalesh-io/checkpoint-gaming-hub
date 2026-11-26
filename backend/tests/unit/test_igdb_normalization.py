"""Unit tests for IGDB metadata normalization and formatting."""

import datetime
from app.services.igdb import IGDBClient, format_igdb_image_url


def test_format_igdb_image_url():
    """Verify URL scheme fix and size substitution."""
    raw_url = "//images.igdb.com/igdb/image/upload/t_thumb/co1r7f.jpg"
    formatted = format_igdb_image_url(raw_url, "t_cover_big")
    assert formatted == "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg"

    assert format_igdb_image_url(None) is None
    assert format_igdb_image_url("") is None


def test_normalize_search_item():
    """Verify raw IGDB search response normalization."""
    client = IGDBClient()
    raw_item = {
        "id": 119133,
        "name": "Elden Ring",
        "slug": "elden-ring",
        "category": 0,
        "first_release_date": 1645747200,  # 2022-02-25
        "total_rating": 95.8,
        "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/co4jni.jpg"},
        "genres": [{"name": "Role-playing (RPG)"}, {"name": "Adventure"}],
        "platforms": [{"name": "PC (Microsoft Windows)", "abbreviation": "PC"}],
        "involved_companies": [
            {"developer": True, "publisher": False, "company": {"name": "FromSoftware"}},
            {"developer": False, "publisher": True, "company": {"name": "Bandai Namco Entertainment"}},
        ],
    }

    normalized = client.normalize_search_item(raw_item)
    assert normalized["igdb_id"] == 119133
    assert normalized["title"] == "Elden Ring"
    assert normalized["category"] == "base_game"
    assert normalized["release_year"] == 2022
    assert normalized["developer"] == "FromSoftware"
    assert normalized["publisher"] == "Bandai Namco Entertainment"
    assert "Role-playing (RPG)" in normalized["genres"]
    assert "PC" in normalized["platforms"]
    assert normalized["cover_url"].startswith("https://")


def test_extract_steam_app_id():
    """Verify extraction of Steam App ID from external_games array."""
    client = IGDBClient()
    raw_details = {
        "id": 119133,
        "name": "Elden Ring",
        "slug": "elden-ring",
        "first_release_date": 1645747200,
        "external_games": [
            {"category": 1, "uid": "1245620"},  # 1 = Steam
            {"category": 5, "uid": "c074df1f-94d5-45dc-bc8f"},
        ],
        "genres": [],
        "themes": [],
        "platforms": [],
    }

    normalized = client.normalize_game_details(raw_details)
    assert normalized["steam_app_id"] == 1245620


def test_score_search_candidate_prioritizes_base_game():
    """Verify base game candidate scores higher than bundles and editions without dropping them."""
    from app.services.game_matching import score_search_candidate

    query = "Cyberpunk 2077"

    # Base game
    base_candidate = {
        "id": 1877,
        "name": "Cyberpunk 2077",
        "slug": "cyberpunk-2077",
        "game_type": 0,
        "version_parent": None,
        "parent_game": None,
        "external_games": [{"external_game_source": 1, "uid": "1091500"}],
    }

    # Ultimate edition (bundle with version_parent)
    edition_candidate = {
        "id": 277807,
        "name": "Cyberpunk 2077: Ultimate Edition",
        "slug": "cyberpunk-2077-ultimate-edition",
        "game_type": 3,
        "version_parent": 1877,
        "parent_game": None,
        "external_games": [],
    }

    # Expansion
    expansion_candidate = {
        "id": 215769,
        "name": "Cyberpunk 2077: Phantom Liberty",
        "slug": "cyberpunk-2077-phantom-liberty",
        "game_type": 2,
        "version_parent": None,
        "parent_game": 1877,
        "external_games": [{"external_game_source": 1, "uid": "2138330"}],
    }

    base_score = score_search_candidate(base_candidate, query)
    edition_score = score_search_candidate(edition_candidate, query)
    expansion_score = score_search_candidate(expansion_candidate, query)

    # Base game must rank strictly highest
    assert base_score > edition_score
    assert base_score > expansion_score
    # Expansion and edition still have positive relevance scores (not excluded)
    assert expansion_score > 0
    assert edition_score > 0
