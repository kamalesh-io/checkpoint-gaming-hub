# CHECKPOINT Gaming Hub — REST API Specification

**Document Version:** 1.0.0  
**Base URL:** `http://127.0.0.1:8765/api/v1`  
**Protocol:** RESTful over HTTP/1.1 (Local Loopback)  
**Security:** `X-Checkpoint-Token` handshake verification  
**Format:** JSON (`application/json`)  

---

## 1. Global API Standards & Envelope

### 1.1 Local Authentication Handshake
To prevent unauthorized local background processes on the user's PC from querying or mutating the game library, every request from the Tauri WebView2 client must supply the ephemeral handshake header generated during boot:

```http
X-Checkpoint-Token: 4a2b9e6c-f1d8-4903-87bb-9964522a1012
```

### 1.2 Standard Success Envelope & Pagination
Endpoints returning collections use standard pagination parameters (`limit`, `offset`):

```json
{
  "data": [ ... ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

Single-resource endpoints return the resource object directly or in a `data` block.

### 1.3 Standard Error Format (RFC 7807)
```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "The requested library entry does not exist.",
    "details": {
      "id": "e8d98d24-345f-402a-9e19-123456789abc"
    }
  }
}
```

---

## 2. API Endpoints by Domain

---

### 2.1 System & Core Status

#### `GET /system/health`
Health check and backend status probe queried by Tauri during launch.
* **Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "storage_dir": "C:\\Users\\User\\AppData\\Roaming\\Checkpoint",
  "uptime_seconds": 124.5
}
```

#### `GET /system/stats`
Aggregated statistics for dashboard summary tiles.
* **Response (200 OK):**
```json
{
  "total_library_games": 11,
  "completed_games": 4,
  "total_hours_logged": 312.5,
  "backlog_count": 5,
  "hours_by_genre": {
    "Action RPG": 142.0,
    "FPS": 64.5,
    "Open World": 106.0
  },
  "games_by_platform": {
    "Steam": 7,
    "GOG": 2,
    "Epic Games": 1,
    "Ubisoft": 1
  }
}
```

#### `POST /system/credentials`
Persists user-supplied IGDB / Twitch and SteamGridDB credentials to `%APPDATA%/Checkpoint/credentials.json`, updates runtime settings in memory, invalidates any stale Twitch token cache, and returns the updated `IntegrationStatus`.
* **Request Body:**
```json
{
  "igdb_client_id": "string (optional)",
  "igdb_client_secret": "string (optional)",
  "steamgriddb_api_key": "string (optional)"
}
```
* **Response (200 OK):**
```json
{
  "igdb_connected": true,
  "steamgriddb_connected": true,
  "twitch_token_active": false,
  "details": {
    "igdb": "Credentials configured",
    "steamgriddb": "API Key configured"
  }
}
```

#### `POST /system/shutdown`
Triggers a clean, graceful shutdown of the Uvicorn sidecar server process.
* **Response (200 OK):**
```json
{
  "status": "shutting_down"
}
```

#### Tauri Sidecar IPC Commands (`src-tauri/src/lib.rs`)
* `get_local_api_config`: Returns `{ "baseUrl": "http://127.0.0.1:<port>/api/v1", "token": "<ephemeral-hex>" }`.
* `get_backend_status`: Returns `{ "status": "initializing" | "ready" | "error", "port": <u16 | null>, "baseUrl": "...", "message": "..." }`.
* `restart_backend`: Stops any existing sidecar instance cleanly, spawns a fresh sidecar process, awaits `CHECKPOINT_READY=<port>` and authenticated health verification, and returns the new `LocalApiConfig`.

#### `POST /system/backup`
Triggers an immediate snapshot of the SQLite database and metadata.
* **Response (200 OK):**
```json
{
  "backup_file": "C:\\Users\\User\\Documents\\Checkpoint Backups\\checkpoint_backup_20261124_203000.sqlite",
  "size_bytes": 4194304,
  "timestamp": "2026-11-24T20:30:00Z"
}
```

#### `POST /system/restore`
Restores database state from a user-supplied `.sqlite` or `.json` backup file.

---

### 2.2 Search & External Catalog Discovery

#### `GET /search/igdb?q={query}&limit={limit}`
Queries the IGDB catalog via the backend's cached Twitch OAuth token.
* **Query Parameters**:
  * `q` (string, required): Game title query (e.g., `Cyberpunk`).
  * `limit` (int, optional, default: 10, max: 25).
