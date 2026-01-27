import { supabase } from './client';
import type { DismissedShow, UserDismissedShowRow } from '../../types';

// Convert local DismissedShow to Supabase row format
function toSupabaseRow(
  userId: string,
  dismissed: DismissedShow
): Omit<UserDismissedShowRow, 'id'> {
  return {
    user_id: userId,
    tmdb_id: dismissed.tmdbId,
    dismissed_at: dismissed.dismissedAt,
    deleted_at: null,
  };
}

// Convert Supabase row to local DismissedShow format
function fromSupabaseRow(row: UserDismissedShowRow): DismissedShow {
  return {
    id: `dismissed-${row.tmdb_id}`,
    tmdbId: row.tmdb_id,
    dismissedAt: row.dismissed_at,
    syncStatus: 'synced',
    remoteId: row.id,
    lastSyncedAt: row.dismissed_at,
  };
}

export const dismissedShowsCloudService = {
  // Fetch all dismissed shows for a user (excluding soft-deleted)
  async fetchAllDismissed(userId: string): Promise<DismissedShow[]> {
    const { data, error } = await supabase
      .from('user_dismissed_shows')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return (data ?? []).map(fromSupabaseRow);
  },

  // Fetch dismissed shows updated since a timestamp (for incremental sync)
  async fetchDismissedSince(userId: string, since: string): Promise<UserDismissedShowRow[]> {
    const { data, error } = await supabase
      .from('user_dismissed_shows')
      .select('*')
      .eq('user_id', userId)
      .gt('dismissed_at', since);

    if (error) throw error;
    return data ?? [];
  },

  // Upsert a dismissed show
  async upsertDismissed(userId: string, dismissed: DismissedShow): Promise<UserDismissedShowRow> {
    const row = toSupabaseRow(userId, dismissed);

    const { data, error } = await supabase
      .from('user_dismissed_shows')
      .upsert(row, {
        onConflict: 'user_id,tmdb_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Soft delete a dismissed show (to allow re-showing)
  async softDeleteDismissed(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_dismissed_shows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId);

    if (error) throw error;
  },
};
