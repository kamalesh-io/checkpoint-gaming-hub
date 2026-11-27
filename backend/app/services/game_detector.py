"""Local Windows game installation scanner (libraryfolders.vdf) and active gameplay process monitor."""
import datetime
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import psutil
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.game import Game
from app.models.library import LibraryEntry
from app.models.session import ActivePlaySession, PlaySession
from app.schemas.steam import DetectorStatusResponse, InstalledGameInfo


# Non-game launcher, overlay, crash reporter, and anti-cheat processes to ignore
EXCLUDED_PROCESS_NAMES: Set[str] = {
    "steam.exe",
    "steamservice.exe",
    "steamwebhelper.exe",
    "gameoverlayui.exe",
    "epicgameslauncher.exe",
    "epicwebhelper.exe",
    "gog.galaxy.client.exe",
    "galaxyclient.exe",
    "galaxycommunication.exe",
    "origin.exe",
    "eadesktop.exe",
    "eaconnect_service.exe",
    "ubisoftconnect.exe",
    "upc.exe",
    "battlenet.exe",
    "agent.exe",
    "riotclientservices.exe",
    "vgc.exe",
    "vgtray.exe",
    "easyanticheat.exe",
    "easyanticheat_eos.exe",
    "battleye.exe",
    "beservice.exe",
    "crashreporter.exe",
    "unitycrashhandler64.exe",
    "unitycrashhandler32.exe",
    "unrealcefsubprocess.exe",
    "dxsetup.exe",
    "vcredist_x64.exe",
    "vcredist_x86.exe",
    "cmd.exe",
    "powershell.exe",
    "checkpoint.exe",
    "checkpoint gaming hub.exe",
    "checkpoint_gaming_hub.exe",
    "checkpoint-backend.exe",
    "checkpoint-backend-x86_64-pc-windows-msvc.exe",
}


