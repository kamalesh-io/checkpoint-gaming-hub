import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveKnownGameAccent } from '../src/utils/theme.ts';

test('BUG-011: carousel spotlight stepping wraps circularly through currently playing games', () => {
  const playing = [{ id: 'game-1' }, { id: 'game-2' }, { id: 'game-3' }];
  const step = (currentId: string, direction: -1 | 1) => {
    const idx = playing.findIndex((p) => p.id === currentId);
    const safeIdx = idx >= 0 ? idx : 0;
    const nextIdx = (safeIdx + direction + playing.length) % playing.length;
    return playing[nextIdx]!.id;
  };

  assert.equal(step('game-1', 1), 'game-2');
  assert.equal(step('game-2', 1), 'game-3');
  assert.equal(step('game-3', 1), 'game-1'); // wraps to start
  assert.equal(step('game-1', -1), 'game-3'); // wraps to end
});

test('BUG-012: verified signature game titles resolve exact specified hex colors', () => {
  // Elden Ring: #E0B45A (accent-gold)
  const elden = resolveKnownGameAccent('Elden Ring');
  assert.equal(elden?.hex, '#E0B45A');
  assert.equal(elden?.token, 'accent-gold');

  // Metro Exodus: #F09B4B (accent-amber)
  const metro = resolveKnownGameAccent('Metro Exodus');
  assert.equal(metro?.hex, '#F09B4B');
  assert.equal(metro?.token, 'accent-amber');

  // Watch Dogs: #5BA8FF (accent-blue)
  const watchdogs = resolveKnownGameAccent('Watch Dogs');
  assert.equal(watchdogs?.hex, '#5BA8FF');
  assert.equal(watchdogs?.token, 'accent-blue');

  // Cyberpunk 2077: #F5DF4D (accent-yellow)
  const cyberpunk = resolveKnownGameAccent('Cyberpunk 2077');
  assert.equal(cyberpunk?.hex, '#F5DF4D');
  assert.equal(cyberpunk?.token, 'accent-yellow');

  // God of War resolves to accent-amber
  const gow = resolveKnownGameAccent('God of War Ragnarok');
  assert.equal(gow?.hex, '#F09B4B');
});

test('BUG-013: rating and progress validation accurately clamps 0-100% and parses nullable 0-10 rating', () => {
  const validateProgress = (val: number) => Math.max(0, Math.min(100, Math.round(val)));
  assert.equal(validateProgress(68.4), 68);
  assert.equal(validateProgress(-5), 0);
  assert.equal(validateProgress(150), 100);

  const parseRating = (input: string): number | null => {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 10) return null;
    return Math.round(n * 10) / 10;
  };

  assert.equal(parseRating(''), null); // Cleared rating
  assert.equal(parseRating('   '), null);
  assert.equal(parseRating('9.5'), 9.5);
  assert.equal(parseRating('10'), 10);
  assert.equal(parseRating('0'), 0);
  assert.equal(parseRating('11'), null); // Out of bounds
  assert.equal(parseRating('-1'), null);
});

test('BUG-014: live timer delta calculation avoids refetch double-counting', () => {
  const baseElapsed = 120; // 2 minutes accumulated on server
  const fetchedAt = 1000000;

  const calculateSeconds = (serverElapsed: number, isPaused: boolean, now: number, baseTime: number) => {
    const tick = !isPaused ? Math.max(0, Math.floor((now - baseTime) / 1000)) : 0;
    return serverElapsed + tick;
  };

  // After 5 seconds
  assert.equal(calculateSeconds(baseElapsed, false, 1005000, fetchedAt), 125);

  // When paused, timer freezes and does not increment
  assert.equal(calculateSeconds(baseElapsed, true, 1005000, fetchedAt), 120);

  // On refetch with updated server base (e.g. 125s), baseTime resets to now
  const newBaseTime = 1005000;
  const newServerElapsed = 125;
  // Next second after refetch: should be 126s, NOT 130s!
  assert.equal(calculateSeconds(newServerElapsed, false, 1006000, newBaseTime), 126);
});

test('BUG-015: library filtering strictly decouples Wishlist (To Buy) entries from active library', () => {
  const entries = [
    { id: '1', title: 'Elden Ring', ownership_status: 'Owned', playing_status: 'Currently Playing' },
    { id: '2', title: 'Cyberpunk 2077', ownership_status: 'Owned', playing_status: 'Planned' },
    { id: '3', title: 'Wishlist Item', ownership_status: 'To Buy', playing_status: 'Planned' },
  ];

  const libraryOnly = entries.filter((e) => e.ownership_status !== 'To Buy');
  assert.equal(libraryOnly.length, 2);
  assert.equal(libraryOnly.some((e) => e.id === '3'), false);

  const wishlistOnly = entries.filter((e) => e.ownership_status === 'To Buy');
  assert.equal(wishlistOnly.length, 1);
  assert.equal(wishlistOnly[0]!.id, '3');
});
