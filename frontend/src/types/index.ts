export type AccentToken =
  | 'primary'
  | 'accent-gold'
  | 'accent-amber'
  | 'accent-blue'
  | 'accent-yellow'
  | 'accent-violet'
  | 'accent-crimson'
  | 'accent-emerald'
  | 'accent-rose';

export type PlayingStatus =
  | 'Planned'
  | 'Currently Playing'
  | 'On Hold'
  | 'Completed'
  | '100% Completed'
  | 'Dropped';

export type OwnershipStatus =
  | 'Owned'
  | 'Family Shared'
  | 'To Buy'
  | 'Subscription'
  | 'Unknown';

export type PriorityLevel = 'Low' | 'Medium' | 'High';

export type CompletionGoal =
  | 'Main Story'
  | 'Main + Side Quests'
  | '100% Completion';

export const PLAYING_STATUSES: PlayingStatus[] = [
  'Planned',
  'Currently Playing',
  'On Hold',
  'Completed',
  '100% Completed',
  'Dropped',
];

export const OWNERSHIP_STATUSES: OwnershipStatus[] = [
  'Owned',
  'Family Shared',
  'To Buy',
  'Subscription',
  'Unknown',
];

export const PRIORITY_LEVELS: PriorityLevel[] = ['Low', 'Medium', 'High'];

export const COMPLETION_GOALS: CompletionGoal[] = [
  'Main Story',
  'Main + Side Quests',
  '100% Completion',
];

export const SUPPORTED_PLATFORMS: string[] = [
  'Steam',
  'GOG',
  'Epic Games',
  'Xbox',
  'PlayStation',
  'Ubisoft Connect',
  'EA App',
  'Battle.net',
  'Nintendo Switch',
  'Other',
];

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface BackendHealthStatus {
  status: 'healthy' | 'degraded' | string;
  version: string;
  database: string;
  storage_dir: string;
  uptime_seconds: number;
}

export interface IntegrationStatus {
  igdb_connected: boolean;
  steamgriddb_connected: boolean;
  twitch_token_active: boolean;
  steam_connected?: boolean;
  itad_connected?: boolean;
  details?: Record<string, string>;
}

export interface TestServiceConnectionRequest {
  service: string; // 'igdb' | 'steamgriddb' | 'itad' | 'steam'
  client_id?: string | null;
  client_secret?: string | null;
  api_key?: string | null;
  steam_id_64?: string | null;
}

export interface TestServiceConnectionResponse {
  service: string;
  status: 'connected' | 'authentication_failed' | 'unreachable' | 'not_configured';
  message: string;
  latency_ms?: number | null;
}

export interface SystemStatsResponse {
  total_library_games: number;
  completed_games: number;
  total_hours_logged: number;
  backlog_count: number;
  hours_by_genre: Record<string, number>;
  games_by_platform: Record<string, number>;
}

export interface GenreRead {
  id: number;
  name: string;
  slug: string | null;
}

export interface ThemeRead {
  id: number;
  name: string;
  slug: string | null;
}

