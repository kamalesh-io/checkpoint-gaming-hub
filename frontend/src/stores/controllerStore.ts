import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyButtonRemap,
  clampDeadzoneValue,
  clampRepeatDelayMs,
  clampRepeatIntervalMs,
  createDefaultButtonMappings,
} from '@/services/gamepad/gamepadNormalizer';
import {
  DEFAULT_BUTTON_MAPPINGS,
  type ActiveInputDevice,
  type ActiveInputProvider,
  type ConnectedControllerInfo,
  type ControllerAction,
  type ControllerProfile,
  type GlyphMode,
  type InputProviderMode,
} from '@/services/gamepad/types';

export interface VirtualKeyboardSession {
  id: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  targetElement?: HTMLElement | null;
  onChange?: (val: string) => void;
  onSubmit: (val: string) => void;
}

export interface ControllerState {
  // Persisted User Settings
  enabled: boolean;
  deadzone: number;
  repeatDelayMs: number;
  repeatIntervalMs: number;
  glyphPreference: GlyphMode;
  providerPreference: InputProviderMode;
  startInBigPicture: boolean;
  buttonMappings: Record<number, ControllerAction>;

  // Runtime Hardware & Focus State (updates only on change, never 60Hz)
  gamepadApiSupported: boolean;
  connectedControllers: ConnectedControllerInfo[];
  activeControllerIndex: number | null;
  activeControllerName: string | null;
  activeControllerProfile: ControllerProfile | null;
  activeProvider: ActiveInputProvider;
  activeInputDevice: ActiveInputDevice;
  windowFocused: boolean;

  // Big Picture Shared Preserved State
  bigPictureActiveEntryId: string | null;

  // Active On-Screen Virtual Keyboard Session
  oskSession: VirtualKeyboardSession | null;

  // Settings Mutators
  setEnabled: (enabled: boolean) => void;
  setDeadzone: (deadzone: number) => void;
  setRepeatDelayMs: (ms: number) => void;
  setRepeatIntervalMs: (ms: number) => void;
  setGlyphPreference: (mode: GlyphMode) => void;
  setProviderPreference: (mode: InputProviderMode) => void;
  setStartInBigPicture: (start: boolean) => void;
  remapButton: (buttonIndex: number, action: ControllerAction) => void;
  restoreDefaultMappings: () => void;

  // Runtime Mutators
  setGamepadApiSupported: (supported: boolean) => void;
  setHardwareState: (payload: {
    connectedControllers: ConnectedControllerInfo[];
    activeControllerIndex: number | null;
    activeControllerName: string | null;
    activeControllerProfile: ControllerProfile | null;
    activeProvider: ActiveInputProvider;
  }) => void;
  setActiveInputDevice: (device: ActiveInputDevice) => void;
  setWindowFocused: (focused: boolean) => void;
  setBigPictureActiveEntryId: (id: string | null) => void;
  openVirtualKeyboard: (session: VirtualKeyboardSession) => void;
  closeVirtualKeyboard: () => void;
}

export const useControllerStore = create<ControllerState>()(
  persist(
    (set) => ({
      enabled: true,
      deadzone: 0.15,
      repeatDelayMs: 400,
      repeatIntervalMs: 120,
      glyphPreference: 'auto',
      providerPreference: 'auto',
      startInBigPicture: false,
      buttonMappings: { ...DEFAULT_BUTTON_MAPPINGS },

      gamepadApiSupported: typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function',
      connectedControllers: [],
      activeControllerIndex: null,
      activeControllerName: null,
      activeControllerProfile: null,
      activeProvider: 'none',
      activeInputDevice: 'mouse',
      windowFocused: true,
      bigPictureActiveEntryId: null,
      oskSession: null,

      setEnabled: (enabled) => set({ enabled }),
      setDeadzone: (deadzone) => set({ deadzone: clampDeadzoneValue(deadzone) }),
      setRepeatDelayMs: (ms) => set({ repeatDelayMs: clampRepeatDelayMs(ms) }),
      setRepeatIntervalMs: (ms) => set({ repeatIntervalMs: clampRepeatIntervalMs(ms) }),
      setGlyphPreference: (glyphPreference) => set({ glyphPreference }),
      setProviderPreference: (providerPreference) => set({ providerPreference }),
      setStartInBigPicture: (startInBigPicture) => set({ startInBigPicture }),
      remapButton: (buttonIndex, action) =>
        set((state) => ({
          buttonMappings: applyButtonRemap(state.buttonMappings, buttonIndex, action),
        })),
      restoreDefaultMappings: () => set({ buttonMappings: createDefaultButtonMappings() }),

      setGamepadApiSupported: (gamepadApiSupported) => set({ gamepadApiSupported }),
      setHardwareState: (payload) =>
        set((state) => {
          const sameIds =
            state.connectedControllers.length === payload.connectedControllers.length &&
            state.connectedControllers.every(
              (c, idx) =>
                c.index === payload.connectedControllers[idx]?.index &&
                c.id === payload.connectedControllers[idx]?.id &&
                c.provider === payload.connectedControllers[idx]?.provider,
            );
          if (
            sameIds &&
            state.activeControllerIndex === payload.activeControllerIndex &&
            state.activeControllerProfile === payload.activeControllerProfile &&
            state.activeProvider === payload.activeProvider
          ) {
            return state;
          }
          return payload;
        }),
      setActiveInputDevice: (device) =>
        set((state) => {
          if (state.activeInputDevice === device) return state;
          if (typeof document !== 'undefined') {
            document.documentElement.dataset.inputMode = device;
          }
          return { activeInputDevice: device };
        }),
      setWindowFocused: (windowFocused) =>
        set((state) => (state.windowFocused === windowFocused ? state : { windowFocused })),
      setBigPictureActiveEntryId: (bigPictureActiveEntryId) => set({ bigPictureActiveEntryId }),
      openVirtualKeyboard: (oskSession) => set({ oskSession }),
      closeVirtualKeyboard: () => set({ oskSession: null }),
    }),
    {
      name: 'checkpoint-controller-settings',
      partialize: (state) => ({
        enabled: state.enabled,
        deadzone: state.deadzone,
        repeatDelayMs: state.repeatDelayMs,
        repeatIntervalMs: state.repeatIntervalMs,
        glyphPreference: state.glyphPreference,
        providerPreference: state.providerPreference,
        startInBigPicture: state.startInBigPicture,
        buttonMappings: state.buttonMappings,
      }),
    },
  ),
);
