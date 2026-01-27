import { supabase } from './client';
import type {
  UserFollowRow,
  ProfileRow,
  UserProfile,
  UserWithFollowStatus,
  FollowCounts,
  FriendRating,
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

export const followsService = {
  // Check if a username is available
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return !data; // Available if no profile found
  },

  // Update profile username and display name
  async updateProfile(
    userId: string,
    updates: { username?: string; displayName?: string; bio?: string }
  ): Promise<void> {
    const updateData: Record<string, string> = {};
    if (updates.username) updateData.username = updates.username.toLowerCase();
    if (updates.displayName) updateData.display_name = updates.displayName;
    if (updates.bio) updateData.bio = updates.bio;

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
  },

  // Follow a user
  async follow(followerId: string, followingId: string): Promise<UserFollowRow> {
    const { data, error } = await supabase
      .from('user_follows')
      .insert({ follower_id: followerId, following_id: followingId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Unfollow a user
  async unfollow(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) throw error;
  },

  // Check if user A follows user B
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  // Get follow counts for a user
  async getFollowCounts(userId: string): Promise<FollowCounts> {
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    return {
      followers: followersResult.count ?? 0,
      following: followingResult.count ?? 0,
    };
  },

  // Get followers list with profiles
  async getFollowers(
    userId: string,
    currentUserId?: string
  ): Promise<UserWithFollowStatus[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select(
        `
        follower_id,
        profiles!user_follows_follower_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .eq('following_id', userId);

    if (error) throw error;

    const profiles = (data ?? []).map((row: any) =>
      profileFromRow(row.profiles as ProfileRow)
    );

    // Add follow status if current user provided
    if (currentUserId) {
      return this.enrichWithFollowStatus(profiles, currentUserId);
    }

    return profiles.map((p) => ({ ...p, isFollowing: false, isFollowedBy: false }));
  },

  // Get following list with profiles
  async getFollowing(
    userId: string,
    currentUserId?: string
  ): Promise<UserWithFollowStatus[]> {
    const { data, error } = await supabase
      .from('user_follows')
      .select(
        `
        following_id,
        profiles!user_follows_following_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .eq('follower_id', userId);

    if (error) throw error;

    const profiles = (data ?? []).map((row: any) =>
      profileFromRow(row.profiles as ProfileRow)
    );

    if (currentUserId) {
      return this.enrichWithFollowStatus(profiles, currentUserId);
    }

    return profiles.map((p) => ({ ...p, isFollowing: false, isFollowedBy: false }));
  },

  // Helper to add follow status to profiles
  async enrichWithFollowStatus(
    profiles: UserProfile[],
    currentUserId: string
  ): Promise<UserWithFollowStatus[]> {
    if (profiles.length === 0) return [];

    const userIds = profiles.map((p) => p.id);

    // Get who current user follows among these profiles
    const { data: following } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .in('following_id', userIds);

    // Get who follows current user among these profiles
    const { data: followers } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', currentUserId)
      .in('follower_id', userIds);

    const followingSet = new Set((following ?? []).map((f) => f.following_id));
    const followerSet = new Set((followers ?? []).map((f) => f.follower_id));

    return profiles.map((p) => ({
      ...p,
      isFollowing: followingSet.has(p.id),
      isFollowedBy: followerSet.has(p.id),
    }));
  },

  // Search users by username or display name
  async searchUsers(
    query: string,
    currentUserId: string,
    limit = 20
  ): Promise<UserWithFollowStatus[]> {
    const searchPattern = `%${query}%`;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_searchable')
      .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
      .eq('is_searchable', true)
      .neq('id', currentUserId) // Exclude self
      .limit(limit);

    if (error) throw error;

    const profiles = (data ?? []).map(profileFromRow);
    return this.enrichWithFollowStatus(profiles, currentUserId);
  },

  // Get a single user profile
  async getUserProfile(
    userId: string,
    currentUserId?: string
  ): Promise<UserWithFollowStatus | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_searchable')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const profile = profileFromRow(data);

    if (currentUserId && currentUserId !== userId) {
      const enriched = await this.enrichWithFollowStatus([profile], currentUserId);
      return enriched[0];
    }

    return { ...profile, isFollowing: false, isFollowedBy: false };
  },

  // Get friends who watch a specific show (for ShowDetailScreen)
  async getFriendsWatchingShow(
    userId: string,
    tmdbId: number
  ): Promise<UserProfile[]> {
    // Get IDs of users the current user follows
    const { data: followingData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!followingData || followingData.length === 0) return [];

    const followingIds = followingData.map((f) => f.following_id);

    // Find which of those users have this show
    const { data, error } = await supabase
      .from('user_shows')
      .select(
        `
        user_id,
        profiles!user_shows_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .eq('tmdb_id', tmdbId)
      .is('deleted_at', null)
      .in('user_id', followingIds);

    if (error) throw error;

    return (data ?? []).map((row: any) => profileFromRow(row.profiles as ProfileRow));
  },

  // Get friend ratings for a show (for ShowDetailScreen)
  async getFriendRatings(userId: string, tmdbId: number): Promise<FriendRating[]> {
    const { data: followingData } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!followingData || followingData.length === 0) return [];

    const followingIds = followingData.map((f) => f.following_id);

    const { data, error } = await supabase
      .from('user_ratings')
      .select(
        `
        rating,
        user_id,
        profiles!user_ratings_user_id_fkey (
          id, username, display_name, avatar_url, bio, is_searchable
        )
      `
      )
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'show')
      .eq('is_public', true)
      .in('user_id', followingIds);

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      user: profileFromRow(row.profiles as ProfileRow),
      rating: row.rating,
    }));
  },
};
