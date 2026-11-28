export const ROUTES = {
  OVERVIEW: '/',
  LIBRARY: '/library',
  DISCOVER: '/discover',
  BACKLOG: '/backlog',
  PLANNER: '/planner',
  WISHLIST: '/wishlist',
  COLLECTIONS: '/collections',
  JOURNAL: '/journal',
  STATISTICS: '/statistics',
  SETTINGS: '/settings',
  LOGS: '/logs',
  GAME_DETAILS: '/games/:id',
  BIG_PICTURE: '/big-picture',
} as const;

export function buildGameDetailsRoute(entryId: string): string {
  return `/games/${encodeURIComponent(entryId)}`;
}
