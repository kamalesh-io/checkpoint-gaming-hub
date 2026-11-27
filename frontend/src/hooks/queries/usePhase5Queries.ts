import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  backlogApi,
  plannerApi,
  sessionsApi,
  collectionsApi,
  franchisesApi,
  journalApi,
  statsApi,
  wishlistApi,
  settingsApi,
  backupApi,
  type PlannerListParams,
  type SessionHistoryParams,
  type JournalListParams,
  type WishlistListParams,
} from '@/services';
import type {
  BacklogReorderItem,
  ScheduledSessionCreate,
  ScheduledSessionUpdate,
  ScheduledSessionCompleteRequest,
  ActiveSessionStart,
  ActiveSessionEndRequest,
  PlaySessionCreate,
  PlaySessionUpdate,
  CollectionCreate,
  CollectionUpdate,
  CollectionItemAdd,
  JournalEntryCreate,
  JournalEntryUpdate,
  WishlistItemCreate,
  WishlistItemUpdate,
  WishlistConvertToLibraryRequest,
} from '@/types';

// ======================== PHASE 5A: BACKLOG ========================

export function useBacklogSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.backlog.summary,
    queryFn: () => backlogApi.getSummary(),
  });
}

export function useReorderBacklogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: BacklogReorderItem[]) => backlogApi.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useMoveBacklogItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, direction }: { entryId: string; direction: 'up' | 'down' }) =>
      backlogApi.moveItem(entryId, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useSetAsNextMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => backlogApi.setAsNext(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

// ======================== PHASE 5B: PLANNER ========================

export function usePlannerSessionsQuery(params: PlannerListParams = {}) {
  return useQuery({
    queryKey: queryKeys.planner.list(params),
    queryFn: () => plannerApi.listSessions(params),
  });
}

export function useCreatePlannerSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduledSessionCreate) => plannerApi.createSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useUpdatePlannerSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ScheduledSessionUpdate }) =>
      plannerApi.updateSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all });
    },
  });
}

export function useCompletePlannerSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: ScheduledSessionCompleteRequest }) =>
      plannerApi.completeSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useDeletePlannerSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannerApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all });
    },
  });
}

// ======================== PHASE 5C: SESSIONS ========================

export function useActiveSessionQuery() {
  return useQuery({
    queryKey: queryKeys.sessions.active,
    queryFn: () => sessionsApi.getActive(),
    refetchInterval: (query) => (query.state.data ? 10000 : false),
  });
}

export function useStartActiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActiveSessionStart) => sessionsApi.start(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function usePauseActiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sessionsApi.pause(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
    },
  });
}

export function useResumeActiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sessionsApi.resume(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
    },
  });
}

export function useEndActiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: ActiveSessionEndRequest) => sessionsApi.end(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

export function useDiscardActiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sessionsApi.discard(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
    },
  });
}

export function useLogManualSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlaySessionCreate) => sessionsApi.logManual(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

export function useSessionHistoryQuery(params: SessionHistoryParams = {}) {
  return useQuery({
    queryKey: queryKeys.sessions.history(params),
    queryFn: () => sessionsApi.listHistory(params),
  });
}

export function useUpdateSessionHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlaySessionUpdate }) =>
      sessionsApi.updateHistory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

export function useDeleteSessionHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionsApi.deleteHistory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
    },
  });
}

// ======================== PHASE 5D: COLLECTIONS & FRANCHISES ========================

export function useCollectionsQuery() {
  return useQuery({
    queryKey: queryKeys.collections.list,
    queryFn: () => collectionsApi.list(),
  });
}

export function useCollectionDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    queryFn: () => collectionsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CollectionCreate) => collectionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

export function useUpdateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CollectionUpdate }) =>
      collectionsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(variables.id) });
    },
  });
}

export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

export function useAddCollectionItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      payload,
    }: {
      collectionId: string;
      payload: CollectionItemAdd;
    }) => collectionsApi.addItem(collectionId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(variables.collectionId) });
    },
  });
}

export function useRemoveCollectionItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      libraryEntryId,
    }: {
      collectionId: string;
      libraryEntryId: string;
    }) => collectionsApi.removeItem(collectionId, libraryEntryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(variables.collectionId) });
    },
  });
}

export function useReorderCollectionItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      entryIds,
    }: {
      collectionId: string;
      entryIds: string[];
    }) => collectionsApi.reorderItems(collectionId, entryIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(variables.collectionId) });
    },
  });
}

export function useFranchisesQuery() {
  return useQuery({
    queryKey: queryKeys.franchises.list,
    queryFn: () => franchisesApi.list(),
  });
}

export function useFranchiseDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.franchises.detail(id),
    queryFn: () => franchisesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useUpdateFranchiseOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      franchiseId,
      items,
    }: {
      franchiseId: string;
      items: { game_id: string; order: number }[];
    }) => franchisesApi.updateOrder(franchiseId, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.franchises.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.franchises.detail(variables.franchiseId) });
    },
  });
}

// ======================== PHASE 5E: JOURNAL ========================

export function useJournalListQuery(params: JournalListParams = {}) {
  return useQuery({
    queryKey: queryKeys.journal.list(params),
    queryFn: () => journalApi.list(params),
  });
}

export function useGameJournalQuery(libraryEntryId: string) {
  return useQuery({
    queryKey: queryKeys.journal.game(libraryEntryId),
    queryFn: () => journalApi.listByGame(libraryEntryId),
    enabled: Boolean(libraryEntryId),
  });
}

export function useCreateJournalEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: JournalEntryCreate) => journalApi.create(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
      if (variables.library_entry_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.game(variables.library_entry_id) });
      }
    },
  });
}

export function useUpdateJournalEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: JournalEntryUpdate }) =>
      journalApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

export function useDeleteJournalEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

// ======================== PHASE 5F: STATS ========================

export function useGamingStatsQuery(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.stats.overview(startDate, endDate),
    queryFn: () => statsApi.getAnalytics({ start: startDate, end: endDate }),
  });
}

// ======================== PHASE 5G: WISHLIST ========================

export function useWishlistQuery(params: WishlistListParams = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.wishlist.list(params),
    queryFn: () => wishlistApi.list(params),
    enabled,
  });
}

export function useCreateWishlistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WishlistItemCreate) => wishlistApi.addItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all });
    },
  });
}

export function useUpdateWishlistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WishlistItemUpdate }) =>
      wishlistApi.updateItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all });
    },
  });
}

export function useDeleteWishlistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wishlistApi.removeItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all });
    },
  });
}

export function useConvertWishlistToLibraryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WishlistConvertToLibraryRequest }) =>
      wishlistApi.convertToLibrary(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all });
    },
  });
}

// ======================== PHASE 5H: SETTINGS ========================

export function useAppSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.list,
    queryFn: () => settingsApi.getAll(),
  });
}

export function useUpdateAppSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => settingsApi.setBatch(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

// ======================== PHASE 5I: BACKUP & RESTORE ========================

export function useBackupsListQuery() {
  return useQuery({
    queryKey: queryKeys.backup.list,
    queryFn: () => backupApi.list(),
  });
}

export function useCreateBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backup.all });
    },
  });
}

export function useRestoreBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => backupApi.restore(filename),
    onSuccess: () => {
      queryClient.invalidateQueries(); // Invalidate all cached data after restore
    },
  });
}

export function useClearArtworkCacheMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => backupApi.clearArtworkCache(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artwork.all });
    },
  });
}
