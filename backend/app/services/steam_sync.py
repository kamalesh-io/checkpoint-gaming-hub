"""Steam library scanning, IGDB matching, preview generation, and synchronization service."""
import datetime
import json
import os
from pathlib import Path
import re
import struct
from typing import Any, Dict, List, Optional, Tuple
import uuid
import httpx
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.artwork import AssetType, GameArtwork
from app.models.game import Game
from app.models.library import LibraryEntry, OwnershipStatus, PlayingStatus
from app.models.steam import SteamAccount
from app.schemas.steam import (
    SteamGamePreview,
    SteamImportExecuteResponse,
    SteamImportPreviewResponse,
)
from app.services.game_detector import KNOWN_EDITION_ALIASES, GameDetectorService
from app.services.igdb import IGDBClient
from app.services.steam import STEAM_API_BASE
from app.services.steamgriddb import SteamGridDBClient


class SteamSyncService:
    """Orchestrates Steam owned games retrieval, IGDB alignment, and library sync."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.igdb_client = IGDBClient()
        self.sgdb_client = SteamGridDBClient()

    @staticmethod
    def get_steam_install_path() -> Optional[Path]:
        """Discovers primary Steam installation directory from Windows Registry or filesystem."""
        try:
            import winreg
            for hkey in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                for subkey in (r"Software\Valve\Steam", r"SOFTWARE\WOW6432Node\Valve\Steam"):
                    try:
                        with winreg.OpenKey(hkey, subkey) as k:
                            val, _ = winreg.QueryValueEx(k, "SteamPath")
                            if val and Path(val).exists():
                                return Path(val)
                    except Exception:
                        pass
        except Exception:
            pass
        for p in [
            Path(r"C:\Program Files (x86)\Steam"),
            Path(r"C:\Program Files\Steam"),
            Path(r"D:\Steam"),
            Path(r"E:\Steam"),
        ]:
            if p.exists():
                return p
        return None

    @staticmethod
    def parse_appinfo_games(steam_base: Optional[Path] = None) -> Dict[int, Dict[str, str]]:
        """Parses local Steam appcache/appinfo.vdf to resolve titles and application types in O(1)."""
        base = steam_base or SteamSyncService.get_steam_install_path()
        if not base:
            return {}
        appinfo_path = base / "appcache" / "appinfo.vdf"
        if not appinfo_path.exists():
            return {}
        try:
            buf = appinfo_path.read_bytes()
            if len(buf) < 16:
                return {}
            str_offset = struct.unpack_from("<Q", buf, 8)[0]
            if str_offset >= len(buf):
                return {}
            num_strings = struct.unpack_from("<I", buf, str_offset)[0]
            string_table: List[str] = []
            spos = str_offset + 4
            for _ in range(num_strings):
                end = buf.find(b"\x00", spos)
                if end != -1:
                    string_table.append(buf[spos:end].decode("utf-8", errors="ignore"))
                    spos = end + 1
            name_idx = string_table.index("name") if "name" in string_table else 4
            type_idx = string_table.index("type") if "type" in string_table else 5
            target_name_prefix = b"\x01" + struct.pack("<I", name_idx)
            target_type_prefix = b"\x01" + struct.pack("<I", type_idx)

            pos = 16
            apps: Dict[int, Dict[str, str]] = {}
            while pos < str_offset:
                appid = struct.unpack_from("<I", buf, pos)[0]
                if appid == 0:
                    break
                size = struct.unpack_from("<I", buf, pos + 4)[0]
                entry_bytes = buf[pos : pos + size + 8]

                app_name = None
                app_type = None

                n_pos = entry_bytes.find(target_name_prefix)
                if n_pos != -1:
                    v_start = n_pos + len(target_name_prefix)
                    v_end = entry_bytes.find(b"\x00", v_start)
                    if v_end != -1:
                        app_name = entry_bytes[v_start:v_end].decode("utf-8", errors="ignore")

                t_pos = entry_bytes.find(target_type_prefix)
                if t_pos != -1:
                    v_start = t_pos + len(target_type_prefix)
                    v_end = entry_bytes.find(b"\x00", v_start)
                    if v_end != -1:
                        app_type = entry_bytes[v_start:v_end].decode("utf-8", errors="ignore")

                if app_name:
                    apps[appid] = {"name": app_name, "type": (app_type or "").lower()}
                pos += 8 + size
            return apps
        except Exception as e:
            logger.debug(f"Failed to parse appinfo.vdf: {e}")
            return {}

    @staticmethod
    def get_local_steam_family_games(steam_base: Optional[Path] = None) -> Dict[int, Dict[str, Any]]:
        """Discovers all Steam Family Sharing and local library games with real playtime and timestamps."""
        base = steam_base or SteamSyncService.get_steam_install_path()
        if not base:
            return {}

        appinfo = SteamSyncService.parse_appinfo_games(base)
        userdata_dir = base / "userdata"

        discovered_app_ids = set()
        playtimes: Dict[int, Dict[str, Any]] = {}

        if userdata_dir.exists():
            for user_dir in userdata_dir.iterdir():
                if not user_dir.is_dir() or not user_dir.name.isdigit():
                    continue

                # 1. Parse collections
                cs1 = user_dir / "config" / "cloudstorage" / "cloud-storage-namespace-1.json"
                if cs1.exists():
                    try:
                        with open(cs1, "r", encoding="utf-8", errors="ignore") as f:
                            for item in json.load(f):
                                if isinstance(item, list) and len(item) >= 2:
                                    try:
                                        parsed = json.loads(item[1].get("value", ""))
                                        if isinstance(parsed, dict):
                                            for aid in parsed.get("added", []):
                                                discovered_app_ids.add(int(aid))
                                    except Exception:
                                        pass
                    except Exception:
                        pass

                # 2. Parse librarycache
                lc = user_dir / "config" / "librarycache"
                if lc.exists():
                    for f in lc.iterdir():
                        if f.name.endswith(".json") and f.stem.isdigit():
                            discovered_app_ids.add(int(f.stem))

                # 3. Parse localconfig.vdf for playtimes and app records
                lcvdf = user_dir / "config" / "localconfig.vdf"
                if lcvdf.exists():
                    try:
                        txt = lcvdf.read_text(encoding="utf-8", errors="ignore")
                        app_blocks = re.findall(
                            r'"(\d{4,})"\s*\{([^{}]*?"Playtime"[^{}]*?)\}',
                            txt,
                            re.IGNORECASE | re.DOTALL,
                        )
                        for aid_str, block in app_blocks:
                            aid = int(aid_str)
                            discovered_app_ids.add(aid)
                            pt_m = re.search(r'"Playtime"\s*"(\d+)"', block)
                            lp_m = re.search(r'"LastPlayed"\s*"(\d+)"', block)
                            playtimes[aid] = {
                                "playtime_forever": int(pt_m.group(1)) if pt_m else 0,
                                "rtime_last_played": int(lp_m.group(1)) if lp_m else None,
                            }
                    except Exception:
                        pass

        # Static fallback dictionary for high-profile community titles
        KNOWN_TITLES = {
            739630: "Phasmophobia",
            1449560: "Metro Exodus Enhanced Edition",
            1687950: "Persona 5 Royal",
            813780: "Age of Empires II: Definitive Edition",
            1245620: "ELDEN RING",
            3414900: "Probably Stolen",
        }

        games: Dict[int, Dict[str, Any]] = {}
        for aid in discovered_app_ids:
            if aid in (228980, 250820, 1391110, 1826330):
                continue
            info = appinfo.get(aid)
            name = None
            if info:
                if info["type"] in ("tool", "demo", "beta", "config"):
                    continue
                name = info["name"]
            elif aid in KNOWN_TITLES:
                name = KNOWN_TITLES[aid]
            else:
                continue

            pt_info = playtimes.get(aid, {})
            games[aid] = {
                "appid": aid,
                "name": name,
                "playtime_forever": pt_info.get("playtime_forever", 0),
                "rtime_last_played": pt_info.get("rtime_last_played"),
            }
        return games

    @staticmethod
    def get_local_manifest_games() -> Dict[int, Dict[str, Any]]:
        """Reads appmanifest_*.acf files across Steam libraries to map app_id to title and LastOwner SteamID."""
        manifests: Dict[int, Dict[str, Any]] = {}
        for lib in GameDetectorService.find_all_steam_libraries():
            steamapps = lib / "steamapps"
            if not steamapps.exists():
                continue
            for acf in steamapps.glob("appmanifest_*.acf"):
                match = re.search(r"appmanifest_(\d+)\.acf", acf.name, re.IGNORECASE)
                if not match:
                    continue
                app_id = int(match.group(1))
                if app_id in (228980, 250820, 1391110, 1826330):
                    continue
                try:
                    text = acf.read_text(encoding="utf-8", errors="ignore")
                    name_match = re.search(r'"name"\s+"([^"]+)"', text, re.IGNORECASE)
                    owner_match = re.search(r'"LastOwner"\s+"([^"]+)"', text, re.IGNORECASE)
                    manifests[app_id] = {
                        "appid": app_id,
                        "name": name_match.group(1) if name_match else f"Steam App {app_id}",
                        "last_owner": owner_match.group(1).strip() if owner_match else None,
                        "playtime_forever": 0,
                        "rtime_last_played": None,
                    }
                except Exception:
                    pass
        return manifests

    async def get_active_account(self) -> Optional[SteamAccount]:
        """Gets currently connected Steam account."""
        result = await self.session.execute(
            select(SteamAccount).where(SteamAccount.is_connected == True)  # noqa: E712
        )
        return result.scalar_one_or_none()

    async def fetch_steam_owned_games(
        self, steam_id_64: str, api_key: str
    ) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Calls IPlayerService/GetOwnedGames/v0001 with appinfo and played free games."""
        url = f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/"
        params = {
            "key": api_key,
            "steamid": steam_id_64,
            "include_appinfo": 1,
            "include_played_free_games": 1,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                res = await client.get(url, params=params)
                if res.status_code == 401 or res.status_code == 403:
                    return False, [], "Invalid Steam Web API key or access denied."
                if res.status_code != 200:
                    return False, [], f"Steam API returned HTTP {res.status_code}."

                data = res.json()
                response = data.get("response", {})
                games = response.get("games", [])
                return True, games, f"Found {len(games)} Steam games."
        except Exception as exc:
            logger.error(f"Failed to fetch Steam owned games: {exc}")
            return False, [], f"Connection error: {type(exc).__name__}"

    async def generate_import_preview(self) -> SteamImportPreviewResponse:
        """Scans Steam library and categorizes titles into new, existing, and unmatched in O(1) time."""
        account = await self.get_active_account()
        if not account:
            raise ValueError("No connected Steam account found.")

        api_key = settings.get_steam_web_api_key()
        if not api_key:
            raise ValueError("Steam Web API Key is missing.")

        ok, raw_games, msg = await self.fetch_steam_owned_games(account.steam_id_64, api_key)
        if not ok:
            raise ValueError(msg)

        # 1. Fetch all local games with steam_app_id
        result = await self.session.execute(select(Game).where(Game.steam_app_id.isnot(None)))
        local_steam_games = {g.steam_app_id: g for g in result.scalars().all()}

        # Also fetch all games indexed by normalized title
        all_games_res = await self.session.execute(select(Game))
        local_games_by_title = {g.title.lower().strip(): g for g in all_games_res.scalars().all()}

        # 2. Fetch existing library entries mapped by game_id
        entry_result = await self.session.execute(select(LibraryEntry))
        library_entries_by_game = {e.game_id: e for e in entry_result.scalars().all()}

        # 3. Fetch active covers for all games in a single batch query
        art_res = await self.session.execute(
            select(GameArtwork).where(
                GameArtwork.asset_type == AssetType.COVER.value,
                GameArtwork.is_active == True,  # noqa: E712
            )
        )
        covers_by_game = {a.game_id: getattr(a, 'remote_url', '') for a in art_res.scalars().all()}

        local_family = self.get_local_steam_family_games()
        local_manifests = self.get_local_manifest_games()

        raw_app_ids = {int(g["appid"]) for g in raw_games if g.get("appid")}
        all_steam_items: List[Dict[str, Any]] = list(raw_games)

        # Merge local family games not returned by Web API
        for app_id, fam in local_family.items():
            if app_id not in raw_app_ids:
                all_steam_items.append(fam)

        # Merge local manifests
        seen_app_ids = {int(item["appid"]) for item in all_steam_items if item.get("appid")}
        for app_id, m in local_manifests.items():
            if app_id not in seen_app_ids:
                all_steam_items.append(m)

        new_games: List[SteamGamePreview] = []
        existing_games: List[SteamGamePreview] = []
        unmatched_games: List[SteamGamePreview] = []

        for item in all_steam_items:
            app_id = int(item.get("appid", 0))
            if not app_id:
                continue

            name = item.get("name", f"Steam App {app_id}")
            playtime = int(item.get("playtime_forever", 0))
            last_played = item.get("rtime_last_played")

            # Determine ownership status:
            # If directly returned in raw_games or manifest owner matches connected account -> OWNED
            # Otherwise -> FAMILY_SHARED
            manifest_info = local_manifests.get(app_id)
            if app_id in raw_app_ids:
                default_ownership = OwnershipStatus.OWNED.value
            elif manifest_info and manifest_info.get("last_owner") == account.steam_id_64:
                default_ownership = OwnershipStatus.OWNED.value
            else:
                default_ownership = OwnershipStatus.FAMILY_SHARED.value
            
            # Default instant high-resolution Steam CDN capsule artwork (600x900)
            cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"

            # Check local games by direct app_id, known edition alias, or title match
            matched_game = local_steam_games.get(app_id)
            if not matched_game:
                aliases = KNOWN_EDITION_ALIASES.get(app_id)
                if aliases:
                    for alias_id in aliases:
                        if alias_id in local_steam_games:
                            matched_game = local_steam_games[alias_id]
                            break
            if not matched_game:
                matched_game = local_games_by_title.get(name.lower().strip())

            if matched_game:
                entry = library_entries_by_game.get(matched_game.id)
                local_cover = covers_by_game.get(matched_game.id)
                if local_cover:
                    cover_url = local_cover

                preview = SteamGamePreview(
                    steam_app_id=app_id,
                    title=matched_game.title,
                    playtime_forever_minutes=playtime,
                    last_played_timestamp=last_played,
                    igdb_id=matched_game.igdb_id,
                    cover_url=cover_url,
                    ownership_status=entry.ownership_status if entry else default_ownership,
                    already_imported=entry is not None,
                    library_entry_id=entry.id if entry else None,
                )

                if entry:
                    existing_games.append(preview)
                else:
                    new_games.append(preview)
            else:
                new_games.append(
                    SteamGamePreview(
                        steam_app_id=app_id,
                        title=name,
                        playtime_forever_minutes=playtime,
                        last_played_timestamp=last_played,
                        igdb_id=None,
                        cover_url=cover_url,
                        ownership_status=default_ownership,
                        already_imported=False,
                    )
                )

        return SteamImportPreviewResponse(
            total_found=len(all_steam_items),
            new_games=new_games,
            existing_games=existing_games,
            unmatched_games=unmatched_games,
        )

    async def execute_import(
        self,
        app_ids: List[int],
        ownership_overrides: Optional[Dict[int, str]] = None,
    ) -> SteamImportExecuteResponse:
        """Imports selected games into the local Checkpoint library without overwriting personal progress."""
        account = await self.get_active_account()
        if not account:
            raise ValueError("No connected Steam account found.")

        api_key = settings.get_steam_web_api_key()
        if not api_key:
            raise ValueError("Steam Web API Key is missing.")

        ok, raw_games, msg = await self.fetch_steam_owned_games(account.steam_id_64, api_key)
        if not ok:
            raise ValueError(msg)

        steam_games_map = {int(g["appid"]): g for g in raw_games if g.get("appid")}
        raw_app_ids = set(steam_games_map.keys())

        local_family = self.get_local_steam_family_games()
        for app_id, fam in local_family.items():
            if app_id not in steam_games_map:
                steam_games_map[app_id] = fam

        local_manifests = self.get_local_manifest_games()
        for app_id, m in local_manifests.items():
            if app_id not in steam_games_map:
                steam_games_map[app_id] = m

        overrides = ownership_overrides or {}

        imported_count = 0
        updated_count = 0
        failed_count = 0

        for app_id in app_ids:
            item = steam_games_map.get(app_id)
            if not item:
                failed_count += 1
                continue

            try:
                async with self.session.begin_nested():
                    name = item.get("name", f"Steam App {app_id}")
                    playtime = int(item.get("playtime_forever", 0))
                    rtime_last_played = item.get("rtime_last_played")
                    last_played_dt = (
                        datetime.datetime.fromtimestamp(rtime_last_played, datetime.timezone.utc)
                        if rtime_last_played
                        else None
                    )

                    manifest_info = local_manifests.get(app_id)
                    if app_id in raw_app_ids:
                        default_owner = OwnershipStatus.OWNED.value
                    elif manifest_info and manifest_info.get("last_owner") == account.steam_id_64:
                        default_owner = OwnershipStatus.OWNED.value
                    else:
                        default_owner = OwnershipStatus.FAMILY_SHARED.value
                    ownership = overrides.get(app_id, default_owner)

                    # Check if Game already exists by steam_app_id, synthetic igdb_id, or slug
                    slug = f"steam-{app_id}"
                    g_res = await self.session.execute(
                        select(Game).where(
                            or_(
                                Game.steam_app_id == app_id,
                                Game.igdb_id == -app_id,
                                Game.slug == slug,
                            )
                        )
                    )
                    game = g_res.scalar_one_or_none()

                    if not game:
                        aliases = KNOWN_EDITION_ALIASES.get(app_id, [])
                        if aliases:
                            a_res = await self.session.execute(
                                select(Game).where(Game.steam_app_id.in_(aliases))
                            )
                            game = a_res.scalars().first()
                    if not game:
                        t_res = await self.session.execute(
                            select(Game).where(func.lower(Game.title) == name.lower().strip())
                        )
                        game = t_res.scalars().first()

                    if not game:
                        game = Game(
                            igdb_id=-app_id,  # Negative synthetic ID for raw Steam titles without IGDB
                            title=name,
                            slug=slug,
                            summary=f"Imported from Steam (App ID {app_id}).",
                            steam_app_id=app_id,
                        )
                        self.session.add(game)
                        await self.session.flush()
                    else:
                        if not game.steam_app_id:
                            game.steam_app_id = app_id

                    # Resolve artwork: Steam official HD CDN defaults (instantaneous)
                    cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"
                    hero_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_hero.jpg"
                    logo_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/logo.png"

                    # Cover artwork
                    c_res = await self.session.execute(
                        select(GameArtwork).where(
                            GameArtwork.game_id == game.id,
                            GameArtwork.asset_type == AssetType.COVER.value,
                        )
                    )
                    existing_cover = c_res.scalars().first()
                    if not existing_cover:
                        self.session.add(
                            GameArtwork(
                                id=str(uuid.uuid4()),
                                game_id=game.id,
                                asset_type=AssetType.COVER.value,
                                remote_url=cover_url,
                                local_path="",
                                width=600,
                                height=900,
                                is_active=True,
                                is_animated=False,
                                source="steam",
                            )
                        )

                    # Hero artwork (background banner)
                    h_res = await self.session.execute(
                        select(GameArtwork).where(
                            GameArtwork.game_id == game.id,
                            GameArtwork.asset_type == AssetType.HERO.value,
                        )
                    )
                    existing_hero = h_res.scalars().first()
                    if not existing_hero:
                        self.session.add(
                            GameArtwork(
                                id=str(uuid.uuid4()),
                                game_id=game.id,
                                asset_type=AssetType.HERO.value,
                                remote_url=hero_url,
                                local_path="",
                                width=1920,
                                height=1080,
                                is_active=True,
                                is_animated=False,
                                source="steam",
                            )
                        )

                    # Logo artwork (transparent game title logo)
                    l_res = await self.session.execute(
                        select(GameArtwork).where(
                            GameArtwork.game_id == game.id,
                            GameArtwork.asset_type == AssetType.LOGO.value,
                        )
                    )
                    existing_logo = l_res.scalars().first()
                    if not existing_logo:
                        self.session.add(
                            GameArtwork(
                                id=str(uuid.uuid4()),
                                game_id=game.id,
                                asset_type=AssetType.LOGO.value,
                                remote_url=logo_url,
                                local_path="",
                                width=800,
                                height=300,
                                is_active=True,
                                is_animated=False,
                                source="steam",
                            )
                        )
                    elif "steamgriddb" in logo_url:
                        existing_logo.remote_url = logo_url

                    # Check if LibraryEntry exists
                    e_res = await self.session.execute(
                        select(LibraryEntry).where(LibraryEntry.game_id == game.id)
                    )
                    entry = e_res.scalar_one_or_none()

                    if entry:
                        entry.steam_playtime_minutes = playtime
                        if last_played_dt:
                            entry.steam_last_played_at = last_played_dt
                        if app_id in overrides:
                            entry.ownership_status = ownership
                        updated_count += 1
                    else:
                        entry = LibraryEntry(
                            game_id=game.id,
                            playing_status=PlayingStatus.PLANNED.value,
                            ownership_status=ownership,
                            platform="Steam",
                            steam_playtime_minutes=playtime,
                            steam_last_played_at=last_played_dt,
                            hours_played=0.0,
                        )
                        self.session.add(entry)
                        imported_count += 1

            except Exception as exc:
                logger.error(f"Failed to import Steam app {app_id}: {exc}")
                failed_count += 1

        account.last_synced_at = datetime.datetime.now(datetime.timezone.utc)
        await self.session.commit()

        return SteamImportExecuteResponse(
            imported_count=imported_count,
            updated_count=updated_count,
            failed_count=failed_count,
            message=(
                f"Synchronization complete: {imported_count} imported, "
                f"{updated_count} updated, {failed_count} skipped/failed."
            ),
        )

    async def enrich_all_steam_artworks(self) -> int:
        """Enriches all library games having a steam_app_id with high-res SteamGridDB heroes, grids, and logos."""
        res = await self.session.execute(
            select(Game).where(Game.steam_app_id.isnot(None))
        )
        games = res.scalars().all()
        enriched_count = 0

        for game in games:
            app_id = game.steam_app_id
            name = game.title

            cover_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"
            hero_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_hero.jpg"
            logo_url = f"https://shared.steamstatic.com/store_item_assets/steam/apps/{app_id}/logo.png"

            try:
                sgdb_art = await self.sgdb_client.get_all_artwork(name, app_id)
                if sgdb_art.get("grids"):
                    cover_url = sgdb_art["grids"][0]["url"]
                if sgdb_art.get("heroes"):
                    hero_url = sgdb_art["heroes"][0]["url"]
                if sgdb_art.get("logos"):
                    logo_url = sgdb_art["logos"][0]["url"]
            except Exception as e:
                logger.debug(f"SteamGridDB enrichment error for {name}: {e}")

            # Hero artwork
            h_res = await self.session.execute(
                select(GameArtwork).where(
                    GameArtwork.game_id == game.id,
                    GameArtwork.asset_type == AssetType.HERO.value,
                )
            )
            existing_hero = h_res.scalars().first()
            if existing_hero:
                existing_hero.remote_url = hero_url
                existing_hero.is_active = True
                existing_hero.source = "steamgriddb" if "steamgriddb" in hero_url else "steam"
            else:
                self.session.add(
                    GameArtwork(
                        id=str(uuid.uuid4()),
                        game_id=game.id,
                        asset_type=AssetType.HERO.value,
                        remote_url=hero_url,
                        local_path="",
                        width=1920,
                        height=1080,
                        is_active=True,
                        is_animated=False,
                        source="steamgriddb" if "steamgriddb" in hero_url else "steam",
                    )
                )

            # Logo artwork
            l_res = await self.session.execute(
                select(GameArtwork).where(
                    GameArtwork.game_id == game.id,
                    GameArtwork.asset_type == AssetType.LOGO.value,
                )
            )
            existing_logo = l_res.scalars().first()
            if existing_logo:
                existing_logo.remote_url = logo_url
                existing_logo.is_active = True
                existing_logo.source = "steamgriddb" if "steamgriddb" in logo_url else "steam"
            else:
                self.session.add(
                    GameArtwork(
                        id=str(uuid.uuid4()),
                        game_id=game.id,
                        asset_type=AssetType.LOGO.value,
                        remote_url=logo_url,
                        local_path="",
                        width=800,
                        height=300,
                        is_active=True,
                        is_animated=False,
                        source="steamgriddb" if "steamgriddb" in logo_url else "steam",
                    )
                )

            # Cover artwork
            if "steamgriddb" in cover_url:
                c_res = await self.session.execute(
                    select(GameArtwork).where(
                        GameArtwork.game_id == game.id,
                        GameArtwork.asset_type == AssetType.COVER.value,
                    )
                )
                existing_cover = c_res.scalars().first()
                if existing_cover:
                    existing_cover.remote_url = cover_url
                    existing_cover.source = "steamgriddb"

            enriched_count += 1

        await self.session.commit()
        return enriched_count
