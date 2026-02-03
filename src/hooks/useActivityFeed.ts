import { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityItem } from '../types';
import { activityService } from '../services/supabase/activity';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 20;

export function useActivityFeed() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to avoid circular dependency in loadMore callback
  const activitiesRef = useRef(activities);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  // Initial load
  const loadActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await activityService.getActivityFeed(user.id, PAGE_SIZE);
      setActivities(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load activity feed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    const currentActivities = activitiesRef.current;
    if (!user || !hasMore || loading || currentActivities.length === 0) return;

    try {
      const lastActivity = currentActivities[currentActivities.length - 1];
      const moreData = await activityService.getActivityFeed(
        user.id,
        PAGE_SIZE,
        lastActivity.timestamp
      );

      if (moreData.length === 0) {
        setHasMore(false);
      } else {
        setActivities((prev) => [...prev, ...moreData]);
        setHasMore(moreData.length >= PAGE_SIZE);
      }
    } catch (e) {
      console.error('Failed to load more activity:', e);
    }
  }, [user, hasMore, loading]);

  // Pull-to-refresh
  const refresh = useCallback(async () => {
    if (!user) return;

    setRefreshing(true);

    try {
      const data = await activityService.getActivityFeed(user.id, PAGE_SIZE);
      setActivities(data);
      setHasMore(data.length >= PAGE_SIZE);
      setError(null);
    } catch (e) {
      console.error('Failed to refresh activity feed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Load on mount and when user changes
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return {
    activities,
    loading,
    refreshing,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}
