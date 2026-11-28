# CHECKPOINT Gaming Hub — Design System & Visual Specification

**Design System Name:** CHECKPOINT V3 — Cinematic Living-Room Gaming Interface  
**Visual Source of Truth:** V1.1.0 Reference Console Layout (PlayStation 5 & Steam Big Picture inspired)  
**Status:** Active Production Design System Baseline  

---

## 1. Design Philosophy & Influences

CHECKPOINT V3 replaces utilitarian spreadsheet tables, generic SaaS dashboards, and permanent vertical navigation sidebars with an immersive, console-inspired interface:

* **PlayStation 5**: Atmospheric dynamism where the currently selected game dictates the entire viewport's lighting, background art, and primary UI accent. Clean white pill primary buttons, translucent dark pills, and subtle circular controls.
* **Floating Capsule Dock**: Centered translucent bottom dock replacing the permanent sidebar, maximizing horizontal game poster display space.
* **Web Audio Procedural Soundscapes**: Subtle electronic UI audio cues (navigation tick, confirm chime, modal sweeps, game launch thumps, trophy chords) synthesized entirely client-side via the Web Audio API.
* **Epic Games Store & Steam**: High-impact full-bleed 2:3 vertical covers and 16:9 landscape carousels with glowing active rings and live telemetry badges.
* **Ergonomic 10-Foot Spatial Navigation**: Full controller and keyboard navigation with focus trapping, visual spatial focus rings, and On-Screen Virtual Keyboard.

---

## 2. Design Tokens & Visual Hierarchy

### 2.1 Color Tokens & Atmospheric Depth

Instead of flat black (`#000000`) or legacy navy blue, CHECKPOINT V3 utilizes a charcoal surface progression:

```yaml
colors:
  # Base Canvas & Surface Tiers
  background: "#0C0F12"              # Deep charcoal canvas viewport
  on-background: "#F5F5F7"           # High-contrast primary text
  secondary-background: "#14181D"   # Sub-panels, filter bars, list rows
  on-secondary-background: "#F5F5F7"
  surface: "#1A1F26"                 # Cards, standard containers, input fields
  on-surface: "#F5F5F7"
  surface-elevated: "#1E2329"        # Floating modals, popovers, active tiles
  on-surface-elevated: "#F5F5F7"
  outline: "#2A2F38"                 # Subtle dividers and unfocused borders
  muted: "#A7ABB4"                   # Secondary labels, metadata, captions
  dock: "#14181D"                    # Floating bottom navigation capsule
  dock-border: "#2A2F38"             # Floating dock capsule border

  # System Primary Accent
  primary: "#66B8FF"                 # Sky-blue default for global buttons & focus
  on-primary: "#0C0F12"

  # Dynamic Game-Adaptive Accents
  accent-gold: "#E0B45A"             # Elden Ring (antique fantasy gold)
  on-accent-gold: "#0C0F12"
  accent-amber: "#F09B4B"            # Metro Exodus (apocalyptic warm amber)
  on-accent-amber: "#0C0F12"
  accent-blue: "#5BA8FF"             # Watch Dogs (cyberpunk sapphire)
  on-accent-blue: "#0C0F12"
  accent-yellow: "#F5DF4D"           # Cyberpunk 2077 (neon yellow)
  on-accent-yellow: "#0C0F12"
```

### 2.2 Typography Scale

CHECKPOINT V3 uses **Plus Jakarta Sans** for display and headline elements, paired with **DM Sans** for interface labels, captions, and body text.

```yaml
fonts:
  display: "Plus Jakarta Sans Variable, Plus Jakarta Sans, sans-serif"
  headline: "Plus Jakarta Sans Variable, Plus Jakarta Sans, sans-serif"
  body: "DM Sans Variable, DM Sans, sans-serif"
  label: "DM Sans Variable, DM Sans, sans-serif"
```
  on-accent-amber: "#111722"
  accent-blue: "#5BA8FF"             # Watch Dogs (cybernetic tech blue)
  on-accent-blue: "#111722"
  accent-yellow: "#F5DF4D"           # Cyberpunk 2077 (high-voltage neon yellow)
  on-accent-yellow: "#111722"

  # Status Indicators
  success: "#52D6A0"                 # Completed (100%), DualSense Connected
  on-success: "#111722"
  warning: "#F4BD62"                 # On Hold status
  on-warning: "#111722"
  error: "#F16D7A"                   # Dropped, Destructive actions, Close button
  on-error: "#111722"
