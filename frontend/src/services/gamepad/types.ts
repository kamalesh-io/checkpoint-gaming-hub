export type ControllerAction =
  | 'NAV_UP'
  | 'NAV_DOWN'
  | 'NAV_LEFT'
  | 'NAV_RIGHT'
  | 'CONFIRM'
  | 'BACK'
  | 'QUICK_ACTION'
  | 'SEARCH'
  | 'PREVIOUS_TAB'
  | 'NEXT_TAB'
  | 'PREVIOUS_PAGE'
  | 'NEXT_PAGE'
  | 'SCROLL'
  | 'MENU';

export type ControllerProfile = 'xbox' | 'playstation' | 'nintendo' | 'generic';

export type GlyphMode = 'auto' | 'xbox' | 'playstation' | 'keyboard';

export type InputProviderMode = 'auto' | 'web_gamepad' | 'rust_gilrs';

export type ActiveInputProvider = 'web_gamepad' | 'rust_gilrs' | 'synthetic' | 'none';

export type ActiveInputDevice = 'mouse' | 'keyboard' | 'controller';

export interface GamepadSnapshot {
  index: number;
  id: string;
  name?: string;
  connected: boolean;
  mapping?: string;
  buttons: number[]; // length >= 16 normalized values in [0, 1]
  axes: number[]; // [lx, ly, rx, ry] in [-1, 1]
}

export interface ConnectedControllerInfo {
  index: number;
  id: string;
  name: string;
  profile: ControllerProfile;
  connectionType: 'usb' | 'bluetooth' | 'unknown';
  provider: ActiveInputProvider;
}

export interface ControllerActionEvent {
  action: ControllerAction;
  controllerIndex: number;
  profile: ControllerProfile;
  isRepeat: boolean;
  scrollDx?: number;
  scrollDy?: number;
  timestamp: number;
}

export interface ControllerRawTelemetry {
  index: number;
  id: string;
  name: string;
  profile: ControllerProfile;
  provider: ActiveInputProvider;
  rawAxes: [number, number, number, number];
  leftStick: { x: number; y: number; magnitude: number };
  rightStick: { x: number; y: number; magnitude: number };
  buttons: number[];
}

export interface ControllerNormalizationSettings {
  deadzone: number;
  repeatDelayMs: number;
  repeatIntervalMs: number;
  buttonMappings: Record<number, ControllerAction>;
}

/** Standard W3C Gamepad button indices mapped to CHECKPOINT actions. */
export const DEFAULT_BUTTON_MAPPINGS: Record<number, ControllerAction> = {
  0: 'CONFIRM', // A / Cross
  1: 'BACK', // B / Circle
  2: 'QUICK_ACTION', // X / Square
  3: 'SEARCH', // Y / Triangle
  4: 'PREVIOUS_TAB', // LB / L1
  5: 'NEXT_TAB', // RB / R1
  6: 'PREVIOUS_PAGE', // LT / L2
  7: 'NEXT_PAGE', // RT / R2
  9: 'MENU', // Start / Menu / Options
  12: 'NAV_UP',
  13: 'NAV_DOWN',
  14: 'NAV_LEFT',
  15: 'NAV_RIGHT',
};

export const ACTION_LABELS: Record<ControllerAction, string> = {
  NAV_UP: 'Navigate Up',
  NAV_DOWN: 'Navigate Down',
  NAV_LEFT: 'Navigate Left',
  NAV_RIGHT: 'Navigate Right',
  CONFIRM: 'Select / Confirm',
  BACK: 'Back / Cancel',
  QUICK_ACTION: 'Quick Actions',
  SEARCH: 'Global Search',
  PREVIOUS_TAB: 'Previous Tab',
  NEXT_TAB: 'Next Tab',
  PREVIOUS_PAGE: 'Previous Page / Up',
  NEXT_PAGE: 'Next Page / Down',
  SCROLL: 'Scroll Content',
  MENU: 'Application Menu / Mode Switch',
};

export const STANDARD_BUTTON_NAMES: Record<number, string> = {
  0: 'Face Bottom (A / Cross)',
  1: 'Face Right (B / Circle)',
  2: 'Face Left (X / Square)',
  3: 'Face Top (Y / Triangle)',
  4: 'Left Bumper (LB / L1)',
  5: 'Right Bumper (RB / R1)',
  6: 'Left Trigger (LT / L2)',
  7: 'Right Trigger (RT / R2)',
  8: 'View / Share / Create',
  9: 'Menu / Start / Options',
  10: 'Left Stick Click (LS / L3)',
  11: 'Right Stick Click (RS / R3)',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right',
};
