# CHECKPOINT Gaming Hub — Comprehensive Testing Strategy

**Document Version:** 1.0.0  
**Status:** Approved Quality Assurance & Testing Plan  
**Testing Frameworks:** Pytest (Backend) + Vitest & React Testing Library (Frontend) + Playwright (E2E & Desktop)  

---

## 1. Testing Pyramid & Quality Standards

```
                     / \
                    /   \
                   / E2E \       Playwright for Tauri Desktop (10%)
                  /-------\      End-to-End User Journeys & Mode Switches
                 /         \
                /  INTEG    \    API & Component Integration (30%)
               /-------------\   FastAPI TestClient + Simulated Gamepad
              /               \
             /    UNIT TESTS   \ Pytest & Vitest Unit Tests (60%)
            /-------------------\ Domain Logic, Stores, Schema Validation
```

### Core Testing Mandates
1. **Zero Secret Leaks**: Test suites must never load production secrets or print credentials. Tests use mock fixtures and in-memory databases.
2. **Deterministic Offline Execution**: 100% of unit and integration tests must run without requiring live network connections to IGDB or SteamGridDB.
3. **Controller Navigation Verification**: Spatial navigation algorithms and input deadzones must be verified with automated synthetic controller vectors.
4. **Visual & Performance Benchmarks**: Carousel transitions and hero crossfades must maintain 60fps without layout shifts.

---

## 2. Backend Testing Strategy (`pytest`)

### 2.1 Database & Migrations
* **Isolated In-Memory Testing**: Tests run against an isolated SQLite test database using an async in-memory SQLite connection (`sqlite+aiosqlite:///:memory:`).
* **Alembic Migration Verification**: Automated test runs all Alembic migrations to `head`, verifies schema integrity, runs `downgrade(-1)`, and verifies rollback safety.
* **Constraints Verification**: Explicit tests verifying:
  * Progress percentage bounds (`0.0 <= progress_pct <= 100.0`).
  * Rating bounds (`0.0 <= personal_rating <= 10.0`).
  * Enforced status enums (Playing Status, Ownership Status, Priority).

### 2.2 External API Mocking via HTTPX
* **IGDB Client Mocking**: Mocking Twitch OAuth token negotiation and query responses using HTTPX's `MockTransport`.
* **Rate Limiter Concurrency Test**: Validating that concurrent bursts of 20 search requests are safely throttled to no more than 4 requests per second.
* **Image Caching & Security Validation**:
  * Testing SHA-256 deduplication of identical images.
  * Verifying image magic byte validation (rejecting non-image payloads).
  * Testing path traversal attempt rejection (`resolve_safe_cache_path`).

### 2.3 API Endpoint Contract Testing
Using FastAPI's `httpx.AsyncClient`:
* Testing library CRUD operations, filter parameters, and pagination offsets.
* Verifying that requests lacking the `X-Checkpoint-Token` receive a `401 Unauthorized` response.
* Verifying RFC 7807 problem details formatting on 404 and 422 errors.

---

## 3. Frontend Testing Strategy (`vitest` + React Testing Library)

### 3.1 Zustand Store Unit Tests
* **`gamepadStore`**: Verifying active controller identification (Xbox vs. PlayStation), focused element assignment, and glyph updates.
* **`themeStore`**: Verifying that selecting a game dynamically transitions the active theme accent (e.g., Elden Ring $\rightarrow$ `#E0B45A`, Cyberpunk 2077 $\rightarrow$ `#F5DF4D`).
* **`libraryStore`**: Verifying active view mode toggles (`grid`, `list`, `cinematic`), status filters, and card size slider math.

### 3.2 Component Unit Tests
* **`Card`**: Verifies full-bleed 2:3 aspect ratio, hover overlay reveal, and progress bar rendering.
* **`Modal`**: Verifies focus trapping within `aria-modal="true"` dialogs, Escape key listener, and click-outside dismissal.
* **`Tabs`**: Verifies horizontal tab switching and keyboard arrow key navigation.
* **`Button`**: Verifies primary, secondary, icon, and disabled states.

---

## 4. Controller & Spatial Navigation Engine Testing

### 4.1 Synthetic Gamepad Mocking
A custom test utility mocks the Web Gamepad API:

```typescript
export function createMockGamepad(options: {
  buttons?: number[];
  axes?: [number, number, number, number];
  id?: string;
}): Gamepad {
  return {
    id: options.id || 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
    index: 0,
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: (options.buttons || []).includes(i),
      touched: (options.buttons || []).includes(i),
      value: (options.buttons || []).includes(i) ? 1.0 : 0.0,
    })),
    axes: options.axes || [0, 0, 0, 0],
    timestamp: performance.now(),
  };
}
```

### 4.2 Automated Test Scenarios
1. **Deadzone Math Test**:
   * Simulates an analog stick axis at `(0.12, 0.08)` (below 0.15 threshold). Verifies normalized output is `(0, 0)` with no navigation events emitted.
   * Simulates an analog stick axis at `(0.8, 0.6)`. Verifies correct directional event calculation.
2. **Spatial 2D Raycaster Test**:
   * In a 3×3 grid of game cards, starting from `(0, 0)` and triggering `D-Pad Right` correctly navigates to `(1, 0)`.
   * From `(1, 0)` triggering `D-Pad Down` correctly focuses `(1, 1)`.
3. **Focus Trap Test**:
   * Opens the `AddGameModal`.
   * Simulates D-pad navigation. Verifies focus never moves to elements behind the modal backdrop.
   * Simulates pressing `B` / `Circle`. Verifies modal closes and focus returns to the initiating button.

---

## 5. End-to-End (E2E) Testing Strategy (Playwright)

Automated E2E tests run against the built desktop application frame:

### Journey 1: Game Discovery & Import Workflow
1. App launches into Overview Dashboard.
2. Navigate to `Discover & Search` via sidebar.
3. Type `"Cyberpunk"` into the search input.
4. Verify search results populate with both the base game and expansion.
5. Click `+ Add to Library` on the expansion.
6. Verify `Add Game Modal` opens with pre-filled cover art and title.
7. Change Playing Status to `Planned`, Ownership to `To Buy`, Priority to `High`.
8. Click `Add to Library`.
9. Navigate to `My Library`. Verify the new game appears with active accent styling.

### Journey 2: 10-Foot Big Picture Experience
1. Trigger Big Picture Mode (`F11` or Gamepad View button).
2. Verify window transitions to borderless fullscreen with top console navigation.
3. Simulate D-Pad navigation through the horizontal game carousel.
4. Verify hero backdrop updates smoothly and focus rings snap to the active card (`scale-[1.04]`).
5. Press `A` / `Cross` on the focused title.
6. Verify navigation to the Game Details view.
7. Press `B` / `Circle` to return to the carousel.

---

## 6. Performance & Frame Rate Verification

* **Lighthouse / Web Vitals in WebView**:
  * First Contentful Paint: < 600ms.
  * Cumulative Layout Shift (CLS): 0.00.
* **FPS Monitoring**:
  * Using Chrome DevTools Protocol to measure FPS during a 10-cycle automated carousel hot-swap loop.
  * Frame rate must remain above 58 fps throughout all 500ms hero transitions.
