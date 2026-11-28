import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEvent } from '../src/audio/soundEvents.ts';
import { DEFAULT_SOUND_PREFERENCES } from '../src/audio/soundConfig.ts';
import { KNOWN_ACCENT_PALETTES } from '../src/utils/theme.ts';
import { ROUTES } from '../src/routes/routes.ts';

test('V1.1.0 Sound System: default preferences adhere strictly to design mandate', () => {
  // UI sounds must be enabled by default at 35% volume
  assert.equal(DEFAULT_SOUND_PREFERENCES.masterEnabled, true);
  assert.equal(DEFAULT_SOUND_PREFERENCES.masterVolume, 0.35);

  // Category sounds enabled by default
  assert.equal(DEFAULT_SOUND_PREFERENCES.navSoundsEnabled, true);
  assert.equal(DEFAULT_SOUND_PREFERENCES.buttonSoundsEnabled, true);
  assert.equal(DEFAULT_SOUND_PREFERENCES.modalSoundsEnabled, true);
  assert.equal(DEFAULT_SOUND_PREFERENCES.gameLaunchSoundsEnabled, true);
  assert.equal(DEFAULT_SOUND_PREFERENCES.achievementSoundsEnabled, true);

  // Ambient menu audio MUST be disabled by default as specified in user prompt
  assert.equal(DEFAULT_SOUND_PREFERENCES.ambientEnabled, false);
  assert.equal(DEFAULT_SOUND_PREFERENCES.ambientVolume, 0.15);
});

test('V1.1.0 Sound System: SoundEvent enum exposes all core interactive events', () => {
  const events = [
    SoundEvent.NAV_MOVE,
    SoundEvent.NAV_SELECT,
    SoundEvent.NAV_BACK,
    SoundEvent.NAV_TAB,
    SoundEvent.MODAL_OPEN,
    SoundEvent.MODAL_CLOSE,
    SoundEvent.BUTTON_CLICK,
    SoundEvent.GAME_LAUNCH,
    SoundEvent.ACHIEVEMENT,
    SoundEvent.TOGGLE,
    SoundEvent.ERROR,
    SoundEvent.NOTIFICATION,
  ];

  assert.equal(events.length, 12);
  events.forEach((evt) => {
    assert.equal(typeof evt, 'string');
    assert.ok(evt.length > 0);
  });
});

test('V1.1.0 Charcoal Surface System: ink contrast values resolve over #0C0F12', () => {
  // Dark backgrounds must use #0C0F12 base ink for crisp contrast
  assert.equal(KNOWN_ACCENT_PALETTES.primary!.ink, '#0C0F12');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-gold']!.ink, '#0C0F12');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-amber']!.ink, '#0C0F12');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-blue']!.ink, '#0C0F12');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-yellow']!.ink, '#0C0F12');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-emerald']!.ink, '#0C0F12');

  // Vibrant high-luminance tokens retain white ink
  assert.equal(KNOWN_ACCENT_PALETTES['accent-violet']!.ink, '#FFFFFF');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-crimson']!.ink, '#FFFFFF');
  assert.equal(KNOWN_ACCENT_PALETTES['accent-rose']!.ink, '#FFFFFF');
});

test('V1.1.0 Floating Dock Architecture: routes match all 9 primary gaming hub destinations', () => {
  const expectedRoutes = [
    ROUTES.OVERVIEW,
    ROUTES.LIBRARY,
    ROUTES.DISCOVER,
    ROUTES.BACKLOG,
    ROUTES.PLANNER,
    ROUTES.WISHLIST,
    ROUTES.COLLECTIONS,
    ROUTES.JOURNAL,
    ROUTES.STATISTICS,
  ];

  assert.equal(expectedRoutes.length, 9);
  assert.equal(expectedRoutes[0], '/');
  assert.equal(expectedRoutes[1], '/library');
  assert.equal(expectedRoutes[2], '/discover');
  assert.equal(expectedRoutes[3], '/backlog');
  assert.equal(expectedRoutes[4], '/planner');
  assert.equal(expectedRoutes[5], '/wishlist');
  assert.equal(expectedRoutes[6], '/collections');
  assert.equal(expectedRoutes[7], '/journal');
  assert.equal(expectedRoutes[8], '/statistics');
});

test('V1.1.0 Sound System: distinct action SFX events expose unique values', () => {
  const distinctSounds = [
    SoundEvent.CLICK,
    SoundEvent.SELECT,
    SoundEvent.DONE,
    SoundEvent.NEXT_PAGE,
  ];

  // All must be strings and all must be unique
  const set = new Set(distinctSounds);
  assert.equal(set.size, 4);
  assert.equal(SoundEvent.CLICK, 'CLICK');
  assert.equal(SoundEvent.SELECT, 'SELECT');
  assert.equal(SoundEvent.DONE, 'DONE');
  assert.equal(SoundEvent.NEXT_PAGE, 'NEXT_PAGE');
});

test('V1.1.0 Navigation: System Logs route is correctly registered', () => {
  assert.equal(ROUTES.LOGS, '/logs');
});
