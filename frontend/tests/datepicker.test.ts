import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDisplayDate,
  parseIsoDate,
  toIsoDate,
} from '../src/utils/date.ts';

test('parseIsoDate correctly decomposes valid ISO date strings', () => {
  const parsed = parseIsoDate('2026-11-27');
  assert.deepEqual(parsed, { year: 2026, month: 10, day: 27 });

  const startOfYear = parseIsoDate('2025-01-01');
  assert.deepEqual(startOfYear, { year: 2025, month: 0, day: 1 });

  const endOfYear = parseIsoDate('2024-12-31');
  assert.deepEqual(endOfYear, { year: 2024, month: 11, day: 31 });
});

test('parseIsoDate gracefully rejects invalid or empty strings', () => {
  assert.equal(parseIsoDate(null), null);
  assert.equal(parseIsoDate(undefined), null);
  assert.equal(parseIsoDate(''), null);
  assert.equal(parseIsoDate('   '), null);
  assert.equal(parseIsoDate('invalid-date'), null);
  assert.equal(parseIsoDate('2026-99'), null);
  assert.equal(parseIsoDate('2026/11/27'), null);
});

test('toIsoDate constructs standard zero-padded YYYY-MM-DD ISO strings', () => {
  assert.equal(toIsoDate(2026, 10, 27), '2026-11-27');
  assert.equal(toIsoDate(2025, 0, 5), '2025-01-05');
  assert.equal(toIsoDate(2024, 8, 9), '2024-09-09');
});

test('formatDisplayDate formats ISO date strings into human-readable DD-MM-YYYY', () => {
  assert.equal(formatDisplayDate('2026-11-27'), '27-11-2026');
  assert.equal(formatDisplayDate('2025-01-05'), '05-01-2025');
  assert.equal(formatDisplayDate(null), '');
  assert.equal(formatDisplayDate(undefined), '');
  assert.equal(formatDisplayDate(''), '');
  assert.equal(formatDisplayDate('not-a-date'), 'not-a-date');
});

test('date range validation enforces planned start date is on or before target completion date', () => {
  const isValidRange = (start: string | null, completion: string | null): boolean => {
    if (!start || !completion) return true;
    return start <= completion;
  };

  assert.equal(isValidRange('2026-11-01', '2026-11-27'), true);
  assert.equal(isValidRange('2026-11-27', '2026-11-27'), true);
  assert.equal(isValidRange('2026-12-01', '2026-11-27'), false);
  assert.equal(isValidRange(null, '2026-11-27'), true);
  assert.equal(isValidRange('2026-11-01', null), true);
});

test('launcher executable path normalization safely strips quotes and whitespace', () => {
  const sanitizeExecutablePath = (path: string): string => {
    let p = path.trim();
    if (
      (p.startsWith('"') && p.endsWith('"')) ||
      (p.startsWith("'") && p.endsWith("'"))
    ) {
      p = p.slice(1, -1).trim();
    }
    return p;
  };

  assert.equal(
    sanitizeExecutablePath('"D:\\SteamLibrary\\steamapps\\common\\Metro Exodus\\MetroExodus.exe"'),
    'D:\\SteamLibrary\\steamapps\\common\\Metro Exodus\\MetroExodus.exe',
  );
  assert.equal(
    sanitizeExecutablePath("'C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe'"),
    'C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe',
  );
  assert.equal(
    sanitizeExecutablePath('   "E:\\Steam\\game.exe"   '),
    'E:\\Steam\\game.exe',
  );
  assert.equal(
    sanitizeExecutablePath('C:\\SimplePath\\Game.exe'),
    'C:\\SimplePath\\Game.exe',
  );
});
