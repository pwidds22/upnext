import { supabase } from './client';
import type { WatchedEpisode, UserWatchedEpisodeRow } from '../../types';

// Convert local WatchedEpisode to Supabase row format
function toSupabaseRow(
  userId: string,
  episode: WatchedEpisode,
  userShowId?: string
): Omit<UserWatchedEpisodeRow, 'id' | 'synced_at'> {
  return {
    user_id: userId,
    user_show_id: userShowId ?? null,
    tmdb_show_id: episode.showTmdbId,
    season_number: episode.seasonNumber,
    episode_number: episode.episodeNumber,
    watched_at: episode.watchedAt,
    episode_title: episode.episodeTitle ?? null,
    still_path: episode.stillPath ?? null,
    local_id: episode.id,
    deleted_at: null,
  };
}

// Convert Supabase row to local WatchedEpisode format
function fromSupabaseRow(row: UserWatchedEpisodeRow): WatchedEpisode {
  return {
    id: `${row.tmdb_show_id}-${row.season_number}-${row.episode_number}`,
    showTmdbId: row.tmdb_show_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    watchedAt: row.watched_at,
    episodeTitle: row.episode_title ?? undefined,
    stillPath: row.still_path ?? undefined,
    syncStatus: 'synced',
    remoteId: row.id,
    lastSyncedAt: row.synced_at,
  };
}

export const episodesCloudService = {
  // Fetch all watched episodes for a user (excluding soft-deleted)
  async fetchAllEpisodes(userId: string): Promise<WatchedEpisode[]> {
    const { data, error } = await supabase
      .from('user_watched_episodes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch episodes for a specific show
  async fetchEpisodesForShow(userId: string, tmdbShowId: number): Promise<WatchedEpisode[]> {
    const { data, error } = await supabase
      .from('user_watched_episodes')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .is('deleted_at', null);

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch episodes updated since a timestamp (for incremental sync)
  async fetchEpisodesSince(userId: string, since: string): Promise<UserWatchedEpisodeRow[]> {
    const { data, error } = await supabase
      .from('user_watched_episodes')
      .select('*')
      .eq('user_id', userId)
      .gt('synced_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Upsert a single episode
  async upsertEpisode(userId: string, episode: WatchedEpisode, userShowId?: string): Promise<UserWatchedEpisodeRow> {
    const row = toSupabaseRow(userId, episode, userShowId);

    const { data, error } = await supabase
      .from('user_watched_episodes')
      .upsert(row, {
        onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Batch upsert episodes (for season marking or initial sync)
  async upsertEpisodes(
    userId: string,
    episodes: WatchedEpisode[],
    userShowId?: string
  ): Promise<UserWatchedEpisodeRow[]> {
    if (episodes.length === 0) return [];

    const rows = episodes.map((ep) => toSupabaseRow(userId, ep, userShowId));

    const { data, error } = await supabase
      .from('user_watched_episodes')
      .upsert(rows, {
        onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) throw error;
    return data ?? [];
  },

  // Soft delete a single episode
  async softDeleteEpisode(
    userId: string,
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    const { error } = await supabase
      .from('user_watched_episodes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber);

    if (error) throw error;
  },

  // Soft delete all episodes for a show (when show is deleted)
  async softDeleteShowEpisodes(userId: string, tmdbShowId: number): Promise<void> {
    const { error } = await supabase
      .from('user_watched_episodes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId);

    if (error) throw error;
  },

  // Soft delete all episodes for a season
  async softDeleteSeasonEpisodes(userId: string, tmdbShowId: number, seasonNumber: number): Promise<void> {
    const { error } = await supabase
      .from('user_watched_episodes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber);

    if (error) throw error;
  },
};
