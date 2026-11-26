import type { LibraryListParams } from '@/services/libraryApi';
import type { PlannerListParams } from '@/services/plannerApi';
import type { SessionHistoryParams } from '@/services/sessionsApi';
import type { JournalListParams } from '@/services/journalApi';
import type { WishlistListParams } from '@/services/wishlistApi';

export const queryKeys = {
  system: {
    all: ['system'] as const,
    health: ['system', 'health'] as const,
    status: ['system', 'status'] as const,
    integrations: ['system', 'integrations'] as const,
    stats: ['system', 'stats'] as const,
  },
  library: {
    all: ['library'] as const,
    list: (params: LibraryListParams = {}) => ['library', 'list', params] as const,
    detail: (entryId: string) => ['library', 'detail', entryId] as const,
  },
  search: {
    all: ['search'] as const,
    igdb: (query: string, limit: number) => ['search', 'igdb', query, limit] as const,
    details: (igdbId: number) => ['search', 'details', igdbId] as const,
    artwork: (igdbId: number) => ['search', 'artwork', igdbId] as const,
  },
  artwork: {
    all: ['artwork'] as const,
    cacheStatus: ['artwork', 'cacheStatus'] as const,
  },
  backlog: {
    all: ['backlog'] as const,
    summary: ['backlog', 'summary'] as const,
  },
  planner: {
    all: ['planner'] as const,
    list: (params: PlannerListParams = {}) => ['planner', 'list', params] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    active: ['sessions', 'active'] as const,
    history: (params: SessionHistoryParams = {}) => ['sessions', 'history', params] as const,
  },
  collections: {
    all: ['collections'] as const,
    list: ['collections', 'list'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
  },
  franchises: {
    all: ['franchises'] as const,
    list: ['franchises', 'list'] as const,
    detail: (id: string) => ['franchises', 'detail', id] as const,
  },
  journal: {
    all: ['journal'] as const,
    list: (params: JournalListParams = {}) => ['journal', 'list', params] as const,
    game: (libraryEntryId: string) => ['journal', 'game', libraryEntryId] as const,
  },
  stats: {
    all: ['stats'] as const,
    overview: (startDate?: string, endDate?: string) => ['stats', 'overview', { startDate, endDate }] as const,
  },
  wishlist: {
    all: ['wishlist'] as const,
    list: (params: WishlistListParams = {}) => ['wishlist', 'list', params] as const,
  },
  settings: {
    all: ['settings'] as const,
    list: ['settings', 'list'] as const,
  },
  backup: {
    all: ['backup'] as const,
    list: ['backup', 'list'] as const,
  },
};

