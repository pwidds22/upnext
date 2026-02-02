// Media type discriminator
export type MediaType = 'tv' | 'movie';

// Show tracking status
export type ShowStatus = 'watching' | 'waiting' | 'watchlist' | 'completed' | 'dropped';

// Movie tracking status (subset - movies don't have "watching" progression)
export type MovieStatus = 'watchlist' | 'watched' | 'dropped';

// Sync status for offline-first architecture
export type SyncStatus = 'pending' | 'synced' | 'error';

// Sync operation types
export type SyncOperation = 'create' | 'update' | 'delete';

// Sync state for context
export type SyncState = 'idle' | 'syncing' | 'error';

// Supabase row types (match database schema)
export interface UserShowRow {
  id: string;
  user_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  status: ShowStatus | MovieStatus;
  added_at: string;
  total_seasons: number;
  total_episodes: number;
  aired_episodes: number | null;
  streaming_services: string[];
  local_id: string | null;
  synced_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Movie support fields
  media_type: MediaType;
  release_date: string | null;
  runtime: number | null;
}

export interface UserWatchedEpisodeRow {
  id: string;
  user_id: string;
  user_show_id: string | null;
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
  episode_title: string | null;
  still_path: string | null;
  local_id: string | null;
  synced_at: string;
  deleted_at: string | null;
}

// Sync result for reporting
export interface SyncResult {
  success: boolean;
  pushed: { shows: number; episodes: number };
  pulled: { shows: number; episodes: number };
  conflicts: number;
  errors: string[];
}

// Sync queue item
export interface SyncQueueItem {
  id: number;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  payload: string; // JSON string
  createdAt: string;
  attempts: number;
  lastError?: string;
}

// Locally stored tracked show
export interface TrackedShow {
  mediaType: 'tv';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  status: ShowStatus;
  addedAt: string; // ISO date string
  totalSeasons: number;
  totalEpisodes: number;
  airedEpisodes?: number; // Episodes that have actually aired (for accurate progress)
  streamingServices: string[];
  // Sync fields (optional - not present in legacy data)
  syncStatus?: SyncStatus;
  remoteId?: string;
  lastSyncedAt?: string;
}

// Locally stored tracked movie
export interface TrackedMovie {
  mediaType: 'movie';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  status: MovieStatus;
  addedAt: string; // ISO date string
  releaseDate: string | null;
  runtime: number | null; // minutes
  streamingServices: string[];
  // Sync fields (optional - not present in legacy data)
  syncStatus?: SyncStatus;
  remoteId?: string;
  lastSyncedAt?: string;
}

// Union type for library items
export type TrackedMedia = TrackedShow | TrackedMovie;

// Locally stored watched episode
export interface WatchedEpisode {
  id: string; // Unique ID for the record
  showTmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string; // ISO date string
  episodeTitle?: string;
  stillPath?: string;
  // Sync fields (optional - not present in legacy data)
  syncStatus?: SyncStatus;
  remoteId?: string;
  lastSyncedAt?: string;
}

// TMDB API Response Types
export interface TMDBSearchResponse {
  page: number;
  results: TMDBShow[];
  total_pages: number;
  total_results: number;
}

export interface TMDBShow {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  first_air_date: string | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  status: string | null;
  genres?: TMDBGenre[];
  networks?: TMDBNetwork[];
  vote_average?: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBNetwork {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string | null;
  overview: string | null;
  episode_count: number | null;
  episodes: TMDBEpisode[] | null;
  poster_path: string | null;
  air_date: string | null;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string | null;
  season_number: number;
  episode_number: number;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average?: number;
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: Record<string, TMDBCountryProviders>;
}

export interface TMDBCountryProviders {
  link?: string;
  flatrate?: TMDBProvider[];
  buy?: TMDBProvider[];
  rent?: TMDBProvider[];
  free?: TMDBProvider[];
}

export interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

// Movie-specific TMDB types
export interface TMDBMovieSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  release_date: string | null;
  runtime: number | null;
  genres?: TMDBGenre[];
  vote_average?: number;
  vote_count?: number;
  status?: string;
  tagline?: string;
  production_companies?: Array<{
    id: number;
    name: string;
    logo_path: string | null;
  }>;
}

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  ShowDetail: { show: TrackedShow };
  AddShow: { tmdbShow: TMDBShow };
  MovieDetail: { movie: TrackedMovie };
  AddMovie: { tmdbMovie: TMDBMovie };
  Auth: undefined;
  Profile: undefined;
  UserSearch: undefined;
  UserProfile: { userId: string } | { username: string };
  Followers: { userId: string; username?: string };
  Following: { userId: string; username?: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  UpNext: undefined;
  Library: undefined;
  Search: undefined;
  Activity: undefined;
};

// Up Next episode type
export interface UpNextEpisode {
  id: string;
  show: TrackedShow;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  stillPath: string | null;
  airDate: string | null;
  isUpcoming: boolean;
}

