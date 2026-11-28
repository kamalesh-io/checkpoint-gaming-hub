/**
 * CHECKPOINT V3 Sound System — Configuration & Preferences
 */
export interface SoundPreferences {
  masterEnabled: boolean;
  masterVolume: number;       // 0.0 to 1.0 (default 0.35)
  navSoundsEnabled: boolean;
  buttonSoundsEnabled: boolean;
  modalSoundsEnabled: boolean;
  gameLaunchSoundsEnabled: boolean;
  achievementSoundsEnabled: boolean;
  ambientEnabled: boolean;    // Disabled by default
  ambientVolume: number;      // 0.0 to 1.0 (default 0.15)
  muteWhenMinimized: boolean;
  muteWhenGaming: boolean;
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  masterEnabled: true,
  masterVolume: 0.35,
  navSoundsEnabled: true,
  buttonSoundsEnabled: true,
  modalSoundsEnabled: true,
  gameLaunchSoundsEnabled: true,
  achievementSoundsEnabled: true,
  ambientEnabled: false,
  ambientVolume: 0.15,
  muteWhenMinimized: true,
  muteWhenGaming: true,
};

export const SOUND_STORAGE_KEY = 'checkpoint_sound_preferences';
