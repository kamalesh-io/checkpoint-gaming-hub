import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatHoursLogged,
  formatIgdbRating,
  formatPersonalRating,
  formatReleaseYear,
  joinCustomTags,
  splitCustomTags,
} from '../src/utils/format.ts';
import {
  applyCssAccentVariables,
  KNOWN_ACCENT_PALETTES,
  resolveKnownGameAccent,
} from '../src/utils/theme.ts';

test('resolveKnownGameAccent resolves V2 signature game palettes accurately', () => {
  const elden = resolveKnownGameAccent('Elden Ring');
  assert.equal(elden?.hex, '#E0B45A');
  assert.equal(elden?.token, 'accent-gold');

  const metro = resolveKnownGameAccent('Metro Exodus');
  assert.equal(metro?.hex, '#F09B4B');
  assert.equal(metro?.token, 'accent-amber');

  const watchDogs = resolveKnownGameAccent('Watch Dogs');
  assert.equal(watchDogs?.hex, '#5BA8FF');

  const cyberpunk = resolveKnownGameAccent('Cyberpunk 2077');
  assert.equal(cyberpunk?.hex, '#F5DF4D');

  const backendOverride = resolveKnownGameAccent('Custom Indie Title', 'accent-gold');
  assert.equal(backendOverride?.hex, '#E0B45A');

  const unknown = resolveKnownGameAccent('Totally Unknown Indie Title');
  assert.equal(unknown, null);
});

test('applyCssAccentVariables writes CSS custom properties onto document root', () => {
  const props = new Map<string, string>();
  const fakeDoc = {
    documentElement: {
      style: {
        setProperty: (k: string, v: string) => props.set(k, v),
      },
    },
  };
  Object.defineProperty(globalThis, 'document', {
    value: fakeDoc,
    configurable: true,
    writable: true,
  });

  const gold = KNOWN_ACCENT_PALETTES['accent-gold']!;
  applyCssAccentVariables(gold);

  assert.equal(props.get('--accent-active'), '#E0B45A');
  assert.equal(props.get('--accent-active-ink'), '#0C0F12');
  assert.equal(props.get('--accent-active-rgb'), '224, 180, 90');
});

test('honest data formatting utilities never fabricate missing telemetry', () => {
  assert.equal(formatReleaseYear('2022-02-25'), '2022');
  assert.equal(formatReleaseYear(null), 'TBA');

  assert.equal(formatIgdbRating(94.6), '95');
  assert.equal(formatIgdbRating(0), null);
  assert.equal(formatIgdbRating(null), null);

  assert.equal(formatPersonalRating(null), 'Unrated');
  assert.equal(formatPersonalRating(9.5), '9.5 / 10');

  assert.equal(formatHoursLogged(0), 'No sessions logged');
  assert.equal(formatHoursLogged(null), 'No sessions logged');
  assert.equal(formatHoursLogged(0.5), '30m');
  assert.equal(formatHoursLogged(14), '14h');

  assert.deepEqual(splitCustomTags('Soulslike, Action RPG, , Co-op '), [
    'Soulslike',
    'Action RPG',
    'Co-op',
  ]);
  assert.equal(joinCustomTags(['RPG', 'RPG', ' Deck ']), 'RPG, Deck');
});
