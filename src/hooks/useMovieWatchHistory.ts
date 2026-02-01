import { useState, useEffect, useCallback } from 'react';
import { WatchHistorySummary } from '../types';
import { storageService } from '../services/storage';
import { useSyncOptional } from '../contexts/SyncContext';

export function useMovieWatchHistory(movieTmdbId: number) {
  const [watchCount, setWatchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Sync integration - returns null if SyncProvider is not available
  const syncContext = useSyncOptional();
  const sync = syncContext?.triggerSync;
  const isOnline = syncContext?.isOnline ?? true;

  const loadWatchCount = useCallback(async () => {
    try {
      setLoading(true);
      const count = await storageService.getMovieWatchCount(movieTmdbId);
      setWatchCount(count);
    } catch (e) {
      console.error('Failed to load movie watch count:', e);
    } finally {
      setLoading(false);
    }
  }, [movieTmdbId]);

  useEffect(() => {
    loadWatchCount();
  }, [loadWatchCount]);

  const triggerSyncIfOnline = useCallback(() => {
    if (sync && isOnline) {
      sync().catch(console.error);
    }
  }, [sync, isOnline]);

  // Check if movie has been watched at least once
  const isWatched = watchCount > 0;

  // Add a new watch (for first watch or rewatch)
  const addWatch = useCallback(async () => {
    const watchedAt = new Date().toISOString();

    // Add to watch history
    await storageService.addMovieWatchHistory(movieTmdbId, watchedAt);

    // Update local state
    setWatchCount((prev) => prev + 1);

    triggerSyncIfOnline();
  }, [movieTmdbId, triggerSyncIfOnline]);

  // Remove the most recent watch
  const removeLatestWatch = useCallback(async () => {
    const deletedId = await storageService.deleteLatestMovieWatch(movieTmdbId);

    if (deletedId) {
      setWatchCount((prev) => Math.max(0, prev - 1));
    }

    triggerSyncIfOnline();
  }, [movieTmdbId, triggerSyncIfOnline]);

  // Get full watch history
  const getWatchHistory = useCallback(async (): Promise<WatchHistorySummary> => {
    return storageService.getMovieWatchHistorySummary(movieTmdbId);
  }, [movieTmdbId]);

  // Delete a specific watch by ID
  const deleteWatch = useCallback(
    async (watchId: string) => {
      await storageService.deleteMovieWatch(watchId);
      setWatchCount((prev) => Math.max(0, prev - 1));
      triggerSyncIfOnline();
    },
    [triggerSyncIfOnline]
  );

  // Delete all watch history for this movie
  const deleteAllWatches = useCallback(async () => {
    await storageService.deleteAllMovieWatchHistory(movieTmdbId);
    setWatchCount(0);
    triggerSyncIfOnline();
  }, [movieTmdbId, triggerSyncIfOnline]);

  return {
    watchCount,
    loading,
    isWatched,
    refresh: loadWatchCount,
    addWatch,
    removeLatestWatch,
    getWatchHistory,
    deleteWatch,
    deleteAllWatches,
  };
}
