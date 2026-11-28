# CHECKPOINT Gaming Hub — User Guide

Welcome to **CHECKPOINT Gaming Hub**! This guide walks you through setup, configuration, features, and tips for making the most of your local-first gaming hub.

---

## Table of Contents

1. [Installation & First Run](#1-installation--first-run)
2. [Setting Up API Credentials](#2-setting-up-api-credentials)
3. [Connecting & Syncing Steam](#3-connecting--syncing-steam)
4. [Managing Your Library](#4-managing-your-library)
5. [Playing & Launching Games](#5-playing--launching-games)
6. [Automatic Playtime Tracking](#6-automatic-playtime-tracking)
7. [Achievements & 100% Completion](#7-achievements--100-completion)
8. [Backlog Prioritizer & Kanban](#8-backlog-prioritizer--kanban)
9. [Gaming Planner & Sessions](#9-gaming-planner--sessions)
10. [Gaming Journal & Notes](#10-gaming-journal--notes)
11. [Wishlist & Price Tracking](#11-wishlist--price-tracking)
12. [Big Picture Mode & Controller Usage](#12-big-picture-mode--controller-usage)
13. [Backups & Data Management](#13-backups--data-management)
14. [Troubleshooting & FAQ](#14-troubleshooting--faq)

---

## 1. Installation & First Run

1. Download `CHECKPOINT_1.0.0_x64-setup.exe`.
2. Run the installer. If Windows SmartScreen appears, click **More info** $\rightarrow$ **Run anyway**.
3. Follow the on-screen installer prompts. The installer will install CHECKPOINT to your local user profile without requiring administrator privileges.
4. Launch CHECKPOINT from your Start Menu or Desktop shortcut.
5. On the first launch, the initialization screen verifies the embedded backend engine and opens the First-Run Onboarding Modal to help you connect your Steam account and configure API keys.

---

## 2. Setting Up API Credentials

CHECKPOINT utilizes free community APIs for metadata, artwork, and pricing:

* **IGDB (Twitch Developer Portal)**: Provides rich game descriptions, genres, release dates, and franchises.
* **SteamGridDB**: Delivers high-resolution 2:3 covers, 16:9 hero banners, and transparent logos.
* **Steam Web API**: Enables library sync, achievement tracking, and recently played games.
* **IsThereAnyDeal (ITAD)**: Provides live digital game store pricing and discount alerts.

### How to Configure:
1. Open **Settings** (gear icon in the navigation bar or controller menu).
2. Navigate to the **Integrations** tab.
3. Enter your API keys and click **Save & Protect Credentials**.
4. All keys are encrypted locally using Windows Data Protection API (DPAPI).

---

## 3. Connecting & Syncing Steam

1. In **Settings** $\rightarrow$ **Integrations**, locate the **Steam Integration** card.
2. Enter your **Steam ID64** (a 17-digit number starting with `7656119...`) or your **Custom Vanity URL slug**.
3. Click **Connect Steam Account**.
4. Click **Sync Steam Library** to open the Import Preview Modal.
5. Review titles detected in your account:
   * **New Games**: Games found on Steam that are not yet in your CHECKPOINT library.
   * **Existing in Library**: Games already in your library.
   * **Unmatched Games**: Games that couldn't be automatically mapped to IGDB.
6. Select the games you want to import and click **Import Selected Games**.

> [!NOTE]
> Make sure your Steam Profile and Game Details privacy settings are set to **Public** in the Steam client or website so CHECKPOINT can query your owned titles.

---

## 4. Managing Your Library

* **View Modes**: Switch between **Cover Grid** (2:3 portrait cards), **Compact List** (tabular data), and **Cinematic Library** (scrolling carousel).
* **Filters & Sorting**: Filter by Playing Status (*Currently Playing*, *Completed*, *Planned*, etc.), Ownership (*Owned*, *Subscription*, *Family Shared*), Platform, and Genre.
* **Custom Artwork Selector**: Don't like a cover? Click the artwork icon on any game card or in Game Details to choose alternate community artwork from SteamGridDB.
* **Decoupled Status**: Update your Playing Status independently from your Ownership Status.

---

## 5. Playing & Launching Games

1. Open any game in **Game Details**.
2. Click the **Play Game** button.
3. If the game was imported from Steam, CHECKPOINT automatically launches it via `steam://rungameid/<id>`.
4. For non-Steam games or custom installs:
   * Click **Configure Launch**.
   * Select **Custom Executable**.
   * Browse to or enter the full path to your `.exe` file.
   * Add any optional command-line launch arguments.
5. CHECKPOINT can automatically minimize itself to the taskbar while your game is active and restore itself when you exit.

---

## 6. Automatic Playtime Tracking

CHECKPOINT automatically tracks your gaming sessions without requiring manual start/stop buttons:

* Scans Steam installation folders across all configured hard drives (`libraryfolders.vdf`).
* Detects running game executables in the background while filtering out anti-cheat, crash handlers, and launchers.
* Automatically creates a play session and increments your playtime when you play.
* If your PC restarts or shuts down mid-game, CHECKPOINT recovers the session upon the next launch and prompts you to confirm your time.

---

## 7. Achievements & 100% Completion

* Open **Game Details** and switch to the **Achievements** tab.
* View total unlocked count, remaining achievements, and completion percentage.
* Filter by **Unlocked** or **Locked**, or search achievements by name.
* Secret/spoiler achievements are blurred by default—click to reveal spoiler details.
* When you unlock all achievements, CHECKPOINT suggests marking the game as **100% Completed** without forcibly overwriting your existing status.

---

## 8. Backlog Prioritizer & Kanban

* Navigate to the **Backlog** view.
* **Ranked Queue**: Drag and drop titles or use controller Up/Down buttons to prioritize which game to tackle next. Use "Set as Next Game" to promote any title to #1.
* **Kanban Board**: Drag cards across *Planned*, *Currently Playing*, *On Hold*, and *Completed* columns.

---

## 9. Gaming Planner & Sessions

* Plan upcoming gaming sessions with friends or dedicated backlog sessions.
* View scheduled sessions in **Calendar** or **Timeline** view.
* Conflict detection alerts you if multiple gaming events overlap.

---

## 10. Gaming Journal & Notes

* Keep notes on game builds, puzzle solutions, story impressions, and playthrough milestones.
* Enable the **Spoiler** toggle on sensitive notes to keep text blurred until clicked.
* Rate your experience and tag journal entries to specific games or general thoughts.

---

## 11. Wishlist & Price Tracking

* Add games you want to purchase to your **Wishlist**.
* Set target prices in your preferred currency (e.g., INR, USD, EUR).
* With an IsThereAnyDeal API key configured, CHECKPOINT tracks live store discounts, flags historical lows, and highlights deals that meet your target price.

---

## 12. Big Picture Mode & Controller Usage

* Click the **Big Picture** icon in the header or press your gamepad's Guide button to enter full 10-foot console mode.
* **Navigation**: Use the D-pad or Left Stick to navigate between cards and tabs.
* **Selection**: Press **A** (Xbox) or **Cross** (PlayStation) to select.
* **Back / Dismiss**: Press **B** (Xbox) or **Circle** (PlayStation) to go back or dismiss modals.
* **Virtual Keyboard**: When focusing search inputs in Big Picture Mode, the on-screen virtual keyboard activates for controller typing.

---

## 13. Backups & Data Management

* All your data is saved in `%APPDATA%\Checkpoint\checkpoint.db`.
* In **Settings** $\rightarrow$ **Storage & Diagnostics**:
  * **Online Backup**: Take an immediate, non-blocking backup of your entire library database.
  * **Restore Backup**: Restore from a previous snapshot with automatic safety checkpoints.
  * **Purge Cache**: Clear cached image files to reclaim disk space (images will re-download when needed).
  * **Export Data**: Export a portable JSON file of your game catalog.

---

## 14. Automatic Updates & Software Maintenance

Starting with version 1.1.0, CHECKPOINT features built-in, tamper-proof automatic software updates:
* **Cryptographic Verification**: All update packages are signed using Minisign Ed25519 cryptography to guarantee origin authenticity.
* **Notification Indicator**: An update badge (`ArrowUpCircle`) pulses in the top navigation bar when a new release is available.
* **Update Preferences**: Configure update behavior under **Settings** $\rightarrow$ **Updates & Release**:
  * **Auto-check on startup**: Automatically checks GitHub Releases for new versions.
  * **Check Frequency**: Choose between startup checks or periodic intervals (6h, 12h, 24h, 48h).
  * **Auto-Download**: Download update packages silently in the background.
  * **Defer While Gaming**: Prevents notifications or updates while an active gaming session is in progress.
* **Safe Installation**: Before applying updates, CHECKPOINT automatically generates a pre-migration SQLite safety backup and shuts down background services cleanly to avoid Windows file locks.

---

## 15. Troubleshooting & FAQ

**Q: Why does Windows SmartScreen warn me when running the installer?**  
A: CHECKPOINT is open-source software and is not signed with an enterprise commercial certificate. The software is completely safe and local-first. Click "More info" and "Run anyway".

**Q: Where are my artwork and database files stored?**  
A: In your Windows user directory under `%APPDATA%\Checkpoint\`.

**Q: Can I use CHECKPOINT completely offline?**  
A: Yes! Once metadata and artwork are downloaded, all features, library views, journal notes, and session tracking work without an internet connection.
