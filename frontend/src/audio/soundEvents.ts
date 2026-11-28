/**
 * CHECKPOINT V3 Sound System — Event Definitions
 * Inspired by PlayStation 5 and modern console acoustic feedback.
 */
export const SoundEvent = {
  NAV_MOVE: 'NAV_MOVE',
  NAV_SELECT: 'NAV_SELECT',
  NAV_BACK: 'NAV_BACK',
  NAV_TAB: 'NAV_TAB',
  MODAL_OPEN: 'MODAL_OPEN',
  MODAL_CLOSE: 'MODAL_CLOSE',
  BUTTON_CLICK: 'BUTTON_CLICK',
  GAME_LAUNCH: 'GAME_LAUNCH',
  ACHIEVEMENT: 'ACHIEVEMENT',
  TOGGLE: 'TOGGLE',
  ERROR: 'ERROR',
  NOTIFICATION: 'NOTIFICATION',
  // Specific distinct action sound effects requested by user
  CLICK: 'CLICK',
  SELECT: 'SELECT',
  DONE: 'DONE',
  NEXT_PAGE: 'NEXT_PAGE',
} as const;

export type SoundEventType = (typeof SoundEvent)[keyof typeof SoundEvent];
