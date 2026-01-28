import { useState, useEffect, useCallback } from 'react';
import { FriendsWatchingShow } from '../types';
import { activityService } from '../services/supabase/activity';
import { useAuth } from '../contexts/AuthContext';

const MAX_SHOWS = 10;

export function useFriendsWatching(trackedIds: Set<number>) {
  const { user } = useAuth();
  const [shows, setShows] = useState<FriendsWatchingShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFriendsWatching = useCallback(async () => {
    if (!user) {
      setShows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const excludeIds = Array.from(trackedIds);
      const friendsShows = await activityService.getFriendsWatchingShows(
        user.id,
        excludeIds
      );

      // Limit to MAX_SHOWS
      setShows(friendsShows.slice(0, MAX_SHOWS));
    } catch (e) {
      console.error('Failed to load friends watching:', e);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user, trackedIds]);

  useEffect(() => {
    loadFriendsWatching();
  }, [loadFriendsWatching]);

  return {
    shows,
    loading,
    error,
    refresh: loadFriendsWatching,
  };
}
