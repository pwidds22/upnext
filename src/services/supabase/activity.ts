import { supabase } from './client';
import type {
  UserProfile,
  ProfileRow,
  FriendsWatchingShow,
  ActivityItem,
  ActivityType,
  ShowStatus,
  MovieStatus,
  EpisodeReactionType,
  MediaType,
} from '../../types';

// Convert database row to app type
function profileFromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  };
}

export const activityService = {
  // Get IDs of users the current user follows
  async getFollowingIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) throw error;
    return (data ?? []).map((f) => f.following_id);
  },

  // Get shows that followed users are watching (for SearchScreen)
  async getFriendsWatchingShows(
    userId: string,
    excludeTmdbIds: number[]
  ): Promise<FriendsWatchingShow[]> {
    // Get IDs of users the current user follows
    const followingIds = await this.getFollowingIds(userId);
    if (followingIds.length === 0) return [];

    // Get shows from followed users that are actively being watched
    const { data, error } = await supabase
      .from('user_shows')
      .select(
        `
        tmdb_id,
        title,
        poster_path,
        user_id,
        profiles!user_shows_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .in('user_id', followingIds)
      .in('status', ['watching', 'waiting'])
      .is('deleted_at', null);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Aggregate by show, counting friends and collecting profiles
    const showMap = new Map<
      number,
      {
        tmdbId: number;
        title: string;
        posterPath: string | null;
        friends: UserProfile[];
      }
    >();

    for (const row of data as any[]) {
      const tmdbId = row.tmdb_id as number;

      // Skip excluded shows
      if (excludeTmdbIds.includes(tmdbId)) continue;

      if (!showMap.has(tmdbId)) {
        showMap.set(tmdbId, {
          tmdbId,
          title: row.title,
          posterPath: row.poster_path,
          friends: [],
        });
      }

      const show = showMap.get(tmdbId)!;
      // Avoid duplicate friends (in case of data issues)
      const friendProfile = profileFromRow(row.profiles as ProfileRow);
      if (!show.friends.some((f) => f.id === friendProfile.id)) {
        show.friends.push(friendProfile);
      }
    }

    // Convert to array and sort by friend count (most popular first)
    const result: FriendsWatchingShow[] = Array.from(showMap.values())
      .map((show) => ({
        ...show,
        friendCount: show.friends.length,
      }))
      .sort((a, b) => b.friendCount - a.friendCount);

    return result;
  },

  // Get activity feed from followed users
  async getActivityFeed(
    userId: string,
    limit: number = 50,
    before?: string
  ): Promise<ActivityItem[]> {
    const followingIds = await this.getFollowingIds(userId);
    if (followingIds.length === 0) return [];

    // Fetch activities from multiple tables in parallel
    const [episodeWatches, showAdds, movieWatches, ratings, reactions] = await Promise.all([
      this.getEpisodeWatchActivity(followingIds, limit * 3, before), // Fetch more to aggregate
      this.getShowAddActivity(followingIds, limit, before),
      this.getMovieWatchActivity(followingIds, limit, before),
      this.getRatingActivity(followingIds, limit, before),
      this.getReactionActivity(followingIds, limit, before),
    ]);

    // Aggregate episode watches (combine batch watches into single items)
    const aggregatedEpisodeWatches = this.aggregateEpisodeWatches(episodeWatches);

    // Combine and sort by timestamp
    const allActivities = [
      ...aggregatedEpisodeWatches,
      ...showAdds,
      ...movieWatches,
      ...ratings,
      ...reactions,
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit after combining
    return allActivities.slice(0, limit);
  },

  // Aggregate episode watches from same user+show within a time window
  // Also filters out bulk marks (6+ episodes within 60 seconds)
  aggregateEpisodeWatches(activities: ActivityItem[]): ActivityItem[] {
    if (activities.length === 0) return [];

    // Group by user + show + time window (30 minutes)
    const TIME_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
    const BULK_MARK_THRESHOLD = 6; // 6+ episodes
    const BULK_MARK_WINDOW_MS = 60 * 1000; // within 60 seconds = bulk mark

    const groups: Map<string, ActivityItem[]> = new Map();

    for (const activity of activities) {
      // Find existing group within time window
      let foundGroup = false;
      for (const [key, group] of groups) {
        const [userId, tmdbId] = key.split('_');
        if (
          activity.userId === userId &&
          activity.tmdbId === parseInt(tmdbId) &&
          group.length > 0
        ) {
          const lastTimestamp = new Date(group[group.length - 1].timestamp).getTime();
          const currentTimestamp = new Date(activity.timestamp).getTime();
          if (Math.abs(lastTimestamp - currentTimestamp) < TIME_WINDOW_MS) {
            group.push(activity);
            foundGroup = true;
            break;
          }
        }
      }

      if (!foundGroup) {
        // Start new group
        const key = `${activity.userId}_${activity.tmdbId}_${activity.timestamp}`;
        groups.set(key, [activity]);
      }
    }

    // Convert groups to aggregated activities, filtering out bulk marks
    const result: ActivityItem[] = [];

    for (const group of groups.values()) {
      // Check if this is a bulk mark (6+ episodes within 60 seconds)
      if (group.length >= BULK_MARK_THRESHOLD) {
        const timestamps = group.map((a) => new Date(a.timestamp).getTime());
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const timeSpread = maxTime - minTime;

        // If all episodes were marked within 60 seconds, it's a bulk mark - skip it
        if (timeSpread < BULK_MARK_WINDOW_MS) {
          continue; // Don't include bulk marks in the feed
        }
      }

      if (group.length === 1) {
        // Single episode, no aggregation needed
        result.push(group[0]);
      } else {
        // Multiple episodes - aggregate them
        const first = group[0];
        const episodes = group.map((a) => ({
          seasonNumber: a.seasonNumber!,
          episodeNumber: a.episodeNumber!,
          episodeTitle: a.episodeTitle,
        }));

        // Check if it's a full season (consecutive episodes in same season)
        const seasons = new Set(episodes.map((e) => e.seasonNumber));
        let seasonCompleted: number | undefined;

        if (seasons.size === 1) {
          const seasonNum = episodes[0].seasonNumber;
          const episodeNums = episodes.map((e) => e.episodeNumber).sort((a, b) => a - b);
          // Check if starts at 1 and is consecutive
          if (episodeNums[0] === 1 && episodeNums.length >= 6) {
            let isConsecutive = true;
            for (let i = 1; i < episodeNums.length; i++) {
              if (episodeNums[i] !== episodeNums[i - 1] + 1) {
                isConsecutive = false;
                break;
              }
            }
            if (isConsecutive) {
              seasonCompleted = seasonNum;
            }
          }
        }

        result.push({
          ...first,
          id: `agg_${first.id}`,
          isAggregated: true,
          episodeCount: group.length,
          seasonCompleted,
          episodes,
          // Use the most recent timestamp
          timestamp: group.reduce((latest, a) =>
            new Date(a.timestamp) > new Date(latest) ? a.timestamp : latest,
            group[0].timestamp
          ),
        });
      }
    }

    return result;
  },

  // Get episode watch activity
  async getEpisodeWatchActivity(
    followingIds: string[],
    limit: number,
    before?: string
  ): Promise<ActivityItem[]> {
    let query = supabase
      .from('user_watched_episodes')
      .select(
        `
        id,
        user_id,
        tmdb_show_id,
        season_number,
        episode_number,
        episode_title,
        watched_at,
        profiles!user_watched_episodes_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .in('user_id', followingIds)
      .is('deleted_at', null)
      .order('watched_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('watched_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Need to get show titles - batch fetch from user_shows
    const tmdbIds = [...new Set((data ?? []).map((row: any) => row.tmdb_show_id))];
    const showTitles = await this.getShowTitles(tmdbIds, followingIds);

    return (data ?? []).map((row: any) => ({
      id: `watch_${row.id}`,
      type: 'episode_watch' as ActivityType,
      userId: row.user_id,
      user: profileFromRow(row.profiles as ProfileRow),
      tmdbId: row.tmdb_show_id,
      showTitle: showTitles.get(row.tmdb_show_id)?.title ?? 'Unknown Show',
      posterPath: showTitles.get(row.tmdb_show_id)?.posterPath ?? null,
      timestamp: row.watched_at,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      episodeTitle: row.episode_title,
    }));
  },

  // Get show add activity - only completed shows (not "started watching")
  async getShowAddActivity(
    followingIds: string[],
    limit: number,
    before?: string
  ): Promise<ActivityItem[]> {
    let query = supabase
      .from('user_shows')
      .select(
        `
        id,
        user_id,
        tmdb_id,
        title,
        poster_path,
        status,
        updated_at,
        profiles!user_shows_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .in('user_id', followingIds)
      .eq('status', 'completed') // Only show completed shows
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }) // Use updated_at for when they completed
      .limit(limit);

    if (before) {
      query = query.lt('updated_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: `add_${row.id}`,
      type: 'show_add' as ActivityType,
      userId: row.user_id,
      user: profileFromRow(row.profiles as ProfileRow),
      tmdbId: row.tmdb_id,
      showTitle: row.title,
      posterPath: row.poster_path,
      timestamp: row.updated_at,
      showStatus: row.status as ShowStatus,
      mediaType: 'tv' as MediaType,
    }));
  },

  // Get movie watch activity (movies marked as "watched")
  async getMovieWatchActivity(
    followingIds: string[],
    limit: number,
    before?: string
  ): Promise<ActivityItem[]> {
    let query = supabase
      .from('user_shows')
      .select(
        `
        id,
        user_id,
        tmdb_id,
        title,
        poster_path,
        status,
        updated_at,
        profiles!user_shows_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .in('user_id', followingIds)
      .eq('media_type', 'movie')
      .eq('status', 'watched')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('updated_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: `movie_${row.id}`,
      type: 'movie_watch' as ActivityType,
      userId: row.user_id,
      user: profileFromRow(row.profiles as ProfileRow),
      tmdbId: row.tmdb_id,
      showTitle: row.title,
      posterPath: row.poster_path,
      timestamp: row.updated_at,
      movieStatus: row.status as MovieStatus,
      mediaType: 'movie' as MediaType,
    }));
  },

  // Get rating activity (includes show, season, episode, and movie ratings)
  async getRatingActivity(
    followingIds: string[],
    limit: number,
    before?: string
  ): Promise<ActivityItem[]> {
    let query = supabase
      .from('user_ratings')
      .select(
        `
        id,
        user_id,
        tmdb_id,
        rating,
        rating_type,
        season_number,
        episode_number,
        created_at,
        profiles!user_ratings_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .in('user_id', followingIds)
      .eq('is_public', true) // All public ratings (show, season, episode)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get show titles
    const tmdbIds = [...new Set((data ?? []).map((row: any) => row.tmdb_id))];
    const showTitles = await this.getShowTitles(tmdbIds, followingIds);

    return (data ?? []).map((row: any) => ({
      id: `rating_${row.id}`,
      type: 'rating' as ActivityType,
      userId: row.user_id,
      user: profileFromRow(row.profiles as ProfileRow),
      tmdbId: row.tmdb_id,
      showTitle: showTitles.get(row.tmdb_id)?.title ?? (row.rating_type === 'movie' ? 'Unknown Movie' : 'Unknown Show'),
      posterPath: showTitles.get(row.tmdb_id)?.posterPath ?? null,
      timestamp: row.created_at,
      rating: row.rating,
      ratingType: row.rating_type,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      mediaType: (row.rating_type === 'movie' ? 'movie' : 'tv') as MediaType,
    }));
  },

  // Get reaction activity
  async getReactionActivity(
    followingIds: string[],
    limit: number,
    before?: string
  ): Promise<ActivityItem[]> {
    // user_episode_reactions doesn't have a FK to profiles, so fetch separately
    let query = supabase
      .from('user_episode_reactions')
      .select('id, user_id, tmdb_show_id, season_number, episode_number, reaction, created_at')
      .in('user_id', followingIds)
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get unique user IDs and fetch their profiles
    const userIds = [...new Set(data.map((row) => row.user_id))];
    const profiles = await this.getProfiles(userIds);

    // Get show titles
    const tmdbIds = [...new Set(data.map((row) => row.tmdb_show_id))];
    const showTitles = await this.getShowTitles(tmdbIds, followingIds);

    return data.map((row) => ({
      id: `reaction_${row.id}`,
      type: 'reaction' as ActivityType,
      userId: row.user_id,
      user: profiles.get(row.user_id) ?? { id: row.user_id, username: null, displayName: null, avatarUrl: null },
      tmdbId: row.tmdb_show_id,
      showTitle: showTitles.get(row.tmdb_show_id)?.title ?? 'Unknown Show',
      posterPath: showTitles.get(row.tmdb_show_id)?.posterPath ?? null,
      timestamp: row.created_at,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      reaction: row.reaction as EpisodeReactionType,
    }));
  },

  // Helper to get profiles by user IDs
  async getProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    if (userIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_searchable')
      .in('id', userIds);

    if (error) throw error;

    const map = new Map<string, UserProfile>();
    for (const row of data ?? []) {
      map.set(row.id, profileFromRow(row as ProfileRow));
    }

    return map;
  },

  // Helper to get show titles/posters from user_shows
  async getShowTitles(
    tmdbIds: number[],
    userIds: string[]
  ): Promise<Map<number, { title: string; posterPath: string | null }>> {
    if (tmdbIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('user_shows')
      .select('tmdb_id, title, poster_path')
      .in('tmdb_id', tmdbIds)
      .in('user_id', userIds)
      .is('deleted_at', null);

    if (error) throw error;

    const map = new Map<number, { title: string; posterPath: string | null }>();
    for (const row of data ?? []) {
      if (!map.has(row.tmdb_id)) {
        map.set(row.tmdb_id, { title: row.title, posterPath: row.poster_path });
      }
    }

    return map;
  },

  // Get recent activity for a specific user (for inline dropdown)
  async getUserRecentActivity(
    userId: string,
    limit: number = 5
  ): Promise<ActivityItem[]> {
    // Fetch activities from multiple tables in parallel for this specific user
    const [episodeWatches, showAdds, movieWatches, ratings, reactions] = await Promise.all([
      this.getEpisodeWatchActivity([userId], limit * 2),
      this.getShowAddActivity([userId], limit),
      this.getMovieWatchActivity([userId], limit),
      this.getRatingActivity([userId], limit),
      this.getReactionActivity([userId], limit),
    ]);

    // Aggregate episode watches (filter bulk marks, combine batches)
    const aggregatedEpisodeWatches = this.aggregateEpisodeWatches(episodeWatches);

    // Combine and sort by timestamp
    const allActivities = [
      ...aggregatedEpisodeWatches,
      ...showAdds,
      ...movieWatches,
      ...ratings,
      ...reactions,
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    return allActivities.slice(0, limit);
  },
};