* **Response (200 OK):**
```json
{
  "data": [
    {
      "igdb_id": 1877,
      "title": "Cyberpunk 2077",
      "slug": "cyberpunk-2077",
      "category": "base_game",
      "release_year": 2020,
      "developer": "CD PROJEKT RED",
      "publisher": "CD PROJEKT RED",
      "genres": ["Action RPG", "Open World"],
      "platforms": ["PC", "PlayStation 5", "Xbox Series"],
      "igdb_rating": 86.4,
      "cover_url": "https://images.igdb.com/igdb/image/upload/t_cover_big/co2lbd.jpg",
      "in_library": true,
      "library_entry_id": "7fc70849-5bd0-9926-a1b2-c3d4e5f60718"
    },
    {
      "igdb_id": 215434,
      "title": "Cyberpunk 2077: Phantom Liberty",
      "slug": "cyberpunk-2077-phantom-liberty",
      "category": "expansion",
      "release_year": 2023,
      "developer": "CD PROJEKT RED",
      "publisher": "CD PROJEKT RED",
      "genres": ["Action RPG", "Spy-Thriller"],
      "platforms": ["PC", "PlayStation 5", "Xbox Series"],
      "igdb_rating": 89.2,
      "cover_url": "https://images.igdb.com/igdb/image/upload/t_cover_big/co6tms.jpg",
      "in_library": false,
      "library_entry_id": null
    }
  ]
}
```

#### `GET /search/igdb/{igdb_id}`
Retrieves complete game synopsis, storyline, developers, publishers, and genre associations.

#### `GET /search/steamgriddb/{game_id}`
Fetches alternative portrait grids (2:3), landscape heroes (16:9), and transparent logos available for a game from SteamGridDB.
* **Response (200 OK):**
```json
{
  "grids": [
    { "id": 101, "url": "https://cdn2.steamgriddb.com/grid/abc.jpg", "width": 600, "height": 900, "thumb": "https://cdn2.steamgriddb.com/thumb/abc.jpg" }
  ],
  "heroes": [
    { "id": 201, "url": "https://cdn2.steamgriddb.com/hero/def.jpg", "width": 1920, "height": 1080, "thumb": "https://cdn2.steamgriddb.com/thumb/def.jpg" }
  ],
  "logos": [
    { "id": 301, "url": "https://cdn2.steamgriddb.com/logo/ghi.png", "width": 800, "height": 300, "thumb": "https://cdn2.steamgriddb.com/thumb/ghi.png" }
  ]
}
```

---

### 2.3 Library & Game Management

#### `GET /library`
Fetches the user's game library with comprehensive filtering and sorting.
* **Query Parameters**:
  * `status`: Filter by `Planned`, `Currently Playing`, `On Hold`, `Completed`, `100% Completed`, `Dropped`.
  * `platform`: Filter by `Steam`, `GOG`, `Epic Games`, `PlayStation`, `Xbox`, etc.
  * `priority`: Filter by `High`, `Medium`, `Low`.
  * `sort`: `recently_played`, `title_asc`, `progress_desc`, `priority_desc`.
  * `q`: Search query string filtering title or tags.
  * `limit`: Page size (default 50).
  * `offset`: Page offset (default 0).
