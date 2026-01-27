// Show tracking status
export type ShowStatus = 'watching' | 'waiting' | 'watchlist' | 'completed' | 'dropped';

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
  status: ShowStatus;
  added_at: string;
  total_seasons: number;
  total_episodes: number;
  aired_episodes: number | null;
  streaming_services: string[];
  local_id: string | null;
  synced_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  vote_average?: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
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

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  ShowDetail: { show: TrackedShow };
  AddShow: { tmdbShow: TMDBShow };
  Auth: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  UpNext: undefined;
  MyShows: undefined;
  Search: undefined;
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
export type RatingType = 'show' | 'season' | 'episode';

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
