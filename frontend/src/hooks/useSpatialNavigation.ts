import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/routes';
import { controllerManager } from '@/services/gamepad/controllerManager';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import {
  collectNavCandidates,
  findBestSpatialCandidate,
  getRememberedRouteFocus,
  rememberRouteFocus,
  resolveActiveNavScope,
  scrollElementSmoothlyIntoView,
} from '@/services/spatialNav/spatialEngine';
import { useAppStore } from '@/stores/appStore';
import { useControllerStore } from '@/stores/controllerStore';

export const CONTROLLER_CUSTOM_EVENT = 'checkpoint://controller-action';

function isTextInputElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const input = el as HTMLInputElement;
  const t = (input.type || 'text').toLowerCase();
  return t === 'text' || t === 'search' || t === 'password' || t === 'url' || t === 'email';
}

function dispatchValueChange(
  el: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string,
): void {
  const proto =
    el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(el, nextValue);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findScrollableContainer(startEl: Element | null): HTMLElement | null {
  let curr: HTMLElement | null = startEl as HTMLElement | null;
  while (curr && curr !== document.body) {
    const style = window.getComputedStyle(curr);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      curr.scrollHeight > curr.clientHeight + 8
    ) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return document.getElementById('checkpoint-main-viewport') ?? document.documentElement;
}

function moveSpatialFocus(
  direction: 'up' | 'down' | 'left' | 'right',
  pathname: string,
  reducedMotion: boolean,
): boolean {
  const activeEl = document.activeElement as HTMLElement | null;
  const candidates = collectNavCandidates();
  if (candidates.length === 0) return false;

  const scope = resolveActiveNavScope();
  const activeInScope =
    activeEl &&
    activeEl !== document.body &&
    (scope === document || (scope as Element).contains(activeEl)) &&
    candidates.some((c) => c.element === activeEl);

  if (!activeInScope) {
    const initial =
      candidates.find((c) => c.element.dataset.navPrimary === 'true') ??
      candidates.find((c) => !c.element.closest('aside')) ??
      candidates[0];
    if (initial) {
      initial.element.focus({ preventScroll: true });
      scrollElementSmoothlyIntoView(initial.element, reducedMotion);
      return true;
    }
    return false;
  }

  const curCand = candidates.find((c) => c.element === activeEl);
  if (!curCand) return false;

  const next = findBestSpatialCandidate(
    curCand.rect,
    curCand.group,
    candidates.filter((c) => c.element !== activeEl),
    direction,
  );

  if (next) {
    next.element.focus({ preventScroll: true });
    scrollElementSmoothlyIntoView(next.element, reducedMotion);
    rememberRouteFocus(pathname, next.element);
    return true;
  }
  return false;
}

/**
 * Mounts the global controller service and bridges normalized actions to DOM spatial focus,
 * route navigation, tab cycling, scrolling, modal dismiss, and On-Screen Virtual Keyboard.
 */
export function useGlobalControllerNavigation(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    controllerManager.start();
    return () => controllerManager.stop();
  }, []);

  // Enable physical Keyboard arrow-key 2D spatial navigation alongside gamepad input
  useEffect(() => {
    const arrowMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const dir = arrowMap[e.key];
      if (!dir) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (
        isTextInputElement(activeEl) ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable ||
        (activeEl instanceof HTMLInputElement && activeEl.type === 'range')
      ) {
        return;
      }

      const moved = moveSpatialFocus(
        dir,
        location.pathname,
        useAppStore.getState().reducedMotion,
      );
      if (moved) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.pathname]);

  // Remember focus per route whenever an interactive nav item gains focus
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset?.navItem === 'true' && !target.closest('[aria-modal="true"]')) {
        rememberRouteFocus(location.pathname, target);
      }
    };
    window.addEventListener('focusin', onFocusIn);
    return () => window.removeEventListener('focusin', onFocusIn);
  }, [location.pathname]);

  // Restore focus cleanly when returning to a route in controller/keyboard mode
  useEffect(() => {
    const mode = useControllerStore.getState().activeInputDevice;
    if (mode !== 'controller') return;

    const timer = window.setTimeout(() => {
      const rememberedId = getRememberedRouteFocus(location.pathname);
      const candidates = collectNavCandidates();
      if (candidates.length === 0) return;

      const target =
        (rememberedId ? candidates.find((c) => c.id === rememberedId) : undefined) ??
        candidates.find((c) => c.element.dataset.navPrimary === 'true') ??
        candidates.find((c) => !c.element.closest('aside') && !c.element.closest('header')) ??
        candidates[0];

      if (target) {
        target.element.focus({ preventScroll: true });
        scrollElementSmoothlyIntoView(
          target.element,
          useAppStore.getState().reducedMotion,
        );
      }
    }, 60);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  // Execute global spatial navigation & controller actions
  useEffect(() => {
    const unsubscribe = controllerManager.subscribeActions((event: ControllerActionEvent) => {
      const reducedMotion = useAppStore.getState().reducedMotion;
      const store = useControllerStore.getState();

      // Emit custom DOM event first so pages/modals can consume contextual X/Y/Start hooks cleanly
      const customEv = new CustomEvent(CONTROLLER_CUSTOM_EVENT, {
        detail: event,
        cancelable: true,
      });
      const notCancelled = window.dispatchEvent(customEv);
      if (!notCancelled) return;

      const activeEl = document.activeElement as HTMLElement | null;

      // Range slider fine adjustment with Left/Right when focused
      if (
        activeEl instanceof HTMLInputElement &&
        activeEl.type === 'range' &&
        (event.action === 'NAV_LEFT' || event.action === 'NAV_RIGHT')
      ) {
        const min = Number(activeEl.min || 0);
        const max = Number(activeEl.max || 100);
        const step = Number(activeEl.step || 1);
        const delta = event.action === 'NAV_RIGHT' ? Math.max(step, (max - min) / 20) : -Math.max(step, (max - min) / 20);
        const nextVal = Math.max(min, Math.min(max, Number(activeEl.value || 0) + delta));
        dispatchValueChange(activeEl, String(Math.round(nextVal)));
        return;
      }

      if (
        event.action === 'NAV_UP' ||
        event.action === 'NAV_DOWN' ||
        event.action === 'NAV_LEFT' ||
        event.action === 'NAV_RIGHT'
      ) {
        const dirMap = {
          NAV_UP: 'up',
          NAV_DOWN: 'down',
          NAV_LEFT: 'left',
          NAV_RIGHT: 'right',
        } as const;
        moveSpatialFocus(dirMap[event.action], location.pathname, reducedMotion);
        return;
      }

      if (event.action === 'CONFIRM') {
        const scope = resolveActiveNavScope();
        if (!activeEl || activeEl === document.body || (scope !== document && !(scope as Element).contains(activeEl))) {
          const first = collectNavCandidates()[0];
          first?.element.focus();
          return;
        }

        if (isTextInputElement(activeEl) && !store.oskSession) {
          store.openVirtualKeyboard({
            id: activeEl.id || 'osk-input',
            label:
              activeEl.getAttribute('aria-label') ||
              activeEl.placeholder ||
              'Enter Text',
            initialValue: activeEl.value,
            placeholder: activeEl.placeholder,
            targetElement: activeEl,
            onChange: (val) => dispatchValueChange(activeEl, val),
            onSubmit: (val) => {
              dispatchValueChange(activeEl, val);
              activeEl.form?.requestSubmit?.();
            },
          });
          return;
        }

        activeEl.click();
        return;
      }

      if (event.action === 'BACK') {
        if (store.oskSession) {
          store.closeVirtualKeyboard();
          return;
        }

        const scope = resolveActiveNavScope();
        if (scope !== document) {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
          );
          return;
        }

        if (location.pathname.startsWith(ROUTES.BIG_PICTURE) && location.pathname !== ROUTES.BIG_PICTURE) {
          navigate(ROUTES.BIG_PICTURE);
          return;
        }

        if (location.pathname !== ROUTES.OVERVIEW) {
          navigate(-1);
        }
        return;
      }

      if (event.action === 'PREVIOUS_TAB' || event.action === 'NEXT_TAB') {
        const scope = resolveActiveNavScope();
        const tabs = Array.from(scope.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
          (t) => !(t as HTMLButtonElement).disabled && t.offsetParent !== null,
        );
        if (tabs.length > 1) {
          const curIdx = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
          const safeIdx = curIdx >= 0 ? curIdx : 0;
          const nextIdx =
            event.action === 'NEXT_TAB'
              ? (safeIdx + 1) % tabs.length
              : (safeIdx - 1 + tabs.length) % tabs.length;
          const targetTab = tabs[nextIdx];
          if (targetTab) {
            targetTab.click();
            targetTab.focus({ preventScroll: true });
          }
        }
        return;
      }

      if (event.action === 'PREVIOUS_PAGE' || event.action === 'NEXT_PAGE') {
        const container = findScrollableContainer(activeEl);
        if (container) {
          const delta = Math.round((container.clientHeight || 600) * 0.65);
          container.scrollBy({
            top: event.action === 'NEXT_PAGE' ? delta : -delta,
            behavior: reducedMotion ? 'auto' : 'smooth',
          });
        }
        return;
      }

      if (event.action === 'SCROLL') {
        const dy = event.scrollDy ?? 0;
        const dx = event.scrollDx ?? 0;
        const container = findScrollableContainer(activeEl);
        if (container && (Math.abs(dy) > 0.05 || Math.abs(dx) > 0.05)) {
          container.scrollBy({
            top: Math.round(dy * 16),
            left: Math.round(dx * 12),
            behavior: 'auto',
          });
        }
        return;
      }

      if (event.action === 'SEARCH') {
        if (location.pathname.startsWith(ROUTES.BIG_PICTURE)) {
          navigate(`${ROUTES.BIG_PICTURE}/discover`);
        } else {
          navigate(ROUTES.DISCOVER);
        }
        return;
      }

      if (event.action === 'MENU') {
        if (location.pathname.startsWith(ROUTES.BIG_PICTURE)) {
          navigate(ROUTES.OVERVIEW);
        } else {
          navigate(ROUTES.BIG_PICTURE);
        }
      }
    });

    return () => unsubscribe();
  }, [location.pathname, navigate]);
}
