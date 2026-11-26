export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface NavCandidate<T = unknown> {
  id: string;
  group: string | null;
  rect: NavRect;
  element: T;
}

function clampOverlapPenalty(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  if (overlap > 0) return 0;
  return Math.abs(overlap);
}

/**
 * Pure 2D geometric spatial raycaster matching docs/CONTROLLER.md §3.1.
 * Picks the nearest focusable target lying within the directional half-plane.
 */
export function findBestSpatialCandidate<T>(
  currentRect: NavRect,
  currentGroup: string | null,
  candidates: NavCandidate<T>[],
  direction: NavDirection,
): NavCandidate<T> | null {
  const curCx = currentRect.left + currentRect.width / 2;
  const curCy = currentRect.top + currentRect.height / 2;

  let best: NavCandidate<T> | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    const r = cand.rect;
    if (r.width <= 0 || r.height <= 0) continue;

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let primaryDelta: number;
    let crossDelta: number;
    let edgeOverlapGap: number;

    if (direction === 'right') {
      if (cx <= curCx + 4) continue;
      edgeOverlapGap = clampOverlapPenalty(currentRect.top, currentRect.bottom, r.top, r.bottom);
      // Ignore items directly above/below in the same column that have no vertical band overlap unless clearly further right
      if (edgeOverlapGap > 0 && r.left < currentRect.right - 8) continue;
      primaryDelta = Math.max(0, r.left - currentRect.right) * 1.2 + (cx - curCx) * 0.4;
      crossDelta = Math.abs(cy - curCy);
    } else if (direction === 'left') {
      if (cx >= curCx - 4) continue;
      edgeOverlapGap = clampOverlapPenalty(currentRect.top, currentRect.bottom, r.top, r.bottom);
      if (edgeOverlapGap > 0 && r.right > currentRect.left + 8) continue;
      primaryDelta = Math.max(0, currentRect.left - r.right) * 1.2 + (curCx - cx) * 0.4;
      crossDelta = Math.abs(cy - curCy);
    } else if (direction === 'down') {
      if (cy <= curCy + 4) continue;
      edgeOverlapGap = clampOverlapPenalty(currentRect.left, currentRect.right, r.left, r.right);
      if (edgeOverlapGap > 0 && r.top < currentRect.bottom - 8) continue;
      primaryDelta = Math.max(0, r.top - currentRect.bottom) * 1.2 + (cy - curCy) * 0.4;
      crossDelta = Math.abs(cx - curCx);
    } else {
      if (cy >= curCy - 4) continue;
      edgeOverlapGap = clampOverlapPenalty(currentRect.left, currentRect.right, r.left, r.right);
      if (edgeOverlapGap > 0 && r.bottom > currentRect.top + 8) continue;
      primaryDelta = Math.max(0, currentRect.top - r.bottom) * 1.2 + (curCy - cy) * 0.4;
      crossDelta = Math.abs(cx - curCx);
    }

    // Strongly favor aligned orthogonal neighbors over skewed diagonal elements
    let score = primaryDelta * 1.0 + crossDelta * 2.0 + edgeOverlapGap * 2.5;

    // Slight intra-group preference keeps carousel/tab/grid rows cohesive before exiting group
    if (currentGroup && cand.group && currentGroup === cand.group && edgeOverlapGap === 0) {
      score -= 18;
    }

    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return best;
}

export function isElementNavigable(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute('aria-disabled') === 'true') return false;
  if (el.dataset.navDisabled === 'true') return false;
  if (el.closest('[aria-hidden="true"]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  const rect = el.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

/**
 * Resolves the active navigation boundary container.
 * Enforces strict focus trapping when any modal dialog, listbox, or virtual keyboard is open.
 */
export function resolveActiveNavScope(): ParentNode {
  if (typeof document === 'undefined') return {} as ParentNode;
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[aria-modal="true"], [data-nav-trap="true"], [role="menu"]',
    ),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  if (overlays.length > 0) {
    // Top-most overlay by DOM/z-index order wins (portals append to body in stack order)
    return overlays[overlays.length - 1]!;
  }
  return document;
}

export function collectNavCandidates(): NavCandidate<HTMLElement>[] {
  const scope = resolveActiveNavScope();
  const elements = Array.from(scope.querySelectorAll<HTMLElement>('[data-nav-item="true"]'));

  return elements
    .filter(isElementNavigable)
    .map((el, idx) => {
      const r = el.getBoundingClientRect();
      const group =
        el.dataset.navGroup ||
        el.closest<HTMLElement>('[data-nav-group]')?.dataset.navGroup ||
        null;
      const id = el.dataset.navId || el.id || `nav-${idx}`;
      return {
        id,
        group,
        rect: {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        },
        element: el,
      };
    });
}

const routeFocusMemory = new Map<string, string>();

export function rememberRouteFocus(routeKey: string, el: HTMLElement | null): void {
  if (!routeKey || !el) return;
  const navId = el.dataset.navId || el.id;
  if (navId) {
    routeFocusMemory.set(routeKey, navId);
  }
}

export function getRememberedRouteFocus(routeKey: string): string | null {
  return routeFocusMemory.get(routeKey) ?? null;
}

export function clearRouteFocusMemory(): void {
  routeFocusMemory.clear();
}

export function scrollElementSmoothlyIntoView(el: HTMLElement, reducedMotion: boolean): void {
  try {
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  } catch {
    el.scrollIntoView();
  }
}