// Rating types
export type RatingType = 'show' | 'season' | 'episode' | 'movie';

export interface UserRating {
  id: string;
  userId: string;
  tmdbId: number;
  ratingType: RatingType;
  seasonNumber?: number;
  episodeNumber?: number;
  rating: number; // 0-10 scale
  review?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// Rating with user info for public ratings display
export interface RatingWithUser extends UserRating {
  user: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

// Episode reaction types
export type EpisodeReactionType = 'good' | 'meh' | 'bad';

// Reaction display configuration
export const REACTION_CONFIG = {
  good: {
    emoji: '👍',
    label: 'Good',
    color: '#34C759', // Green
  },
  meh: {
    emoji: '😐',
    label: 'Meh',
    color: '#8E8E93', // Gray
  },
  bad: {
    emoji: '👎',
    label: 'Bad',
    color: '#FF3B30', // Red
  },
} as const;

// Locally stored episode reaction
export interface EpisodeReaction {
  id: string;
  showTmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  reaction: EpisodeReactionType;
  createdAt: string;
  updatedAt: string;
  // Sync fields
  syncStatus?: SyncStatus;
  remoteId?: string;
  lastSyncedAt?: string;
}

// Supabase row type for episode reactions
export interface UserEpisodeReactionRow {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  reaction: EpisodeReactionType;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Follow system types

// Supabase row type for follows
export interface UserFollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Profile visibility settings (for share profile feature)
export interface ProfileVisibility {
  shows: boolean;
  activity: boolean;
  stats: boolean;
}

// Profile stats for display
export interface ProfileStats {
  totalShows: number;
  totalMovies: number;
  totalEpisodes: number;
}

// Profile row type (matches database)
export interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_searchable: boolean;
  visibility_shows: boolean;
  visibility_activity: boolean;
  visibility_stats: boolean;
}

// App-level user profile type
export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  visibility?: ProfileVisibility;
}

// User with follow status for lists
export interface UserWithFollowStatus extends UserProfile {
  isFollowing: boolean;
  isFollowedBy: boolean;
}

// Follow counts
export interface FollowCounts {
  followers: number;
  following: number;
}

// Friend rating for show detail
export interface FriendRating {
  user: UserProfile;
  rating: number;
}

// Dismissed show recommendation (local)
export interface DismissedShow {
  id: string;
  tmdbId: number;
  dismissedAt: string;
  // Sync fields
  syncStatus?: SyncStatus;
  remoteId?: string;
  lastSyncedAt?: string;
}

// Supabase row type for dismissed shows
export interface UserDismissedShowRow {
  id: string;
  user_id: string;
  tmdb_id: number;
  dismissed_at: string;
  deleted_at: string | null;
}

// Activity Feed types
export type ActivityType = 'episode_watch' | 'show_add' | 'movie_watch' | 'rating' | 'reaction';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  userId: string;
  user: UserProfile;
  tmdbId: number;
  showTitle: string; // Also used for movie title
  posterPath: string | null;
  timestamp: string;
  mediaType?: MediaType; // 'tv' or 'movie'
  // Type-specific data
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  rating?: number;
  ratingType?: RatingType; // For rating activities: show, season, episode, or movie
  reaction?: EpisodeReactionType;
  showStatus?: ShowStatus;
  movieStatus?: MovieStatus;
  // Aggregation data (for batched episode watches)
  isAggregated?: boolean;
  episodeCount?: number;
  seasonCompleted?: number; // If they finished a full season
  episodes?: Array<{ seasonNumber: number; episodeNumber: number; episodeTitle?: string }>;
}

// Friends watching aggregated show
export interface FriendsWatchingShow {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  friends: UserProfile[];
  friendCount: number;
}

// Watch History Types (for rewatch tracking)

// Episode watch history entry (each watch is a separate record)
export interface EpisodeWatchHistory {
  id: string; // Unique ID for this watch instance
  showTmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string; // ISO date string
  episodeTitle?: string;
  // Sync fields
  syncStatus?: SyncStatus;
  remoteId?: string;
}

// Movie watch history entry (each watch is a separate record)
export interface MovieWatchHistory {
  id: string; // Unique ID for this watch instance
  movieTmdbId: number;
  watchedAt: string; // ISO date string
  // Sync fields
  syncStatus?: SyncStatus;
  remoteId?: string;
}

// Supabase row type for episode watch history
export interface UserEpisodeWatchHistoryRow {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
  episode_title: string | null;
  local_id: string | null;
  synced_at: string;
  deleted_at: string | null;
}

// Supabase row type for movie watch history
export interface UserMovieWatchHistoryRow {
  id: string;
  user_id: string;
  tmdb_movie_id: number;
  watched_at: string;
  local_id: string | null;
  synced_at: string;
  deleted_at: string | null;
}

// Watch history summary for UI display
export interface WatchHistorySummary {
  totalWatches: number;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  watches: Array<{ id: string; watchedAt: string }>;
}