```

### 2.2 Typography Scale (Sora + Inter)

* **Display & Headlines (`Sora`)**: Modern, geometric, bold headings with personality.
* **Body, Controls & Tabular Data (`Inter`)**: Clean, readable sans-serif with neutral letterforms and tabular numeric alignment for hours and percentages.

```yaml
typography:
  display-lg:
    fontFamily: "Sora"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 62px
    letterSpacing: -0.025em
  display-md:
    fontFamily: "Sora"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 54px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Sora"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: "Sora"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: "Sora"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: "Inter"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: "Inter"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: "Inter"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: "Inter"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: "Inter"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: 0em
  label-sm:
    fontFamily: "Inter"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.01em
```

### 2.3 Spacing, Radii & Shadows

* **Spacing Grid**: `xs: 4px`, `sm: 8px`, `md: 12px`, `lg: 16px`, `xl: 24px`, `2xl: 32px`, `3xl: 48px`.
* **Border Radii**:
  * `sm: 8px` (Dropdown items, inputs, mini thumbnails)
  * `DEFAULT: 10px` (Action buttons, standard cards)
  * `md: 12px` (Game capsule cards)
  * `lg: 14px` (Large cover tiles, feature cards)
  * `xl: 16px` (Modals, preview panels, hero containers)
  * `full: 9999px` (Pills, badges, avatars, controller status dots)
* **Shadows**:
  * Card standard: `0 8px 24px -4px rgba(0, 0, 0, 0.4)`
  * Card hover focus: `0 16px 36px -2px rgba(0, 0, 0, 0.65)`
  * Modal elevation: `0 25px 50px -12px rgba(0, 0, 0, 0.85)`

---

## 3. Approved Stitch Screen References

### Screen 1: Overview Dashboard (`node_7560982411466141303`)
* **Role**: Primary landing page for Desktop Mode.
* **Layout Structure**:
  * Persistent 240px (`w-60`) collapsible sidebar on the left.
  * Floating top bar (Search input, "+ Quick Add Game", Windows window buttons).
  * Atmospheric 16:9 Hero section (`min-h-[600px]`) with dual-direction gradient scrims.
  * 3-card horizontal carousel for "Currently Playing" titles with live dynamic accent switching.
  * "Up Next" 6-column shelf featuring 2:3 vertical covers.
  * Bottom split shelf for "Upcoming Schedule" and "Recently Completed".
* **Key Visual Interactions**:
  * Clicking any tile in the Currently Playing carousel instantly updates the background hero artwork, changes the screen accent color, updates the title/genre text, and animates the progress bar.

### Screen 2: My Library (`node_11825741054726113468`)
* **Role**: Complete game catalog browser with multi-mode viewing.
* **Layout Structure**:
  * Pinned left navigation sidebar.
  * Sub-header with title and a 3-way view mode switcher:
    1. **Cover Grid**: 2:3 portrait cards with hover reveals of playtime and store source.
    2. **Compact List**: Tabular view with 10×14 thumbnails, status pills, and % progress.
    3. **Cinematic Library**: 16:9 hero banner with immediate launch actions.
  * Filter & Sort strip (Status, Platform, Franchise, Sorting order, and Card Zoom slider).

### Screen 3: Discover & Search (`node_3615176587439076172`)
* **Role**: Global game discovery and direct import interface.
* **Layout Structure**:
  * Prominent large search bar for querying the IGDB database.
  * 12-column split layout:
    * **Left (6 cols)**: Search result cards displaying 2:3 cover, base/expansion type, and "In Library" verification badge or "+ Add to Library" CTA.
    * **Right (6 cols)**: Interactive cinematic game inspection preview featuring 16:9 backdrop, game synopsis, dual gameplay screenshots, and wishlist/import actions.

### Screen 4: Add Game Modal (`node_1690973268804908050`)
* **Role**: Controller-navigable modal for adding or editing a game.
* **Layout Structure**:
  * Darkened ambient background (`bg-background/85`).
  * Centered 12-column dialog container:
    * **Left (4 cols)**: Large 2:3 portrait cover, title, publisher, and architecture motto ("Playing status and ownership are tracked independently").
    * **Right (8 cols)**: Form controls (Playing Status, Ownership Status, Platform, Priority 3-button selector, Start/Target dates, Collection, Tags, Personal Note).
  * Footer with controller navigation legend (`D-Pad Navigate • A Select • B Cancel`).

### Screen 5: Game Details (`node_15046847052060341106`)
* **Role**: PlayStation 5-style deep-dive game hub.
* **Layout Structure**:
  * Contextual header with `<- Back to Library` and `SteamGridDB Artwork` picker button.
  * Upper hero banner featuring a large 2:3 portrait cover overlapping a 16:9 atmospheric backdrop.
  * Horizontal sub-tabs: Overview, Progress, Notes, Screenshots, Play Sessions, Achievements.
  * 12-column split layout:
    * **Main content (8 cols)**: Tab panel content (synopsis, goal selection, journal notes).
    * **Sidebar (4 cols)**: "Your Journey" summary card (completion %, priority, hours logged, rating, target date).
  * Integrated dialog modal for selecting alternative covers, heroes, and logos from SteamGridDB.

### Screen 6: Big Picture Mode (`node_11731173976490379291`)
* **Role**: Fullscreen 10-foot television/console interface.
* **Layout Structure**:
  * Borderless fullscreen viewport.
  * Minimal top navigation header (`Home`, `Library`, `Discover`, `Backlog`, `Planner`, `DualSense Connected`, `Desktop Mode`).
  * Lower-third focus area with active game title, completion %, description, and primary CTAs.
  * 4-card horizontal 16:9 carousel with `ring-4` active accent highlight and `scale-[1.04]`.
  * Bottom controller button glyph bar (`(A) Open Game`, `(X) Update Progress`, `(Y) Search Catalog`, `(B) Back`).

---

## 4. Atmospheric Gradient Scrim Technique

To ensure maximum legibility of white and accent text over variable game artwork, CHECKPOINT V2 applies a **dual-directional gradient scrim** over all 16:9 hero backdrops:

```html
<!-- Atmospheric Hero Backdrop Container -->
<div class="relative min-h-[600px] overflow-hidden">
  <img src="artwork.jpg" class="absolute inset-0 w-full h-full object-cover" />
  
  <!-- Scrim 1: Bottom-to-Top Fade into #111722 -->
  <div class="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-background/30"></div>
  
  <!-- Scrim 2: Left-to-Right Fade (Protects title & metadata on left) -->
  <div class="absolute inset-0 bg-gradient-to-r from-background/95 via-background/55 to-transparent"></div>
  
  <!-- Content rendered cleanly above scrims -->
  <div class="relative z-10 p-2xl">...</div>
