import { supabase } from './client';
import type { EpisodeReaction, EpisodeReactionType, UserEpisodeReactionRow } from '../../types';

// Convert local EpisodeReaction to Supabase row format
function toSupabaseRow(
  userId: string,
  reaction: EpisodeReaction
): Omit<UserEpisodeReactionRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    tmdb_show_id: reaction.showTmdbId,
    season_number: reaction.seasonNumber,
    episode_number: reaction.episodeNumber,
    reaction: reaction.reaction,
    is_public: true,
    deleted_at: null,
  };
}

// Convert Supabase row to local EpisodeReaction format
function fromSupabaseRow(row: UserEpisodeReactionRow): EpisodeReaction {
  return {
    id: `${row.tmdb_show_id}-${row.season_number}-${row.episode_number}-reaction`,
    showTmdbId: row.tmdb_show_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    reaction: row.reaction,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
    remoteId: row.id,
    lastSyncedAt: row.updated_at,
  };
}

export const episodeReactionsCloudService = {
  // Fetch all reactions for a user (excluding soft-deleted)
  async fetchAllReactions(userId: string): Promise<EpisodeReaction[]> {
    const { data, error } = await supabase
      .from('user_episode_reactions')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch reactions for a specific show
  async fetchReactionsForShow(userId: string, tmdbShowId: number): Promise<EpisodeReaction[]> {
    const { data, error } = await supabase
      .from('user_episode_reactions')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .is('deleted_at', null);

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch reactions updated since a timestamp (for incremental sync)
  async fetchReactionsSince(userId: string, since: string): Promise<UserEpisodeReactionRow[]> {
    const { data, error } = await supabase
      .from('user_episode_reactions')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Upsert a single reaction
  async upsertReaction(userId: string, reaction: EpisodeReaction): Promise<UserEpisodeReactionRow> {
    const row = toSupabaseRow(userId, reaction);

    const { data, error } = await supabase
      .from('user_episode_reactions')
      .upsert(row, {
        onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Soft delete a single reaction
  async softDeleteReaction(
    userId: string,
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    const { error } = await supabase
      .from('user_episode_reactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber);

    if (error) throw error;
  },

  // Soft delete all reactions for a show (when show is deleted)
  async softDeleteShowReactions(userId: string, tmdbShowId: number): Promise<void> {
    const { error } = await supabase
      .from('user_episode_reactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_show_id', tmdbShowId);

    if (error) throw error;
  },
};
