import { useState, useEffect, useCallback, useRef } from 'react';
import { followsService } from '../services/supabase/follows';
import { useAuth } from '../contexts/AuthContext';
import type { FollowCounts, UserWithFollowStatus } from '../types';

// Hook for managing follow status of a single user
export function useFollowStatus(targetUserId: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use ref to avoid unstable callback reference when isFollowing changes
  const isFollowingRef = useRef(isFollowing);
  useEffect(() => {
    isFollowingRef.current = isFollowing;
  }, [isFollowing]);

  useEffect(() => {
    if (!user || user.id === targetUserId) {
      setLoading(false);
      return;
    }

    followsService
      .isFollowing(user.id, targetUserId)
      .then(setIsFollowing)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, targetUserId]);

  const toggleFollow = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isFollowingRef.current) {
        await followsService.unfollow(user.id, targetUserId);
        setIsFollowing(false);
      } else {
        await followsService.follow(user.id, targetUserId);
        setIsFollowing(true);
      }
    } catch (e) {
      console.error('Failed to toggle follow:', e);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId]);

  return { isFollowing, loading, toggleFollow };
}

// Hook for getting follow counts
export function useFollowCounts(userId: string) {
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await followsService.getFollowCounts(userId);
      setCounts(data);
    } catch (e) {
      console.error('Failed to load follow counts:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...counts, loading, refresh };
}

// Hook for listing followers
export function useFollowersList(userId: string, enabled: boolean = true) {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<UserWithFollowStatus[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await followsService.getFollowers(userId, user?.id);
      setFollowers(data);
    } catch (e) {
      console.error('Failed to load followers:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { followers, loading, refresh };
}

// Hook for listing following
export function useFollowingList(userId: string, enabled: boolean = true) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<UserWithFollowStatus[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await followsService.getFollowing(userId, user?.id);
      setFollowing(data);
    } catch (e) {
      console.error('Failed to load following:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { following, loading, refresh };
}

// Hook for searching users
export function useUserSearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<UserWithFollowStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await followsService.searchUsers(query.trim(), user.id);
        setResults(data);
      } catch (e) {
        console.error('Failed to search users:', e);
        setError('Failed to search users');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
}