export interface FranchiseRead {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ArtworkRead {
  id: string;
  game_id: string;
  asset_type: 'cover' | 'hero' | 'logo' | 'screenshot' | string;
  remote_url: string;
  local_path: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_active: boolean;
  is_animated: boolean;
  source: string;
  author: string | null;
  cached_url: string | null;
  artwork_type?: string;
  url?: string;
}

export interface GameArtworkBundle {
  cover_url: string | null;
  hero_url: string | null;
  logo_url: string | null;
}

export interface GameRead {
  id: string;
  igdb_id: number;
  title: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  igdb_rating: number | null;
  igdb_rating_count: number | null;
  game_type: string | null;
  steam_app_id: number | null;
  platforms: string[];
  franchise: FranchiseRead | null;
  franchises?: FranchiseRead[];
  genres: GenreRead[];
  themes: ThemeRead[];
  artworks: ArtworkRead[];
  created_at: string;
  updated_at: string;
}

export interface LibraryEntryRead {
  id: string;
  game_id: string;
  playing_status: PlayingStatus | string;
  ownership_status: OwnershipStatus | string;
  platform: string;
  priority: PriorityLevel | string;
  queue_position: number;
  progress_pct: number;
  hours_played: number;
  playtime_hours?: number;
  personal_rating: number | null;
  completion_goal: CompletionGoal | string;
  planned_start_date: string | null;
  target_completion_date: string | null;
  custom_tags: string;
  is_favorite: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  game: GameRead;
  artwork: GameArtworkBundle | null;
  active_accent: string | null;
}

export interface LibraryEntryCreate {
  igdb_id: number;
  playing_status?: PlayingStatus | string;
  ownership_status?: OwnershipStatus | string;
  platform?: string;
  priority?: PriorityLevel | string;
  completion_goal?: CompletionGoal | string;
  planned_start_date?: string | null;
  target_completion_date?: string | null;
  custom_tags?: string;
  notes?: string;
  progress_pct?: number;
  hours_played?: number;
  personal_rating?: number | null;
}

export interface LibraryEntryUpdate {
  playing_status?: PlayingStatus | string;
  ownership_status?: OwnershipStatus | string;
  platform?: string;
  priority?: PriorityLevel | string;
  completion_goal?: CompletionGoal | string;
  progress_pct?: number;
  hours_played?: number;
  personal_rating?: number | null;
  planned_start_date?: string | null;
  target_completion_date?: string | null;
  custom_tags?: string;
  is_favorite?: boolean;
  notes?: string;
  queue_position?: number;
}

export interface IGDBSearchResultItem {
  igdb_id: number;
  title: string;
  slug: string;
  category: string | null;
  game_type: number | null;
  version_parent: number | null;
  parent_game: number | null;
  release_year: number | null;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  platforms: string[];
  igdb_rating: number | null;
  cover_url: string | null;
  in_library: boolean;
  library_entry_id: string | null;
}

export interface IGDBSearchResponse {
  data: IGDBSearchResultItem[];
}

export interface IGDBGameDetails {
  igdb_id: number;
  title: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  igdb_rating: number | null;
  igdb_rating_count: number | null;
  game_type: string;
  version_parent: number | null;
  parent_game: number | null;
  steam_app_id: number | null;
  cover_url: string | null;
  hero_url: string | null;
  screenshots: string[];
  platforms: string[];
  franchise_name: string | null;
  franchise_slug: string | null;
  genres: { id: number; name: string; slug: string | null }[];
  themes: { id: number; name: string; slug: string | null }[];
}

export interface SteamGridDBItem {
  id: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
  author: string | null;
  score: number | null;
}

export interface SteamGridDBAssetsResponse {
  game_id: string;
  grids: SteamGridDBItem[];
  heroes: SteamGridDBItem[];
  logos: SteamGridDBItem[];
  icons: SteamGridDBItem[];
}

export interface ArtworkSelectRequest {
  asset_id?: string | null;
  game_id?: string | null;
  asset_type?: 'cover' | 'hero' | 'logo' | string | null;
  steamgriddb_url?: string | null;
  width?: number | null;
  height?: number | null;
  author?: string | null;
}

export interface CacheStatusResponse {
  status: string;
  cache_directory: string;
  total_files: number;
  total_size_bytes: number;
  formatted_size: string;
  by_category: Record<string, { count: number; size_bytes: number }>;
}

// ---------------- Phase 5: Backlog Management ----------------

export interface BacklogSummaryResponse {
  total_planned: number;
  up_next: LibraryEntryRead | null;
  queue: LibraryEntryRead[];
}

export interface BacklogReorderItem {
  entry_id: string;
  queue_position: number;
}

// ---------------- Phase 5: Gaming Planner ----------------

export type ScheduledSessionStatus =
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Missed';

export interface ScheduledSessionRead {
  id: string;
  library_entry_id: string;
  scheduled_start: string;
  duration_minutes: number;
  reminder_minutes_before: number | null;
  repeat_schedule: string;
  status: ScheduledSessionStatus | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  library_entry: LibraryEntryRead | null;
  conflict_warning?: string | null;
}

export interface ScheduledSessionCreate {
  library_entry_id: string;
  scheduled_start: string;
  duration_minutes?: number;
  reminder_minutes_before?: number | null;
  repeat_schedule?: string;
  status?: string;
  notes?: string | null;
}

export interface ScheduledSessionUpdate {
  scheduled_start?: string;
  duration_minutes?: number;
  reminder_minutes_before?: number | null;
  repeat_schedule?: string;
  status?: string;
  notes?: string | null;
}

export interface ScheduledSessionCompleteRequest {
  actual_duration_minutes?: number | null;
  log_as_play_session?: boolean;
  notes?: string | null;
}

// ---------------- Phase 5: Play Sessions & Live Timer ----------------

export interface ActiveSessionRead {
  id: string;
  library_entry_id: string;
  start_time: string;
  paused_at: string | null;
  accumulated_seconds: number;
  location_or_chapter: string | null;
  notes: string | null;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
  elapsed_seconds: number;
  library_entry: LibraryEntryRead | null;
}

export interface ActiveSessionStart {
  library_entry_id: string;
  location_or_chapter?: string | null;
  notes?: string | null;
}

export interface ActiveSessionEndRequest {
  notes?: string | null;
  location_or_chapter?: string | null;
  progress_pct?: number | null;
}

export interface PlaySessionRead {
  id: string;
  library_entry_id: string;
  session_date: string;
  duration_minutes: number;
  location_or_chapter: string | null;
  notes: string | null;
  created_at: string;
  library_entry?: LibraryEntryRead | null;
}

export interface PlaySessionCreate {
  library_entry_id: string;
  duration_minutes: number;
  session_date?: string | null;
  location_or_chapter?: string | null;
  notes?: string | null;
}

export interface PlaySessionUpdate {
  duration_minutes?: number;
  session_date?: string | null;
  location_or_chapter?: string | null;
  notes?: string | null;
}

// ---------------- Phase 5: Collections & Franchises ----------------

export interface CollectionItemRead {
  collection_id: string;
  library_entry_id: string;
  display_order: number;
  library_entry: LibraryEntryRead;
}

export interface CollectionItemAdd {
  library_entry_id: string;
  notes?: string | null;
}

export interface CollectionRead {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  display_order: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  game_count: number;
  completed_count: number;
  total_hours: number;
  items: CollectionItemRead[];
}

export interface CollectionCreate {
  name: string;
  description?: string | null;
  banner_url?: string | null;
  is_pinned?: boolean;
  display_order?: number;
}

export interface CollectionUpdate {
  name?: string;
  description?: string | null;
  banner_url?: string | null;
  is_pinned?: boolean;
  display_order?: number;
}

export interface FranchiseGameItem {
  id?: string;
  game_id: string;
  title: string;
  release_date: string | null;
  franchise_order: number;
  library_entry: LibraryEntryRead | null;
}

export interface FranchiseDetailRead {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  total_games: number;
  owned_games: number;
  completed_games: number;
  library_count?: number;
  games: FranchiseGameItem[];
}

// ---------------- Phase 5: Gaming Journal ----------------

export type JournalEntryType =
  | 'Note'
  | 'Review'
  | 'Milestone'
  | 'Boss Fight'
  | 'Summary';

export interface JournalEntryRead {
  id: string;
  library_entry_id: string | null;
  title: string;
  content_markdown: string;
  content?: string;
  entry_date: string;
  entry_type: JournalEntryType | string;
  is_spoiler: boolean;
  personal_rating: number | null;
  created_at: string;
  updated_at: string;
  library_entry: LibraryEntryRead | null;
}

export interface JournalEntryCreate {
  library_entry_id?: string | null;
  title: string;
  content_markdown?: string;
  content?: string;
  entry_date?: string | null;
  entry_type?: JournalEntryType | string;
  is_spoiler?: boolean;
  personal_rating?: number | null;
}

export interface JournalEntryUpdate {
  title?: string;
  content_markdown?: string;
  content?: string;
  entry_date?: string | null;
  entry_type?: JournalEntryType | string;
  is_spoiler?: boolean;
  personal_rating?: number | null;
}

// ---------------- Phase 5: Gaming Analytics ----------------

export interface MonthlyActivityItem {
  month: string;
  hours_played: number;
  sessions_count: number;
  completed_count: number;
}

export interface GenreStatsItem {
  genre: string;
  hours_played: number;
  game_count: number;
}

export interface PlatformStatsItem {
  platform: string;
  game_count: number;
  hours_played: number;
}

export interface MostPlayedGameItem {
  entry_id: string;
  title: string;
  hours_played: number;
  playtime_hours?: number;
  personal_rating: number | null;
  cover_url: string | null;
  platform: string;
  playing_status: string;
}

export interface FranchiseProgressItem {
  franchise_name: string;
  total_games: number;
  completed_games: number;
  completion_pct: number;
  total_hours: number;
}

export interface HeatmapDayItem {
  date: string;
  minutes: number;
  session_count: number;
}

export interface GamingStatsResponse {
  total_games: number;
  currently_playing: number;
  planned: number;
  completed: number;
  one_hundred_percent: number;
  on_hold: number;
  dropped: number;
  wishlist_count: number;
  total_hours_logged: number;
  steam_total_hours?: number;
  combined_total_hours?: number;
  average_personal_rating: number | null;
  rated_games_count?: number;
  rating_distribution?: Record<string, number>;
  backlog_completion_pct: number;
  monthly_activity: MonthlyActivityItem[];
  hours_by_genre: GenreStatsItem[];
  platform_distribution: PlatformStatsItem[];
  most_played_games: MostPlayedGameItem[];
  franchise_progress: FranchiseProgressItem[];
  heatmap: HeatmapDayItem[];
  yearly_summary: Record<string, { hours: number; sessions: number; completed: number }>;
}

// ---------------- Phase 5: Wishlist ----------------

export interface WishlistItemRead {
  id: string;
  game_id: string;
  priority: string;
  target_price: number | null;
  currency: string;
  store_preference: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  game: GameRead;
}

export interface WishlistItemCreate {
  igdb_id: number;
  priority?: string;
  target_price?: number | null;
  currency?: string;
  store_preference?: string;
  notes?: string | null;
}

export interface WishlistItemUpdate {
  priority?: string;
  target_price?: number | null;
  currency?: string;
  store_preference?: string;
  notes?: string | null;
}

export interface WishlistConvertToLibraryRequest {
  playing_status?: string;
  ownership_status?: string;
  platform?: string;
  priority?: string;
}

// ---------------- Phase 5: Backup & Restore ----------------

export interface BackupFileItem {
  filename: string;
  created_at: string;
  size_bytes: number;
  formatted_size: string;
  is_auto_safety: boolean;
}

export interface BackupCreateResponse {
  status: string;
  backup_filename: string;
  backup_path: string;
  size_bytes: number;
  formatted_size: string;
  timestamp: string;
}

export interface RestoreResponse {
  status: string;
  restored_from: string;
  safety_backup_created: string;
  message: string;
}

export interface LibraryImportResult {
  imported_games: number;
  skipped_duplicates: number;
  imported_sessions: number;
  imported_journals: number;
  imported_collections: number;
  imported_wishlist: number;
  errors: string[];
}

// ---------------- Phase 6: Steam Integration, Automation & Launcher ----------------

export interface SteamAccountStatus {
  is_connected: boolean;
  steam_id_64?: string | null;
  persona_name?: string | null;
  avatar_url?: string | null;
  profile_url?: string | null;
  is_private: boolean;
  auto_sync_enabled: boolean;
  sync_interval_hours: number;
  last_synced_at?: string | null;
  has_api_key: boolean;
  privacy_warning?: string | null;
}

export interface SteamTestConnectionRequest {
  steam_id_64: string;
  api_key?: string | null;
}

export interface SteamTestConnectionResponse {
  success: boolean;
  persona_name?: string | null;
  avatar_url?: string | null;
  profile_url?: string | null;
  is_private: boolean;
  message: string;
  privacy_warning?: string | null;
}

export interface SteamConnectRequest {
  steam_id_64: string;
  api_key?: string | null;
  auto_sync_enabled?: boolean;
  sync_interval_hours?: number;
}

export interface SteamGamePreview {
  steam_app_id: number;
  title: string;
  playtime_forever_minutes: number;
  last_played_timestamp?: number | null;
  igdb_id?: number | null;
  cover_url?: string | null;
  ownership_status: string;
  already_imported: boolean;
  library_entry_id?: string | null;
}

export interface SteamImportPreviewResponse {
  total_found: number;
  new_games: SteamGamePreview[];
  existing_games: SteamGamePreview[];
  unmatched_games: SteamGamePreview[];
}

export interface SteamImportExecuteRequest {
  app_ids: number[];
  ownership_status_overrides?: Record<number, string>;
}

export interface SteamImportExecuteResponse {
  imported_count: number;
  updated_count: number;
  failed_count: number;
  message: string;
}

export interface SteamAchievementItem {
  id: string;
  api_name: string;
  display_name: string;
  description?: string | null;
  icon_url?: string | null;
  icon_gray_url?: string | null;
  is_hidden: boolean;
  unlocked: boolean;
  unlock_time?: string | null;
  global_percentage?: number | null;
}

export interface GameAchievementsResponse {
  game_id: string;
  steam_app_id?: number | null;
  total_count: number;
  unlocked_count: number;
  completion_pct: number;
  completion_suggestion: boolean;
  last_synced_at?: string | null;
  is_available: boolean;
  message?: string | null;
  achievements: SteamAchievementItem[];
}

export interface InstalledGameInfo {
  steam_app_id: number;
  title: string;
  install_dir: string;
  executable_path?: string | null;
  size_on_disk_bytes?: number | null;
}

export interface DetectorStatusResponse {
  is_enabled: boolean;
  is_monitoring: boolean;
  detected_libraries: string[];
  running_game?: {
    game_id: string;
    library_entry_id: string;
    title: string;
    pid: number;
    executable: string;
    matched_by: string;
  } | null;
}

export interface LaunchConfigResponse {
  game_id: string;
  title: string;
  launch_type: 'steam' | 'executable' | 'unconfigured';
  steam_app_id?: number | null;
  executable_path?: string | null;
  launch_arguments?: string | null;
  is_installed: boolean;
}

export interface SetLaunchConfigRequest {
  executable_path?: string | null;
  launch_arguments?: string | null;
}

export interface PriceInfoItem {
  game_id: string;
  title: string;
  current_price?: number | null;
  regular_price?: number | null;
  discount_percent: number;
  historical_low_price?: number | null;
  store_deal_name?: string | null;
  deal_url?: string | null;
  currency: string;
  is_deal_active: boolean;
  target_price?: number | null;
  price_updated_at?: string | null;
}

export interface WishlistPricesResponse {
  has_api_key: boolean;
  currency: string;
  items: PriceInfoItem[];
  deals_meeting_target: number;
  last_updated?: string | null;
}

