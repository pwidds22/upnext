import { supabase } from './client';
import type { TrackedShow, UserShowRow, ShowStatus } from '../../types';

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
  };
}

// Convert Supabase row to local TrackedShow format
function fromSupabaseRow(row: UserShowRow): TrackedShow {
  return {
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

export const showsCloudService = {
  // Fetch all shows for a user (excluding soft-deleted)
  async fetchAllShows(userId: string): Promise<TrackedShow[]> {
    const { data, error } = await supabase
      .from('user_shows')
      .select('*')
      .eq('user_id', userId)
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
        onConflict: 'user_id,tmdb_id',
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
        onConflict: 'user_id,tmdb_id',
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
      .eq('tmdb_id', tmdbId);

    if (error) throw error;
  },

  // Soft delete a show (set deleted_at)
  async softDeleteShow(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_shows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId);

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
};
