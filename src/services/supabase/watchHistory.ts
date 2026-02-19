import { supabase } from './client';
import type {
  EpisodeWatchHistory,
  MovieWatchHistory,
  UserEpisodeWatchHistoryRow,
  UserMovieWatchHistoryRow,
} from '../../types';

// =============================================================================
// EPISODE WATCH HISTORY
// =============================================================================

// Convert local EpisodeWatchHistory to Supabase row format
function toEpisodeSupabaseRow(
  userId: string,
  watch: EpisodeWatchHistory
): Omit<UserEpisodeWatchHistoryRow, 'id' | 'synced_at'> {
  return {
    user_id: userId,
    tmdb_show_id: watch.showTmdbId,
    season_number: watch.seasonNumber,
    episode_number: watch.episodeNumber,
    watched_at: watch.watchedAt,
    episode_title: watch.episodeTitle ?? null,
    local_id: watch.id,
    deleted_at: null,
  };
}

// Convert Supabase row to local EpisodeWatchHistory format
function fromEpisodeSupabaseRow(row: UserEpisodeWatchHistoryRow): EpisodeWatchHistory {
  return {
    id: row.local_id ?? row.id,
    showTmdbId: row.tmdb_show_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    watchedAt: row.watched_at,
    episodeTitle: row.episode_title ?? undefined,
    syncStatus: 'synced',
    remoteId: row.id,
  };
}

// =============================================================================
// MOVIE WATCH HISTORY
// =============================================================================

// Convert local MovieWatchHistory to Supabase row format
function toMovieSupabaseRow(
  userId: string,
  watch: MovieWatchHistory
): Omit<UserMovieWatchHistoryRow, 'id' | 'synced_at'> {
  return {
    user_id: userId,
    tmdb_movie_id: watch.movieTmdbId,
    watched_at: watch.watchedAt,
    local_id: watch.id,
    deleted_at: null,
  };
}

// Convert Supabase row to local MovieWatchHistory format
function fromMovieSupabaseRow(row: UserMovieWatchHistoryRow): MovieWatchHistory {
  return {
    id: row.local_id ?? row.id,
    movieTmdbId: row.tmdb_movie_id,
    watchedAt: row.watched_at,
    syncStatus: 'synced',
    remoteId: row.id,
  };
}

// =============================================================================
// EPISODE WATCH HISTORY SERVICE
// =============================================================================

