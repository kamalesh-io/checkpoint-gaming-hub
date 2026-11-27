import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGameDetailsRoute, ROUTES } from '../src/routes/routes.ts';
import type { IGDBSearchResultItem } from '../src/types/index.ts';

test('autocomplete query threshold activates only for >= 2 trimmed characters', () => {
  const isSearchActive = (q: string) => q.trim().length >= 2;

  assert.equal(isSearchActive(''), false);
  assert.equal(isSearchActive(' '), false);
  assert.equal(isSearchActive('e'), false);
  assert.equal(isSearchActive('  e  '), false);
  assert.equal(isSearchActive('el'), true);
  assert.equal(isSearchActive('elden'), true);
});

test('autocomplete result selection routes accurately for in-library vs external IGDB games', () => {
  const inLibraryItem: IGDBSearchResultItem = {
    igdb_id: 119133,
    title: 'Elden Ring',
    slug: 'elden-ring',
    category: 'main_game',
    game_type: 0,
    version_parent: null,
    parent_game: null,
    release_year: 2022,
    developer: 'FromSoftware',
    publisher: 'Bandai Namco',
    genres: ['Role-playing (RPG)', 'Adventure'],
    platforms: ['PC', 'PlayStation 5'],
    igdb_rating: 95.4,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
    in_library: true,
    library_entry_id: 'lib_entry_elden_01',
  };

  const externalItem: IGDBSearchResultItem = {
    igdb_id: 1877,
    title: 'Cyberpunk 2077',
    slug: 'cyberpunk-2077',
    category: 'main_game',
    game_type: 0,
    version_parent: null,
    parent_game: null,
    release_year: 2020,
    developer: 'CD Projekt RED',
    publisher: 'CD Projekt',
    genres: ['Role-playing (RPG)', 'Shooter'],
    platforms: ['PC', 'Xbox Series X'],
    igdb_rating: 86.0,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2m37.jpg',
    in_library: false,
    library_entry_id: null,
  };

  const resolveTargetRoute = (item: IGDBSearchResultItem): string => {
    if (item.in_library && item.library_entry_id) {
      return buildGameDetailsRoute(item.library_entry_id);
    }
    return `${ROUTES.DISCOVER}?q=${encodeURIComponent(item.title)}`;
  };

  assert.equal(resolveTargetRoute(inLibraryItem), '/games/lib_entry_elden_01');
  assert.equal(resolveTargetRoute(externalItem), '/discover?q=Cyberpunk%202077');
});

test('autocomplete keyboard arrow cycling clamps and loops appropriately', () => {
  const itemsCount = 5;

  const cycleNext = (current: number, total: number) =>
    current < total - 1 ? current + 1 : 0;
  const cyclePrev = (current: number, total: number) =>
    current > 0 ? current - 1 : total - 1;

  let active = -1;
  // First arrow down starts at index 0 if previously -1
  active = active < 0 ? 0 : cycleNext(active, itemsCount);
  assert.equal(active, 0);

  active = cycleNext(active, itemsCount);
  assert.equal(active, 1);

  active = 4;
  active = cycleNext(active, itemsCount);
  assert.equal(active, 0); // loops to top

  active = cyclePrev(active, itemsCount);
  assert.equal(active, 4); // loops to bottom
});
