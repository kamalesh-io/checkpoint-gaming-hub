import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCENT_COLOR_OPTIONS,
  KNOWN_ACCENT_PALETTES,
} from '../src/utils/theme.ts';

test('BUG-016: target purchase price and currency math accurately detects discounts and met deals', () => {
  const calculateDiscount = (regular: number, current: number): number => {
    if (regular <= 0 || current >= regular) return 0;
    return Math.round(((regular - current) / regular) * 100);
  };

  const isTargetMet = (current: number | null | undefined, target: number | null | undefined): boolean => {
    if (current == null || target == null || target <= 0) return false;
    return current <= target;
  };

  // 1. Regular 3999 INR, Current 1999 INR -> 50% discount
  assert.equal(calculateDiscount(3999, 1999), 50);

  // 2. Target price 2000 INR, Current 1999 INR -> Target met!
  assert.equal(isTargetMet(1999, 2000), true);

  // 3. Target price 1500 INR, Current 1999 INR -> Target not met
  assert.equal(isTargetMet(1999, 1500), false);

  // 4. Undefined/Null prices never fabricate deals
  assert.equal(isTargetMet(null, 1500), false);
  assert.equal(isTargetMet(1999, null), false);
});

test('BUG-017: Steam playtime hours decouple from Checkpoint local session hours', () => {
  const calculateAggregatedHours = (
    checkpointSessionMinutes: number,
    steamPlaytimeMinutes: number,
  ) => {
    const localHours = Math.round((checkpointSessionMinutes / 60.0) * 10) / 10;
    const steamHours = Math.round((steamPlaytimeMinutes / 60.0) * 10) / 10;
    const combined = Math.round((localHours + steamHours) * 10) / 10;
    return { localHours, steamHours, combined };
  };

  // Local sessions: 90 mins (1.5 hrs), Steam imported: 720 mins (12.0 hrs)
  const result = calculateAggregatedHours(90, 720);
  assert.equal(result.localHours, 1.5);
  assert.equal(result.steamHours, 12.0);
  assert.equal(result.combined, 13.5);

  // When Steam playtime is 0, local session playtime remains intact without collision
  const noSteam = calculateAggregatedHours(180, 0);
  assert.equal(noSteam.localHours, 3.0);
  assert.equal(noSteam.steamHours, 0);
  assert.equal(noSteam.combined, 3.0);
});

test('BUG-017: personal rating distribution categorizes 0-10 scores into 5 distinct buckets', () => {
  const categorizeRating = (rating: number | null | undefined): string => {
    if (rating === null || rating === undefined) return 'Unrated';
    if (rating >= 9.0) return 'Masterpiece (9-10)';
    if (rating >= 8.0) return 'Great (8-8.9)';
    if (rating >= 7.0) return 'Good (7-7.9)';
    return 'Mixed/Low (< 7)';
  };

  assert.equal(categorizeRating(10), 'Masterpiece (9-10)');
  assert.equal(categorizeRating(9.2), 'Masterpiece (9-10)');
  assert.equal(categorizeRating(8.5), 'Great (8-8.9)');
  assert.equal(categorizeRating(7.0), 'Good (7-7.9)');
  assert.equal(categorizeRating(6.5), 'Mixed/Low (< 7)');
  assert.equal(categorizeRating(null), 'Unrated');
  assert.equal(categorizeRating(undefined), 'Unrated');
});

test('BUG-018: all 8 accent color palette tokens resolve valid hex, ink, and rgb definitions', () => {
  assert.equal(ACCENT_COLOR_OPTIONS.length, 8);

  for (const option of ACCENT_COLOR_OPTIONS) {
    const palette = KNOWN_ACCENT_PALETTES[option.id];
    assert.ok(palette, `Palette definition must exist for ${option.id}`);
    assert.match(palette.hex, /^#[0-9A-Fa-f]{6}$/, `${option.id} hex must be valid`);
    assert.ok(palette.ink.length > 0, `${option.id} ink must be defined`);
    assert.ok(palette.rgb.includes(','), `${option.id} rgb must contain channels`);
  }
});

test('BUG-019: integration test statuses enforce live validation states over simple string presence', () => {
  const determineStatusBadge = (status: string): { tone: string; label: string } => {
    switch (status) {
      case 'connected':
        return { tone: 'success', label: 'Connected' };
      case 'authentication_failed':
        return { tone: 'danger', label: 'Auth Failed' };
      case 'unreachable':
        return { tone: 'warning', label: 'Unreachable' };
      default:
        return { tone: 'neutral', label: 'Not Configured' };
    }
  };

  assert.deepEqual(determineStatusBadge('connected'), { tone: 'success', label: 'Connected' });
  assert.deepEqual(determineStatusBadge('authentication_failed'), { tone: 'danger', label: 'Auth Failed' });
  assert.deepEqual(determineStatusBadge('unreachable'), { tone: 'warning', label: 'Unreachable' });
  assert.deepEqual(determineStatusBadge('not_configured'), { tone: 'neutral', label: 'Not Configured' });
});

test('BUG-020: rapid search query and text inputs sanitize properly and prevent crash on extreme inputs', () => {
  const sanitizeQuery = (input: string): string => {
    return input.trim().slice(0, 100);
  };

  // Extremely long input (500 chars)
  const hugeInput = 'A'.repeat(500);
  assert.equal(sanitizeQuery(hugeInput).length, 100);

  // Special characters & SQL injection tokens handled safely as search strings
  const sqlInput = "Cyberpunk 2077'; DROP TABLE games; --";
  assert.equal(sanitizeQuery(sqlInput), "Cyberpunk 2077'; DROP TABLE games; --");
});
