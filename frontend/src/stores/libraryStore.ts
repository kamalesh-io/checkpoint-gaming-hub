import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LibraryViewMode = 'grid' | 'list' | 'cinematic';
export type LibrarySortMode =
  | 'recently_played'
  | 'title_asc'
  | 'progress_desc'
  | 'priority_desc'
  | 'rating_desc';

interface LibraryPreferencesState {
  viewMode: LibraryViewMode;
  cardSize: 1 | 2 | 3; // 1 = compact (more columns), 2 = default, 3 = large
  statusFilter: string;
  ownershipFilter: string;
  platformFilter: string;
  genreFilter: string;
  groupByFranchise: boolean;
  sortBy: LibrarySortMode;
  searchFilter: string;
  setViewMode: (mode: LibraryViewMode) => void;
  setCardSize: (size: 1 | 2 | 3) => void;
  setStatusFilter: (status: string) => void;
  setOwnershipFilter: (ownership: string) => void;
  setPlatformFilter: (platform: string) => void;
  setGenreFilter: (genre: string) => void;
  setGroupByFranchise: (enabled: boolean) => void;
  setSortBy: (sort: LibrarySortMode) => void;
  setSearchFilter: (q: string) => void;
  resetFilters: () => void;
}

export const useLibraryStore = create<LibraryPreferencesState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      cardSize: 2,
      statusFilter: 'all',
      ownershipFilter: 'all',
      platformFilter: 'all',
      genreFilter: 'all',
      groupByFranchise: false,
      sortBy: 'recently_played',
      searchFilter: '',
      setViewMode: (viewMode) => set({ viewMode }),
      setCardSize: (cardSize) => set({ cardSize }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setOwnershipFilter: (ownershipFilter) => set({ ownershipFilter }),
      setPlatformFilter: (platformFilter) => set({ platformFilter }),
      setGenreFilter: (genreFilter) => set({ genreFilter }),
      setGroupByFranchise: (groupByFranchise) => set({ groupByFranchise }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSearchFilter: (searchFilter) => set({ searchFilter }),
      resetFilters: () =>
        set({
          statusFilter: 'all',
          ownershipFilter: 'all',
          platformFilter: 'all',
          genreFilter: 'all',
          groupByFranchise: false,
          sortBy: 'recently_played',
          searchFilter: '',
        }),
    }),
    {
      name: 'checkpoint-library-preferences',
      partialize: (state) => ({
        viewMode: state.viewMode,
        cardSize: state.cardSize,
        sortBy: state.sortBy,
        groupByFranchise: state.groupByFranchise,
      }),
    },
  ),
);