export const episodeWatchHistoryService = {
  // Fetch all episode watch history for a user
  async fetchAllWatchHistory(userId: string): Promise<EpisodeWatchHistory[]> {
    const { data, error } = await supabase
      .from('user_episode_watch_history')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromEpisodeSupabaseRow);
  },

  // Fetch watch history for a specific episode
  async fetchEpisodeWatchHistory(
    userId: string,
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeWatchHistory[]> {
    const { data, error } = await supabase
      .from('user_episode_watch_history')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromEpisodeSupabaseRow);
  },

  // Fetch watch history for a show (all episodes)
  async fetchShowWatchHistory(userId: string, tmdbShowId: number): Promise<EpisodeWatchHistory[]> {
    const { data, error } = await supabase
      .from('user_episode_watch_history')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromEpisodeSupabaseRow);
  },

  // Fetch watch history updated since a timestamp (for incremental sync)
  async fetchWatchHistorySince(userId: string, since: string): Promise<UserEpisodeWatchHistoryRow[]> {
    const { data, error } = await supabase
      .from('user_episode_watch_history')
      .select('*')
      .eq('user_id', userId)
      .gt('synced_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Insert a new watch (skips duplicates via unique index)
  async insertWatch(userId: string, watch: EpisodeWatchHistory): Promise<UserEpisodeWatchHistoryRow | null> {
    const row = toEpisodeSupabaseRow(userId, watch);

    const { data, error } = await supabase
      .from('user_episode_watch_history')
      .insert(row)
      .select()
      .single();

    // 23505 = unique_violation — record already exists, skip silently
    if (error && error.code === '23505') return null;
    if (error) throw error;
    return data;
  },

  // Batch insert watches (inserts one by one to skip duplicates gracefully)
  async insertWatches(userId: string, watches: EpisodeWatchHistory[]): Promise<UserEpisodeWatchHistoryRow[]> {
    if (watches.length === 0) return [];

    const results: UserEpisodeWatchHistoryRow[] = [];
    for (const w of watches) {
      const result = await this.insertWatch(userId, w);
      if (result) results.push(result);
    }
    return results;
  },

  // Soft delete a specific watch by remote ID
  async softDeleteWatch(watchId: string): Promise<void> {
    const { error } = await supabase
      .from('user_episode_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', watchId);

    if (error) throw error;
  },

  // Soft delete a watch by local ID
  async softDeleteWatchByLocalId(userId: string, localId: string): Promise<void> {
    const { error } = await supabase
      .from('user_episode_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('local_id', localId);

    if (error) throw error;
  },

  // Soft delete all watches for a show
  async softDeleteShowWatches(userId: string, tmdbShowId: number): Promise<void> {
    const { error } = await supabase
      .from('user_episode_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId);

    if (error) throw error;
  },

  // Soft delete all watches for an episode
  async softDeleteEpisodeWatches(
    userId: string,
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    const { error } = await supabase
      .from('user_episode_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber);

    if (error) throw error;
  },

  // Get watch count for an episode (for a user)
  async getEpisodeWatchCount(
    userId: string,
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<number> {
    const { count, error } = await supabase
      .from('user_episode_watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .is('deleted_at', null);

    if (error) throw error;
    return count ?? 0;
  },
};

// =============================================================================
// MOVIE WATCH HISTORY SERVICE
// =============================================================================

export const movieWatchHistoryService = {
  // Fetch all movie watch history for a user
  async fetchAllWatchHistory(userId: string): Promise<MovieWatchHistory[]> {
    const { data, error } = await supabase
      .from('user_movie_watch_history')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromMovieSupabaseRow);
  },

  // Fetch watch history for a specific movie
  async fetchMovieWatchHistory(userId: string, tmdbMovieId: number): Promise<MovieWatchHistory[]> {
    const { data, error } = await supabase
      .from('user_movie_watch_history')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_movie_id', tmdbMovieId)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromMovieSupabaseRow);
  },

  // Fetch watch history updated since a timestamp (for incremental sync)
  async fetchWatchHistorySince(userId: string, since: string): Promise<UserMovieWatchHistoryRow[]> {
    const { data, error } = await supabase
      .from('user_movie_watch_history')
      .select('*')
      .eq('user_id', userId)
      .gt('synced_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Insert a new watch (skips duplicates via unique index)
  async insertWatch(userId: string, watch: MovieWatchHistory): Promise<UserMovieWatchHistoryRow | null> {
    const row = toMovieSupabaseRow(userId, watch);

    const { data, error } = await supabase
      .from('user_movie_watch_history')
      .insert(row)
      .select()
      .single();

    // 23505 = unique_violation — record already exists, skip silently
    if (error && error.code === '23505') return null;
    if (error) throw error;
    return data;
  },

  // Batch insert watches (inserts one by one to skip duplicates gracefully)
  async insertWatches(userId: string, watches: MovieWatchHistory[]): Promise<UserMovieWatchHistoryRow[]> {
    if (watches.length === 0) return [];

    const results: UserMovieWatchHistoryRow[] = [];
    for (const w of watches) {
      const result = await this.insertWatch(userId, w);
      if (result) results.push(result);
    }
    return results;
  },

  // Soft delete a specific watch by remote ID
  async softDeleteWatch(watchId: string): Promise<void> {
    const { error } = await supabase
      .from('user_movie_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', watchId);

    if (error) throw error;
  },

  // Soft delete a watch by local ID
  async softDeleteWatchByLocalId(userId: string, localId: string): Promise<void> {
    const { error } = await supabase
      .from('user_movie_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('local_id', localId);

    if (error) throw error;
  },

  // Soft delete all watches for a movie
  async softDeleteMovieWatches(userId: string, tmdbMovieId: number): Promise<void> {
    const { error } = await supabase
      .from('user_movie_watch_history')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_movie_id', tmdbMovieId);

    if (error) throw error;
  },

  // Get watch count for a movie
  async getMovieWatchCount(userId: string, tmdbMovieId: number): Promise<number> {
    const { count, error } = await supabase
      .from('user_movie_watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tmdb_movie_id', tmdbMovieId)
      .is('deleted_at', null);

    if (error) throw error;
    return count ?? 0;
  },
};