class GameDetectorService:
    """Detects local Steam installations across drives and monitors running game processes."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def get_steam_installation_path() -> Optional[Path]:
        """Finds primary Steam root on Windows via environment or common default locations."""
        candidates = [
            Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Steam",
            Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Steam",
            Path("C:/Steam"),
            Path("D:/Steam"),
        ]
        for p in candidates:
            if (p / "steamapps" / "libraryfolders.vdf").exists():
                return p
            if (p / "steam.exe").exists():
                return p
        return None

    @classmethod
    def find_all_steam_libraries(cls) -> List[Path]:
        """Parses libraryfolders.vdf to discover all Steam library folders across all storage drives."""
        root = cls.get_steam_installation_path()
        if not root:
            return []

        vdf_path = root / "steamapps" / "libraryfolders.vdf"
        if not vdf_path.exists():
            return [root]

        libraries: List[Path] = [root]
        try:
            content = vdf_path.read_text(encoding="utf-8", errors="ignore")
            # Matches: "path" "D:\\SteamLibrary" or "1" { "path" "E:\\Games\\Steam" }
            matches = re.findall(r'"path"\s+"([^"]+)"', content, re.IGNORECASE)
            for m in matches:
                p = Path(m.replace("\\\\", "/"))
                if p.exists() and p not in libraries:
                    libraries.append(p)
        except Exception as exc:
            logger.warning(f"Error parsing Steam libraryfolders.vdf: {exc}")

        return libraries

    @classmethod
    def scan_installed_steam_games(cls) -> List[InstalledGameInfo]:
        """Reads appmanifest_{appid}.acf files across all discovered library folders."""
        installed: List[InstalledGameInfo] = []
        libraries = cls.find_all_steam_libraries()

        for lib in libraries:
            steamapps = lib / "steamapps"
            if not steamapps.exists():
                continue

            for acf in steamapps.glob("appmanifest_*.acf"):
                try:
                    match = re.search(r"appmanifest_(\d+)\.acf", acf.name, re.IGNORECASE)
                    if not match:
                        continue
                    app_id = int(match.group(1))

                    # Filter out Steamworks Common Redistributables (228980), etc.
                    if app_id in (228980, 250820, 1391110, 1826330):
                        continue

                    text = acf.read_text(encoding="utf-8", errors="ignore")
                    name_match = re.search(r'"name"\s+"([^"]+)"', text, re.IGNORECASE)
                    dir_match = re.search(r'"installdir"\s+"([^"]+)"', text, re.IGNORECASE)
                    size_match = re.search(r'"SizeOnDisk"\s+"([^"]+)"', text, re.IGNORECASE)

                    name = name_match.group(1) if name_match else f"Steam App {app_id}"
                    installdir = dir_match.group(1) if dir_match else ""
                    size = int(size_match.group(1)) if size_match and size_match.group(1).isdigit() else None

                    install_path = steamapps / "common" / installdir
                    exe_path = None
                    if install_path.exists() and install_path.is_dir():
                        # Find primary .exe inside install dir
                        exes = [
                            f
                            for f in install_path.glob("*.exe")
                            if f.name.lower() not in EXCLUDED_PROCESS_NAMES
                        ]
                        if exes:
                            # Prefer executable with matching game name or largest file size
                            exes.sort(key=lambda x: x.stat().st_size, reverse=True)
                            exe_path = str(exes[0])

                    installed.append(
                        InstalledGameInfo(
                            steam_app_id=app_id,
                            title=name,
                            install_dir=str(install_path),
                            executable_path=exe_path,
                            size_on_disk_bytes=size,
                        )
                    )
                except Exception as exc:
                    logger.debug(f"Failed parsing manifest {acf.name}: {exc}")

        return installed

    async def detect_running_game(self) -> Optional[Dict[str, Any]]:
        """Inspects running Windows processes and matches against library games with zero code injection."""
        # 1. Fetch all library games with registered executable paths or Steam App IDs
        result = await self.session.execute(
            select(Game, LibraryEntry).join(LibraryEntry, Game.id == LibraryEntry.game_id)
        )
        library_pairs = result.all()
        if not library_pairs:
            return None

        # Build lookup tables
        configured_paths: Dict[str, Tuple[Game, LibraryEntry]] = {}
        steam_app_map: Dict[int, Tuple[Game, LibraryEntry]] = {}

        for game, entry in library_pairs:
            if entry.executable_path:
                norm = Path(entry.executable_path).resolve().as_posix().lower()
                configured_paths[norm] = (game, entry)
            if game.steam_app_id:
                steam_app_map[game.steam_app_id] = (game, entry)

        # Also get installed Steam games to match processes inside steamapps/common/{installdir}
        installed_steam = self.scan_installed_steam_games()
        steam_dir_to_game: Dict[str, Tuple[Game, LibraryEntry]] = {}
        for inst in installed_steam:
            if inst.steam_app_id in steam_app_map:
                pair = steam_app_map[inst.steam_app_id]
                steam_dir_to_game[Path(inst.install_dir).resolve().as_posix().lower()] = pair

        # Scan active processes safely
        for proc in psutil.process_iter(["pid", "name", "exe"]):
            try:
                name = (proc.info.get("name") or "").lower()
                if not name or name in EXCLUDED_PROCESS_NAMES:
                    continue

                exe_str = proc.info.get("exe")
                if not exe_str:
                    continue

                exe_path = Path(exe_str).resolve().as_posix().lower()

                # Match A: Exact executable path match
                if exe_path in configured_paths:
                    game, entry = configured_paths[exe_path]
                    return {
                        "game_id": game.id,
                        "library_entry_id": entry.id,
                        "title": game.title,
                        "pid": proc.info["pid"],
                        "executable": exe_str,
                        "matched_by": "executable_path",
                    }

                # Match B: Running executable inside a registered Steam install directory
                for steam_dir, pair in steam_dir_to_game.items():
                    if exe_path.startswith(steam_dir):
                        game, entry = pair
                        return {
                            "game_id": game.id,
                            "library_entry_id": entry.id,
                            "title": game.title,
                            "pid": proc.info["pid"],
                            "executable": exe_str,
                            "matched_by": "steam_install_dir",
                        }

            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception as exc:
                logger.debug(f"Process check skipped: {exc}")

        return None

    async def poll_gameplay_monitoring(self) -> DetectorStatusResponse:
        """Adaptive polling tick: detects running games and manages active play sessions."""
        running = await self.detect_running_game()
        libraries = [p.as_posix() for p in self.find_all_steam_libraries()]

        # Query existing active play session
        active_res = await self.session.execute(select(ActivePlaySession))
        current_active = active_res.scalar_one_or_none()

        if running:
            target_entry_id = running["library_entry_id"]

            if not current_active:
                # Start automatic tracking session
                new_session = ActivePlaySession(
                    library_entry_id=target_entry_id,
                    notes=f"Automatically detected gameplay ({running['matched_by']}: {running['title']})",
                )
                self.session.add(new_session)
                await self.session.commit()
                logger.info(f"Auto-started gameplay tracking for '{running['title']}' (PID {running['pid']})")
            elif current_active.library_entry_id == target_entry_id:
                # Same game is still running, session continues
                pass
            else:
                # A different game started while an old one was active -> finalize previous, start new
                await self._finalize_session(current_active)
                new_session = ActivePlaySession(
                    library_entry_id=target_entry_id,
                    notes=f"Automatically detected gameplay ({running['matched_by']}: {running['title']})",
                )
                self.session.add(new_session)
                await self.session.commit()
        else:
            # No game currently detected running
            if current_active and current_active.notes and "Automatically detected gameplay" in current_active.notes:
                # Automatically finalize auto-detected session once game closes
                await self._finalize_session(current_active)
                logger.info("Automatically finalized ended gameplay session.")

        return DetectorStatusResponse(
            is_enabled=True,
            is_monitoring=True,
            detected_libraries=libraries,
            running_game=running,
        )

    async def _finalize_session(self, active: ActivePlaySession) -> None:
        """Converts completed active session into permanent PlaySession and updates hours."""
        now = datetime.datetime.now(datetime.timezone.utc)
        elapsed = int((now - active.start_time.replace(tzinfo=datetime.timezone.utc)).total_seconds()) + active.accumulated_seconds
        minutes = max(1, elapsed // 60)

        # Create permanent historical session
        hist = PlaySession(
            library_entry_id=active.library_entry_id,
            duration_minutes=minutes,
            location_or_chapter=active.location_or_chapter or "Automated Session",
            notes=active.notes,
        )
        self.session.add(hist)

        # Update library entry hours_played
        entry_res = await self.session.execute(
            select(LibraryEntry).where(LibraryEntry.id == active.library_entry_id)
        )
        entry = entry_res.scalar_one_or_none()
        if entry:
            entry.hours_played = round(entry.hours_played + (minutes / 60.0), 2)

        await self.session.delete(active)
        await self.session.commit()