* **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "e8d98d24-345f-402a-9e19-123456789abc",
      "game_id": "44c05c27-85b8-1842-bcde-9876543210fe",
      "title": "Elden Ring",
      "slug": "elden-ring",
      "playing_status": "Currently Playing",
      "ownership_status": "Owned",
      "platform": "Steam",
      "priority": "High",
      "queue_position": 1,
      "progress_pct": 68.0,
      "hours_played": 84.5,
      "personal_rating": 9.5,
      "completion_goal": "Main + Side Quests",
      "planned_start_date": "2026-10-01",
      "target_completion_date": "2026-12-15",
      "custom_tags": ["soulslike", "goty", "masterpiece"],
      "is_favorite": true,
      "artwork": {
        "cover_url": "/api/v1/artwork/cache/44c05c2785b81842.webp",
        "hero_url": "/api/v1/artwork/cache/9ae120652e226b77.webp",
        "logo_url": "/api/v1/artwork/cache/logo_elden_ring.png"
      },
      "active_accent": "accent-gold"
    }
  ],
  "meta": { "total": 11, "limit": 50, "offset": 0 }
}
```

#### `POST /library`
Imports a new title into the library, initiating automated artwork acquisition in the background.
* **Request Body:**
```json
{
  "igdb_id": 215434,
  "playing_status": "Planned",
  "ownership_status": "To Buy",
  "platform": "GOG",
  "priority": "High",
  "completion_goal": "Main Story",
  "planned_start_date": "2026-12-01",
  "target_completion_date": "2026-12-20",
  "custom_tags": "sci-fi, spy-thriller, winter-sale",
  "notes": "Pick up during GOG Winter Sale."
}
```
* **Response (201 Created):** Full created `LibraryEntry` object with local ID.

#### `GET /library/{id}`
Retrieves complete game hub details including play sessions, journal notes, and active artwork.

#### `PATCH /library/{id}`
Updates status, progress, hours, or personal rating.
* **Request Body:**
```json
{
  "progress_pct": 72.5,
  "hours_played": 88.0,
  "playing_status": "Currently Playing"
}
```

#### `DELETE /library/{id}`
Deletes game from library. Query param `purge_artwork=true` cleans cached disk assets.

---

### 2.4 Play Sessions & Journal Notes

#### `POST /library/{id}/sessions`
Logs a manual gaming session.
* **Request Body:**
```json
{
  "session_date": "2026-11-24T15:30:00Z",
  "duration_minutes": 150,
  "location_or_chapter": "Leyndell Royal Capital",
  "notes": "Defeated Morgott at Level 92 with Faith build."
}
```
* **Response (201 Created):** Created `PlaySession` record.

#### `POST /library/{id}/journal`
Creates a rich markdown journal entry.
* **Request Body:**
```json
{
  "title": "Morgott Victory & Build Respec",
  "content_markdown": "Respec into Faith/Dex before Mountaintops of the Giants...",
  "entry_date": "2026-11-24T18:00:00Z"
}
```

---

### 2.5 Artwork Cache Delivery

#### `GET /artwork/cache/{sha256_hash}.webp`
Serves cached portrait covers and landscape hero assets from the local Windows AppData directory with high-performance HTTP caching headers (`Cache-Control: public, max-age=31536000, immutable`).

#### `POST /artwork/select`
Sets an alternative SteamGridDB artwork as the active presentation asset for a game.
* **Request Body:**
```json
{
  "game_id": "44c05c27-85b8-1842-bcde-9876543210fe",
  "asset_type": "cover",
  "steamgriddb_url": "https://cdn2.steamgriddb.com/grid/f0f231184a8b13d0.jpg"
}
```
* Downloads, hashes, stores locally, and updates `game_artworks.is_active`.

---

### 2.6 Backlog Prioritization & Reordering

#### `GET /backlog`
Returns ordered backlog queue with priority, queue position, target dates, and notes.
* Query params: `status`, `priority`.

#### `POST /backlog/reorder`
Updates backlog ranks transactionally.
* **Request Body:**
```json
{
  "ordered_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

#### `POST /backlog/{id}/set-next`
Promotes a specific game to queue position #1 and pushes subsequent items down.

---

### 2.7 Gaming Planner

#### `GET /planner/sessions`
Returns scheduled gaming sessions. Supports `start_date`, `end_date`, and `status` query filters.

#### `POST /planner/sessions`
Schedules a session with conflict detection.
* **Request Body:**
```json
{
  "game_id": "uuid",
  "scheduled_start": "2026-11-26T18:00:00Z",
  "scheduled_end": "2026-11-26T20:30:00Z",
  "notes": "Co-op session with team",
  "repeat_rule": "Weekly",
  "reminder_minutes_before": 15
}
```

#### `PATCH /planner/sessions/{id}` & `DELETE /planner/sessions/{id}`
Modifies, marks completed/cancelled, or deletes scheduled sessions.

---

### 2.8 Active Play Sessions & Crash Recovery

#### `POST /sessions/active/start`
Starts a live session timer HUD (`game_id`). Returns active session record.

#### `GET /sessions/active/current`
Checks for ongoing or unfinalized sessions. If an unfinalized session is found from a previous run, the UI triggers the recovery modal.

#### `POST /sessions/active/pause` & `POST /sessions/active/resume`
Toggles paused state on the live timer without losing accumulated seconds.

#### `POST /sessions/active/end`
Finalizes the active session, commits duration to `play_sessions` and `library_entries.hours_played`, and cleans up the active session tracker.

---

### 2.9 Collections & Franchises

#### `GET /collections`, `POST /collections`, `PATCH /collections/{id}`, `DELETE /collections/{id}`
Manages custom user collections/playlists. Deleting a collection cascades strictly to membership items, preserving library games.

#### `POST /collections/{id}/items` & `DELETE /collections/{id}/items/{library_entry_id}`
Adds or removes games from custom collections with custom display order.

#### `GET /franchises/{id}/games` & `POST /franchises/{id}/order`
Manages franchise games and user-defined custom play order.

---

### 2.10 Gaming Journal & Statistics

#### `GET /journal`, `POST /journal`, `PATCH /journal/{id}`, `DELETE /journal/{id}`
Full journal management supporting spoiler blurring, milestone tags, personal ratings, and game associations.

#### `GET /stats/overview`
Honest telemetry endpoint providing:
- Library status breakdown
- Hours by genre (with multi-genre disclaimer)
- 365-day daily activity heatmap matrix
- Monthly playtime trends
- Top played games and platform breakdown

---

### 2.11 Database Backup & Restore

#### `POST /system/backup`
Performs a WAL-safe online snapshot using SQLite's native backup API into `%APPDATA%/Checkpoint/backups/checkpoint_backup_{timestamp}.db`.

#### `GET /system/backups`
Lists available backup snapshots with file sizes and creation timestamps.

#### `POST /system/restore`
Restores database from a selected backup snapshot, automatically creating a safety rollback backup beforehand.

#### `GET /system/export` & `POST /system/import`
Portable JSON import/export excluding local secrets and machine-specific file paths.