</div>
```

---

## 5. Animation & Micro-interaction Tokens

All animations must maintain a smooth 60fps on modern Windows desktop GPUs using CSS transitions or hardware-accelerated Motion/GSAP:

```yaml
motion:
  # Fast state toggles (checkboxes, button presses, tab borders)
  state-change:
    duration: 140ms
    timingFunction: "ease-out"

  # Game card hover & controller focus
  card-hover:
    duration: 200ms
    timingFunction: "cubic-bezier(0.2, 0, 0, 1)"
    transform: "scale(1.03)"

  # Cinematic hero backdrop crossfade
  hero-transition:
    duration: 500ms
    timingFunction: "cubic-bezier(0.22, 1, 0.36, 1)"

  # Dialog and modal entry
  modal-enter:
    duration: 240ms
    timingFunction: "cubic-bezier(0.2, 0, 0, 1)"
    scaleInitial: 0.96
    opacityInitial: 0
```

---

## 6. Design Tasks for Missing Screens

The following secondary views must be developed adhering strictly to the CHECKPOINT V2 design system:

1. **Backlog Prioritization Board**:
   * Uses `#151D2A` columns for High, Medium, and Low priorities with 2:3 card drag targets.
2. **Gaming Planner & Calendar**:
   * Dark `#1B2636` calendar grid with session cards matching the game's active accent color.
3. **Wishlist View**:
   * 2:3 grid with target purchase prices and store badges (Steam, GOG, Epic, PSN).
4. **Collections View**:
   * Wide horizontal header cards with 16:9 collage banners for user-created groupings.
5. **On-Screen Keyboard (OSK)**:
   * 10-foot controller grid with A/B/X/Y shortcuts, QWERTY layout, and auto-focus for search inputs.
