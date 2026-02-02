import { useState, useEffect, useCallback, useRef } from 'react';

// Simple in-memory cache with TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ITEMS = 10;
const MAX_TRACKED_FOR_GENRES = 5;

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

interface RecommendationConfig<TMedia, TTracked> {
  // Cache key prefix to avoid collisions between shows and movies
  cacheKeyPrefix: string;
  // Data fetching functions
  getDismissedIds: () => Promise<Set<number>>;
  dismissItem: (tmdbId: number) => Promise<void>;
  getAllTracked: () => Promise<TTracked[]>;
  // API functions
  fetchTrending: () => Promise<TMedia[]>;
  fetchByGenres: (genreIds: number[]) => Promise<TMedia[]>;
  fetchPopular: () => Promise<TMedia[]>;
  fetchTopRated: () => Promise<TMedia[]>;
  // Genre extraction
  extractGenres: (tracked: TTracked[]) => Promise<number[]>;
}

/**
 * Generic hook for media recommendations (shows or movies).
 * useRecommendations and useMovieRecommendations are thin wrappers around this hook.
 */
export function useMediaRecommendations<TMedia extends { id: number }, TTracked>(
  trackedIds: Set<number>,
  config: RecommendationConfig<TMedia, TTracked>
) {
  // Use ref for cache to persist across re-renders without causing effects
  const cacheRef = useRef<Record<string, CacheEntry<TMedia>>>({});
  const cache = cacheRef.current;

  const [trending, setTrending] = useState<TMedia[]>([]);
  const [forYou, setForYou] = useState<TMedia[]>([]);
  const [topRated, setTopRated] = useState<TMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const isCacheValid = useCallback((key: string): boolean => {
    const entry = cache[key];
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  }, [cache]);

  // Load dismissed IDs on mount
  useEffect(() => {
    async function loadDismissed() {
      const ids = await config.getDismissedIds();
      setDismissedIds(ids);
    }
    loadDismissed();
  }, [config]);

  const loadRecommendations = useCallback(async (excludeIds: Set<number>, dismissed: Set<number>) => {
    setLoading(true);
    setError(null);

    try {
      // Get user's tracked items to extract genres
      const trackedItems = await config.getAllTracked();
      const genreIds = await config.extractGenres(trackedItems.slice(0, MAX_TRACKED_FOR_GENRES));

      // Create cache keys with prefix
      const trendingKey = `${config.cacheKeyPrefix}_trending`;
      const forYouKey = genreIds.length > 0
        ? `${config.cacheKeyPrefix}_forYou_${genreIds.sort().join(',')}`
        : `${config.cacheKeyPrefix}_popular`;
      const topRatedKey = `${config.cacheKeyPrefix}_topRated`;

      // Load from cache if valid
      const cachedTrending = isCacheValid(trendingKey) ? cache[trendingKey].data : null;
      const cachedForYou = isCacheValid(forYouKey) ? cache[forYouKey].data : null;
      const cachedTopRated = isCacheValid(topRatedKey) ? cache[topRatedKey].data : null;

      const [trendingData, forYouData, topRatedData] = await Promise.all([
        cachedTrending ?? config.fetchTrending(),
        cachedForYou ?? (genreIds.length > 0 ? config.fetchByGenres(genreIds) : config.fetchPopular()),
        cachedTopRated ?? config.fetchTopRated(),
      ]);

      // Update cache with raw data (before filtering)
      if (!cachedTrending) {
        cache[trendingKey] = { data: trendingData, timestamp: Date.now() };
      }
      if (!cachedForYou) {
        cache[forYouKey] = { data: forYouData, timestamp: Date.now() };
      }
      if (!cachedTopRated) {
        cache[topRatedKey] = { data: topRatedData, timestamp: Date.now() };
      }

      // Create a set to track IDs we've already used (for deduplication)
      const usedIds = new Set<number>([...excludeIds, ...dismissed]);

      // Filter trending first (highest priority)
      const filteredTrending = trendingData
        .filter((item) => !usedIds.has(item.id))
        .slice(0, MAX_ITEMS);

      // Add trending IDs to usedIds
      filteredTrending.forEach((item) => usedIds.add(item.id));

      // Filter forYou, excluding trending items
      const filteredForYou = forYouData
        .filter((item) => !usedIds.has(item.id))
        .slice(0, MAX_ITEMS);

      // Add forYou IDs to usedIds
      filteredForYou.forEach((item) => usedIds.add(item.id));

      // Filter topRated, excluding trending and forYou items
      const filteredTopRated = topRatedData
        .filter((item) => !usedIds.has(item.id))
        .slice(0, MAX_ITEMS);

      setTrending(filteredTrending);
      setForYou(filteredForYou);
      setTopRated(filteredTopRated);
    } catch (e) {
      console.error(`Failed to load ${config.cacheKeyPrefix} recommendations:`, e);
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [config, cache, isCacheValid]);

  // Dismiss an item from recommendations
  const dismiss = useCallback(async (tmdbId: number) => {
    await config.dismissItem(tmdbId);
    setDismissedIds((prev) => new Set([...prev, tmdbId]));
    // Remove from current lists immediately for responsive UI
    setTrending((prev) => prev.filter((item) => item.id !== tmdbId));
    setForYou((prev) => prev.filter((item) => item.id !== tmdbId));
    setTopRated((prev) => prev.filter((item) => item.id !== tmdbId));
  }, [config]);

  // Load recommendations when trackedIds or dismissedIds changes
  useEffect(() => {
    loadRecommendations(trackedIds, dismissedIds);
  }, [trackedIds, dismissedIds, loadRecommendations]);

  return {
    trending,
    forYou,
    topRated,
    loading,
    error,
    refresh: () => loadRecommendations(trackedIds, dismissedIds),
    dismiss,
  };
}
