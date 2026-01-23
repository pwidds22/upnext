import { useState, useEffect, useCallback } from 'react';
import { TrackedShow, WatchedEpisode, ShowStatus } from '../types';
import { storageService } from '../services/storage';

export function useTrackedShows() {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const addShow = useCallback(async (show: TrackedShow) => {
    await storageService.addShow(show);
    setShows((prev) => [show, ...prev.filter((s) => s.tmdbId !== show.tmdbId)]);
  }, []);

  const updateStatus = useCallback(async (tmdbId: number, status: ShowStatus) => {
    await storageService.updateShowStatus(tmdbId, status);
    setShows((prev) =>
      prev.map((s) => (s.tmdbId === tmdbId ? { ...s, status } : s))
    );
  }, []);

  const removeShow = useCallback(async (tmdbId: number) => {
    await storageService.deleteShow(tmdbId);
    setShows((prev) => prev.filter((s) => s.tmdbId !== tmdbId));
  }, []);

  const isTracked = useCallback(
    (tmdbId: number) => shows.some((s) => s.tmdbId === tmdbId),
    [shows]
  );

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

  const isWatched = useCallback(
    (season: number, episode: number) =>
      episodes.some((e) => e.seasonNumber === season && e.episodeNumber === episode),
    [episodes]
  );

  const toggleWatched = useCallback(
    async (
      season: number,
      episode: number,
      episodeTitle?: string,
      stillPath?: string
    ) => {
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
        setEpisodes((prev) => [
          ...prev,
          { ...newEpisode, id: `${showTmdbId}-${season}-${episode}` },
        ]);
      }
    },
    [showTmdbId, isWatched]
  );

  const markSeasonWatched = useCallback(
    async (
      seasonNumber: number,
      episodeList: Array<{ episodeNumber: number; name: string | null; stillPath: string | null }>
    ) => {
      await storageService.markSeasonWatched(showTmdbId, seasonNumber, episodeList);
      await loadEpisodes();
    },
    [showTmdbId, loadEpisodes]
  );

  const markSeasonUnwatched = useCallback(
    async (seasonNumber: number) => {
      await storageService.markSeasonUnwatched(showTmdbId, seasonNumber);
      setEpisodes((prev) => prev.filter((e) => e.seasonNumber !== seasonNumber));
    },
    [showTmdbId]
  );

  const watchedCount = episodes.length;

  const watchedCountForSeason = useCallback(
    (seasonNumber: number) =>
      episodes.filter((e) => e.seasonNumber === seasonNumber).length,
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
