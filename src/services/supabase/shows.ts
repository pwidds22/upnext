import { supabase } from './client';
import type { TrackedShow, TrackedMovie, TrackedMedia, UserShowRow, ShowStatus, MovieStatus } from '../../types';

// Convert local TrackedShow to Supabase row format
function toSupabaseRow(userId: string, show: TrackedShow): Omit<UserShowRow, 'id' | 'synced_at' | 'updated_at'> {
  return {
    user_id: userId,
    tmdb_id: show.tmdbId,
    title: show.title,
    poster_path: show.posterPath,
    status: show.status,
    added_at: show.addedAt,
    total_seasons: show.totalSeasons,
    total_episodes: show.totalEpisodes,
    aired_episodes: show.airedEpisodes ?? null,
    streaming_services: show.streamingServices,
    local_id: String(show.tmdbId),
    deleted_at: null,
    media_type: 'tv',
    release_date: null,
    runtime: null,
  };
}

// Convert local TrackedMovie to Supabase row format
function movieToSupabaseRow(userId: string, movie: TrackedMovie): Omit<UserShowRow, 'id' | 'synced_at' | 'updated_at'> {
  return {
    user_id: userId,
    tmdb_id: movie.tmdbId,
    title: movie.title,
    poster_path: movie.posterPath,
    status: movie.status,
    added_at: movie.addedAt,
    total_seasons: 0,
    total_episodes: 0,
    aired_episodes: null,
    streaming_services: movie.streamingServices,
    local_id: `movie-${movie.tmdbId}`,
    deleted_at: null,
    media_type: 'movie',
    release_date: movie.releaseDate,
    runtime: movie.runtime,
  };
}

// Convert Supabase row to local TrackedShow format
function fromSupabaseRow(row: UserShowRow): TrackedShow {
  return {
    mediaType: 'tv',
    tmdbId: row.tmdb_id,
    title: row.title,
    posterPath: row.poster_path,
    status: row.status as ShowStatus,
    addedAt: row.added_at,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
    airedEpisodes: row.aired_episodes ?? undefined,
    streamingServices: row.streaming_services ?? [],
    syncStatus: 'synced',
    remoteId: row.id,
    lastSyncedAt: row.synced_at,
  };
}

// Convert Supabase row to local TrackedMovie format
function movieFromSupabaseRow(row: UserShowRow): TrackedMovie {
  return {
    mediaType: 'movie',
    tmdbId: row.tmdb_id,
    title: row.title,
    posterPath: row.poster_path,
    status: row.status as MovieStatus,
    addedAt: row.added_at,
    releaseDate: row.release_date,
    runtime: row.runtime,
    streamingServices: row.streaming_services ?? [],
    syncStatus: 'synced',
    remoteId: row.id,
    lastSyncedAt: row.synced_at,
  };
}

export const showsCloudService = {
  // Fetch all TV shows for a user (excluding soft-deleted)
  async fetchAllShows(userId: string): Promise<TrackedShow[]> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('*')
      .eq('user_id', userId)
      .or('media_type.eq.tv,media_type.is.null')
      .is('deleted_at', null)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch shows updated since a timestamp (for incremental sync)
  async fetchShowsSince(userId: string, since: string): Promise<UserShowRow[]> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Upsert a single show (create or update based on tmdb_id)
  async upsertShow(userId: string, show: TrackedShow): Promise<UserShowRow> {
    const row = toSupabaseRow(userId, show);

    const { data, error } = await supabase
      .from('user_shows')
      .upsert(row, {
        onConflict: 'user_id,tmdb_id,media_type',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Batch upsert shows (for initial sync)
  async upsertShows(userId: string, shows: TrackedShow[]): Promise<UserShowRow[]> {
    if (shows.length === 0) return [];

    const rows = shows.map((show) => toSupabaseRow(userId, show));

    const { data, error } = await supabase
      .from('user_shows')
      .upsert(rows, {
        onConflict: 'user_id,tmdb_id,media_type',
        ignoreDuplicates: false,
      })
      .select();

    if (error) throw error;
    return data ?? [];
  },

  // Update show status only
  async updateShowStatus(userId: string, tmdbId: number, status: ShowStatus): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ status })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', 'tv');

    if (error) throw error;
  },

  // Soft delete a show (set deleted_at)
  async softDeleteShow(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', 'tv');

    if (error) throw error;
  },

  // Get a show's remote ID by tmdb_id
  async getShowRemoteId(userId: string, tmdbId: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('id')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data?.id ?? null;
  },

  // Update show privacy setting
  async updateShowPrivacy(userId: string, tmdbId: number, isPublic: boolean): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ is_public: isPublic })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId);

    if (error) throw error;
  },

  // Get show privacy setting
  async getShowPrivacy(userId: string, tmdbId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('is_public')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    // Default to true (public) if not found
    return data?.is_public ?? true;
  },

  // ==================== MOVIE METHODS ====================

  // Fetch all movies for a user (excluding soft-deleted)
  async fetchAllMovies(userId: string): Promise<TrackedMovie[]> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('*')
      .eq('user_id', userId)
      .eq('media_type', 'movie')
      .is('deleted_at', null)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(movieFromSupabaseRow);
  },

  // Upsert a single movie (create or update based on tmdb_id)
  async upsertMovie(userId: string, movie: TrackedMovie): Promise<UserShowRow> {
    const row = movieToSupabaseRow(userId, movie);

    const { data, error } = await supabase
      .from('user_shows')
      .upsert(row, {
        onConflict: 'user_id,tmdb_id,media_type',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update movie status only
  async updateMovieStatus(userId: string, tmdbId: number, status: MovieStatus): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ status })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', 'movie');

    if (error) throw error;
  },

  // Soft delete a movie (set deleted_at)
  async softDeleteMovie(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', 'movie');

    if (error) throw error;
  },

  // Fetch all media (shows + movies) for library screen
  async fetchAllMedia(userId: string): Promise<TrackedMedia[]> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('added_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      if (row.media_type === 'movie') {
        return movieFromSupabaseRow(row);
      }
      return fromSupabaseRow(row);
    });
  },
};
