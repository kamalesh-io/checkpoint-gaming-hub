import { Navigate, Route, Routes } from 'react-router-dom';
import { BacklogPage } from '@/features/backlog/BacklogPage';
import { BigPictureDiscoverPage } from '@/features/big-picture/BigPictureDiscoverPage';
import { BigPictureHomePage } from '@/features/big-picture/BigPictureHomePage';
import { BigPictureLibraryPage } from '@/features/big-picture/BigPictureLibraryPage';
import { CollectionsPage } from '@/features/collections/CollectionsPage';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { DiscoverPage } from '@/features/discover/DiscoverPage';
import { GameDetailsPage } from '@/features/game-details/GameDetailsPage';
import { JournalPage } from '@/features/journal/JournalPage';
import { MyLibraryPage } from '@/features/library/MyLibraryPage';
import { PlannerPage } from '@/features/planner/PlannerPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StatisticsPage } from '@/features/stats/StatisticsPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { BigPictureLayout } from '@/layouts/BigPictureLayout';
import { RootLayout } from '@/layouts/RootLayout';
import { ROUTES } from './routes';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path={ROUTES.OVERVIEW} element={<OverviewPage />} />
        <Route path={ROUTES.LIBRARY} element={<MyLibraryPage />} />
        <Route path={ROUTES.DISCOVER} element={<DiscoverPage />} />
        <Route path={ROUTES.BACKLOG} element={<BacklogPage />} />
        <Route path={ROUTES.PLANNER} element={<PlannerPage />} />
        <Route path={ROUTES.WISHLIST} element={<WishlistPage />} />
        <Route path={ROUTES.COLLECTIONS} element={<CollectionsPage />} />
        <Route path={ROUTES.JOURNAL} element={<JournalPage />} />
        <Route path={ROUTES.STATISTICS} element={<StatisticsPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path={ROUTES.GAME_DETAILS} element={<GameDetailsPage />} />
        <Route path="*" element={<Navigate to={ROUTES.OVERVIEW} replace />} />
      </Route>

      {/* Fullscreen 10-Foot Console Big Picture Mode */}
      <Route path={ROUTES.BIG_PICTURE} element={<BigPictureLayout />}>
        <Route index element={<BigPictureHomePage />} />
        <Route path="library" element={<BigPictureLibraryPage />} />
        <Route path="discover" element={<BigPictureDiscoverPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="games/:id" element={<GameDetailsPage />} />
        <Route path="*" element={<Navigate to={ROUTES.BIG_PICTURE} replace />} />
      </Route>
    </Routes>
  );
}
