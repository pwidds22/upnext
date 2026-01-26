import { useState, useEffect, useCallback, useRef } from 'react';
import { TrackedShow, WatchedEpisode, ShowStatus } from '../types';
import { storageService } from '../services/storage';
import { useSync } from './useSync';

export function useTrackedShows() {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync integration - wrapped in try/catch in case SyncProvider is not available
  let sync: (() => Promise<void>) | undefined;
  let isOnline = true;
  let syncStatus: string | undefined;

  try {
    const syncContext = useSync();
    sync = syncContext.sync;
    isOnline = syncContext.isOnline;
    syncStatus = syncContext.status;
  } catch {
    // SyncProvider not available, sync features disabled
  }

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
  const [loading, setLoading] = useState(true);

  // Sync integration - wrapped in try/catch in case SyncProvider is not available
  let sync: (() => Promise<void>) | undefined;
  let isOnline = true;

  try {
    const syncContext = useSync();
    sync = syncContext.sync;
    isOnline = syncContext.isOnline;
  } catch {
    // SyncProvider not available, sync features disabled
  }

  const loadEpisodes = useCallback(async () => {
    try {
      setLoading(true);
      const watched = await storageService.getWatchedEpisodes(showTmdbId);
      setEpisodes(watched);
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

  const toggleWatched = useCallback(
    async (season: number, episode: number, episodeTitle?: string, stillPath?: string) => {
      const watched = isWatched(season, episode);

      if (watched) {
        await storageService.markEpisodeUnwatched(showTmdbId, season, episode);
        setEpisodes((prev) =>
          prev.filter((e) => !(e.seasonNumber === season && e.episodeNumber === episode))
        );
      } else {
        const newEpisode: Omit<WatchedEpisode, 'id'> = {
          showTmdbId,
          seasonNumber: season,
          episodeNumber: episode,
          watchedAt: new Date().toISOString(),
          episodeTitle,
          stillPath,
        };
        await storageService.markEpisodeWatched(newEpisode);
        setEpisodes((prev) => [...prev, { ...newEpisode, id: `${showTmdbId}-${season}-${episode}` }]);
      }

      triggerSyncIfOnline();
    },
    [showTmdbId, isWatched, triggerSyncIfOnline]
  );

  const markSeasonWatched = useCallback(
    async (
      seasonNumber: number,
      episodeList: Array<{ episodeNumber: number; name: string | null; stillPath: string | null }>
    ) => {
      await storageService.markSeasonWatched(showTmdbId, seasonNumber, episodeList);
      await loadEpisodes();
      triggerSyncIfOnline();
    },
    [showTmdbId, loadEpisodes, triggerSyncIfOnline]
  );

  const markSeasonUnwatched = useCallback(
    async (seasonNumber: number) => {
      await storageService.markSeasonUnwatched(showTmdbId, seasonNumber);
      setEpisodes((prev) => prev.filter((e) => e.seasonNumber !== seasonNumber));
      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
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
    toggleWatched,
    markSeasonWatched,
    markSeasonUnwatched,
    watchedCount,
    watchedCountForSeason,
  };
}
