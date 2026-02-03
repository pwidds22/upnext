import { useState, useEffect, useCallback, useRef } from 'react';
import { TrackedShow, WatchedEpisode, ShowStatus, WatchHistorySummary } from '../types';
import { storageService } from '../services/storage';
import { useSyncOptional } from '../contexts/SyncContext';

export function useTrackedShows() {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync integration - returns null if SyncProvider is not available
  const syncContext = useSyncOptional();
  const sync = syncContext?.triggerSync;
  const isOnline = syncContext?.isOnline ?? true;
  const syncStatus = syncContext?.syncState;

  const prevSyncStatus = useRef(syncStatus);

  const loadShows = useCallback(async () => {
    try {
      setLoading(true);
      const allShows = await storageService.getAllShows();
      setShows(allShows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  // Refresh data when sync completes
  useEffect(() => {
    if (prevSyncStatus.current === 'syncing' && syncStatus === 'idle') {
      loadShows();
    }
    prevSyncStatus.current = syncStatus;
  }, [syncStatus, loadShows]);

  const triggerSyncIfOnline = useCallback(() => {
    if (sync && isOnline) {
      sync().catch(console.error);
    }
  }, [sync, isOnline]);

  const addShow = useCallback(
    async (show: TrackedShow) => {
      await storageService.addShow(show);
      setShows((prev) => [show, ...prev.filter((s) => s.tmdbId !== show.tmdbId)]);
      triggerSyncIfOnline();
    },
    [triggerSyncIfOnline]
  );

  const updateStatus = useCallback(
    async (tmdbId: number, status: ShowStatus) => {
      await storageService.updateShowStatus(tmdbId, status);
      setShows((prev) => prev.map((s) => (s.tmdbId === tmdbId ? { ...s, status } : s)));
      triggerSyncIfOnline();
    },
    [triggerSyncIfOnline]
  );

  const removeShow = useCallback(
    async (tmdbId: number) => {
      await storageService.deleteShow(tmdbId);
      setShows((prev) => prev.filter((s) => s.tmdbId !== tmdbId));
      triggerSyncIfOnline();
    },
    [triggerSyncIfOnline]
  );

  const isTracked = useCallback((tmdbId: number) => shows.some((s) => s.tmdbId === tmdbId), [shows]);

  const getShowsByStatus = useCallback(
    (status: ShowStatus) => shows.filter((s) => s.status === status),
    [shows]
  );

  return {
    shows,
    loading,
    error,
    refresh: loadShows,
    addShow,
    updateStatus,
    removeShow,
    isTracked,
    getShowsByStatus,
  };
}

export function useWatchedEpisodes(showTmdbId: number) {
  const [episodes, setEpisodes] = useState<WatchedEpisode[]>([]);
  const [watchCounts, setWatchCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Sync integration - returns null if SyncProvider is not available
  const syncContext = useSyncOptional();
  const sync = syncContext?.triggerSync;
  const isOnline = syncContext?.isOnline ?? true;

  const loadEpisodes = useCallback(async () => {
    try {
      setLoading(true);
      const watched = await storageService.getWatchedEpisodes(showTmdbId);
      setEpisodes(watched);
      // Load watch counts from history table
      const counts = await storageService.getEpisodeWatchCountsForShow(showTmdbId);
      setWatchCounts(counts);
    } catch (e) {
      console.error('Failed to load watched episodes:', e);
    } finally {
      setLoading(false);
    }
  }, [showTmdbId]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  const triggerSyncIfOnline = useCallback(() => {
    if (sync && isOnline) {
      sync().catch(console.error);
    }
  }, [sync, isOnline]);

  const isWatched = useCallback(
    (season: number, episode: number) =>
      episodes.some((e) => e.seasonNumber === season && e.episodeNumber === episode),
    [episodes]
  );

  // Get watch count for an episode (from watch history)
  const getWatchCount = useCallback(
    (season: number, episode: number) => {
      const key = `${season}-${episode}`;
      return watchCounts.get(key) ?? 0;
    },
    [watchCounts]
  );

  // Add a new watch (for first watch or rewatch)
  const addWatch = useCallback(
    async (season: number, episode: number, episodeTitle?: string, stillPath?: string, customWatchedAt?: string) => {
      const watchedAt = customWatchedAt || new Date().toISOString();

      // Add to watch history (always creates new entry)
      await storageService.addEpisodeWatchHistory(showTmdbId, season, episode, watchedAt, episodeTitle);

      // Update watched_episodes table (for backward compatibility / current state)
      const newEpisode: Omit<WatchedEpisode, 'id'> = {
        showTmdbId,
        seasonNumber: season,
        episodeNumber: episode,
        watchedAt,
        episodeTitle,
        stillPath,
      };
      await storageService.markEpisodeWatched(newEpisode);

      // Update local state
      setEpisodes((prev) => {
        const existing = prev.find((e) => e.seasonNumber === season && e.episodeNumber === episode);
        if (existing) {
          // Update the watchedAt timestamp
          return prev.map((e) =>
            e.seasonNumber === season && e.episodeNumber === episode
              ? { ...e, watchedAt }
              : e
          );
        }
        return [...prev, { ...newEpisode, id: `${showTmdbId}-${season}-${episode}` }];
      });

      // Update watch count
      const key = `${season}-${episode}`;
      setWatchCounts((prev) => {
        const newCounts = new Map(prev);
        newCounts.set(key, (prev.get(key) ?? 0) + 1);
        return newCounts;
      });

      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
  );

  // Remove the most recent watch (undo/unwatch)
  const removeLatestWatch = useCallback(
    async (season: number, episode: number) => {
      // Delete from watch history
      await storageService.deleteLatestEpisodeWatch(showTmdbId, season, episode);

      // Get remaining count
      const remainingCount = await storageService.getEpisodeWatchCount(showTmdbId, season, episode);

      if (remainingCount === 0) {
        // No more watches - remove from watched_episodes table
        await storageService.markEpisodeUnwatched(showTmdbId, season, episode);
        setEpisodes((prev) =>
          prev.filter((e) => !(e.seasonNumber === season && e.episodeNumber === episode))
        );
      }

      // Update watch count
      const key = `${season}-${episode}`;
      setWatchCounts((prev) => {
        const newCounts = new Map(prev);
        if (remainingCount === 0) {
          newCounts.delete(key);
        } else {
          newCounts.set(key, remainingCount);
        }
        return newCounts;
      });

      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
  );

  // Get watch history for an episode
  const getWatchHistory = useCallback(
    async (season: number, episode: number): Promise<WatchHistorySummary> => {
      return storageService.getEpisodeWatchHistorySummary(showTmdbId, season, episode);
    },
    [showTmdbId]
  );

  // Delete a specific watch from history by ID
  const deleteWatch = useCallback(
    async (watchId: string, season: number, episode: number) => {
      await storageService.deleteEpisodeWatch(watchId);

      // Get remaining count
      const remainingCount = await storageService.getEpisodeWatchCount(showTmdbId, season, episode);

      if (remainingCount === 0) {
        // No more watches - remove from watched_episodes table
        await storageService.markEpisodeUnwatched(showTmdbId, season, episode);
        setEpisodes((prev) =>
          prev.filter((e) => !(e.seasonNumber === season && e.episodeNumber === episode))
        );
      }

      // Update watch count
      const key = `${season}-${episode}`;
      setWatchCounts((prev) => {
        const newCounts = new Map(prev);
        if (remainingCount === 0) {
          newCounts.delete(key);
        } else {
          newCounts.set(key, remainingCount);
        }
        return newCounts;
      });

      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
  );

  // Update the watched_at date for a specific watch
  const updateWatchDate = useCallback(
    async (watchId: string, watchedAt: string) => {
      await storageService.updateEpisodeWatchDate(watchId, watchedAt);
      triggerSyncIfOnline();
    },
    [triggerSyncIfOnline]
  );

  // Legacy toggleWatched - now uses addWatch for first watch
  const toggleWatched = useCallback(
    async (season: number, episode: number, episodeTitle?: string, stillPath?: string) => {
      const watched = isWatched(season, episode);

      if (watched) {
        // Remove the latest watch
        await removeLatestWatch(season, episode);
      } else {
        // Add first watch
        await addWatch(season, episode, episodeTitle, stillPath);
      }
    },
    [isWatched, addWatch, removeLatestWatch]
  );

  const markSeasonWatched = useCallback(
    async (
      seasonNumber: number,
      episodeList: Array<{ episodeNumber: number; name: string | null; stillPath: string | null }>
    ) => {
      const watchedAt = new Date().toISOString();

      // Add to watch history for each episode
      for (const ep of episodeList) {
        await storageService.addEpisodeWatchHistory(
          showTmdbId,
          seasonNumber,
          ep.episodeNumber,
          watchedAt,
          ep.name ?? undefined
        );
      }

      // Also mark in watched_episodes table
      await storageService.markSeasonWatched(showTmdbId, seasonNumber, episodeList);
      await loadEpisodes();
      triggerSyncIfOnline();
    },
    [showTmdbId, loadEpisodes, triggerSyncIfOnline]
  );

  const markSeasonUnwatched = useCallback(
    async (seasonNumber: number) => {
      // Delete watch history for all episodes in the season
      const seasonEpisodes = episodes.filter((e) => e.seasonNumber === seasonNumber);
      for (const ep of seasonEpisodes) {
        await storageService.deleteAllEpisodeWatchHistory(showTmdbId, seasonNumber, ep.episodeNumber);
      }

      await storageService.markSeasonUnwatched(showTmdbId, seasonNumber);
      setEpisodes((prev) => prev.filter((e) => e.seasonNumber !== seasonNumber));

      // Update watch counts
      setWatchCounts((prev) => {
        const newCounts = new Map(prev);
        for (const ep of seasonEpisodes) {
          newCounts.delete(`${seasonNumber}-${ep.episodeNumber}`);
        }
        return newCounts;
      });

      triggerSyncIfOnline();
    },
    [showTmdbId, episodes, triggerSyncIfOnline]
  );

  const watchedCount = episodes.length;

  const watchedCountForSeason = useCallback(
    (seasonNumber: number) => episodes.filter((e) => e.seasonNumber === seasonNumber).length,
    [episodes]
  );

  return {
    episodes,
    loading,
    refresh: loadEpisodes,
    isWatched,
    getWatchCount,
    toggleWatched,
    addWatch,
    removeLatestWatch,
    getWatchHistory,
    deleteWatch,
    updateWatchDate,
    markSeasonWatched,
    markSeasonUnwatched,
    watchedCount,
    watchedCountForSeason,
  };
}
