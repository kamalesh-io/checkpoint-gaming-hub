import { useCallback } from 'react';
import { soundManager } from './soundManager';
import { SoundEvent, type SoundEventType } from './soundEvents';

/**
 * Hook to trigger PlayStation-inspired UI sounds from any React component
 */
export function useUISound() {
  const playSound = useCallback((event: SoundEventType) => {
    soundManager.play(event);
  }, []);

  return {
    playSound,
    SoundEvent,
    playNavMove: () => soundManager.play(SoundEvent.NAV_MOVE),
    playClick: () => soundManager.playClick(),
    playSelect: () => soundManager.playSelect(),
    playDone: () => soundManager.playDone(),
    playNextPage: () => soundManager.playNextPage(),
    playBack: () => soundManager.playBack(),
    playTab: () => soundManager.play(SoundEvent.NAV_TAB),
    playModalOpen: () => soundManager.play(SoundEvent.MODAL_OPEN),
    playModalClose: () => soundManager.play(SoundEvent.MODAL_CLOSE),
    playGameLaunch: () => soundManager.play(SoundEvent.GAME_LAUNCH),
    playAchievement: () => soundManager.play(SoundEvent.ACHIEVEMENT),
    playToggle: () => soundManager.play(SoundEvent.TOGGLE),
    soundManager,
  };
}
