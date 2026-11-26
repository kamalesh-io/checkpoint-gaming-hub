"""Game title matching and disambiguation algorithms."""
import difflib
import re
from typing import Optional


def normalize_title(title: str) -> str:
    """Normalizes title for robust comparison across storefronts."""
    if not title:
        return ""
    # Lowercase
    t = title.lower()
    # Replace Roman numerals up to VIII
    roman_map = {
        r"\bviii\b": "8",
        r"\bvii\b": "7",
        r"\bvi\b": "6",
        r"\biv\b": "4",
        r"\bv\b": "5",
        r"\biii\b": "3",
        r"\bii\b": "2",
        r"\bi\b": "1",
    }
    for pattern, rep in roman_map.items():
        t = re.sub(pattern, rep, t)

    # Remove subtitle colons and common edition tags
    t = re.sub(r"[:\-\–—\(\)\[\]]", " ", t)
    t = re.sub(r"\b(goty|game of the year|enhanced edition|remastered|definitive edition)\b", "", t)
    # Strip non-alphanumeric characters except spaces
    t = re.sub(r"[^a-z0-9\s]", "", t)
    # Collapse multiple whitespace
    return " ".join(t.split())


def calculate_title_similarity(title_a: str, title_b: str) -> float:
    """Calculates normalized Levenshtein-like similarity ratio (0.0 to 1.0)."""
    norm_a = normalize_title(title_a)
    norm_b = normalize_title(title_b)
    if not norm_a or not norm_b:
        return 0.0
    if norm_a == norm_b:
        return 1.0
    return difflib.SequenceMatcher(None, norm_a, norm_b).ratio()


def is_title_match(title_a: str, title_b: str, threshold: float = 0.85) -> bool:
    """Determines if two titles represent the same game."""
    return calculate_title_similarity(title_a, title_b) >= threshold


def slugify(text: str) -> str:
    """Generates an IGDB-compatible URL slug from title."""
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[-\s]+", "-", s)


def extract_steam_app_id_from_external_games(external_games: Optional[list]) -> Optional[int]:
    """Extracts numeric Steam App ID from IGDB external_games list.
    
    Supports external_game_source == 1, category == 1, or URL matching steampowered.com/app/<id>.
    """
    if not external_games:
        return None
    for ext in external_games:
        is_steam = (
            ext.get("external_game_source") == 1
            or ext.get("category") == 1
            or "steampowered.com/app/" in ext.get("url", "")
        )
        if is_steam:
            uid = ext.get("uid")
            if uid and str(uid).isdigit():
                return int(uid)
            # Fallback to URL regex if uid is non-numeric
            url = ext.get("url", "")
            match = re.search(r"store\.steampowered\.com/app/(\d+)", url)
            if match:
                return int(match.group(1))
    return None


def score_search_candidate(item: dict, query: str) -> float:
    """Scores an IGDB search candidate for relevance, prioritizing base games over editions.
    
    Uses IGDB game_type, slug match, release year, version_parent, parent_game,
    and external Steam App ID.
    """
    score = 0.0
    name = item.get("name", "")
    slug = item.get("slug", "")
    game_type = item.get("game_type", item.get("category", 0))
    if game_type is None:
        game_type = 0
    version_parent = item.get("version_parent")
    parent_game = item.get("parent_game")

    norm_query = normalize_title(query)
    norm_name = normalize_title(name)
    query_slug = slugify(query)

    # 1. Title Similarity (0 to 100 points)
    sim = calculate_title_similarity(name, query)
    score += sim * 100.0

    # 2. Exact Title Matches
    if norm_name == norm_query:
        score += 150.0
    elif norm_name.startswith(norm_query):
        score += 30.0

    # 3. Exact Slug Match
    if slug == query_slug:
        score += 100.0

    # 4. Game Type Evaluation (0 = Main Game, 8 = Remake, 9 = Remaster, etc.)
    if game_type == 0:
        if version_parent is None and parent_game is None:
            score += 100.0  # Standalone original base game
        else:
            score += 20.0   # Edition or variant of a base game
    elif game_type in (8, 9):  # Remake / Remaster
        score += 40.0
    elif game_type in (1, 2, 4):  # DLC / Expansion / Standalone Expansion
        score += 10.0
    elif game_type == 3:  # Bundle
        score -= 40.0
    else:  # Mod, Update, Pack, Episode
        score -= 50.0

    # 5. Version Parent / Parent Game Penalty (unless user query asked for editions)
    query_lower = query.lower()
    has_edition_term = any(k in query_lower for k in ("edition", "dlc", "expansion", "bundle", "pack", "remaster", "remake"))
    if (version_parent is not None or parent_game is not None) and not has_edition_term:
        score -= 30.0

    # 6. Steam App ID Presence (+25 points)
    if extract_steam_app_id_from_external_games(item.get("external_games")):
        score += 25.0

    return score
