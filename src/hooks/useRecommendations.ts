import { useState, useEffect, useCallback } from 'react';
import { TMDBShow, TrackedShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';

// Simple in-memory cache with TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ITEMS = 10;
const MAX_SHOWS_FOR_GENRES = 5;

interface CacheEntry {
  data: TMDBShow[];
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};

function isCacheValid(key: string): boolean {
  const entry = cache[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function useRecommendations(trackedIds: Set<number>) {
  const [trending, setTrending] = useState<TMDBShow[]>([]);
  const [forYou, setForYou] = useState<TMDBShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  // Load dismissed IDs on mount
  useEffect(() => {
    async function loadDismissed() {
      const ids = await storageService.getDismissedShowIds();
      setDismissedIds(ids);
    }
    loadDismissed();
  }, []);

  const loadRecommendations = useCallback(async (excludeIds: Set<number>, dismissed: Set<number>) => {
    setLoading(true);
    setError(null);

    try {
      // Get user's tracked shows to extract genres
      const trackedShows = await storageService.getAllShows();
      const genreIds = await extractGenresFromShows(trackedShows.slice(0, MAX_SHOWS_FOR_GENRES));

      // Create cache key based on genres
      const genreCacheKey = genreIds.length > 0 ? `forYou_${genreIds.sort().join(',')}` : 'popular';

      // Load from cache if valid
      const cachedTrending = isCacheValid('trending') ? cache['trending'].data : null;
      const cachedForYou = isCacheValid(genreCacheKey) ? cache[genreCacheKey].data : null;

      const [trendingData, forYouData] = await Promise.all([
        cachedTrending ?? tmdbService.getTrending('week'),
        cachedForYou ?? (genreIds.length > 0 ? tmdbService.discoverByGenres(genreIds) : tmdbService.getPopular()),
      ]);

      // Update cache with raw data (before filtering)
      if (!cachedTrending) {
        cache['trending'] = { data: trendingData, timestamp: Date.now() };
      }
      if (!cachedForYou) {
        cache[genreCacheKey] = { data: forYouData, timestamp: Date.now() };
      }

      // Filter out tracked and dismissed shows, then limit to MAX_ITEMS
      const filteredTrending = trendingData
        .filter((show) => !excludeIds.has(show.id) && !dismissed.has(show.id))
        .slice(0, MAX_ITEMS);

      const filteredForYou = forYouData
        .filter((show) => !excludeIds.has(show.id) && !dismissed.has(show.id))
        .slice(0, MAX_ITEMS);

      setTrending(filteredTrending);
      setForYou(filteredForYou);
    } catch (e) {
      console.error('Failed to load recommendations:', e);
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Dismiss a show from recommendations
  const dismissShow = useCallback(async (tmdbId: number) => {
    await storageService.dismissShow(tmdbId);
    setDismissedIds((prev) => new Set([...prev, tmdbId]));
    // Remove from current lists immediately for responsive UI
    setTrending((prev) => prev.filter((s) => s.id !== tmdbId));
    setForYou((prev) => prev.filter((s) => s.id !== tmdbId));
  }, []);

  // Load recommendations when trackedIds or dismissedIds changes
  useEffect(() => {
    loadRecommendations(trackedIds, dismissedIds);
  }, [trackedIds, dismissedIds, loadRecommendations]);

  return {
    trending,
    forYou,
    loading,
    error,
    refresh: () => loadRecommendations(trackedIds, dismissedIds),
    dismissShow,
  };
}

// Helper to extract genre IDs from tracked shows
async function extractGenresFromShows(shows: TrackedShow[]): Promise<number[]> {
  if (shows.length === 0) return [];

  const genreSet = new Set<number>();

  // Fetch details for each show to get genres
  const detailsPromises = shows.map((show) =>
    tmdbService.getShowDetails(show.tmdbId).catch(() => null)
  );

  const details = await Promise.all(detailsPromises);

  for (const detail of details) {
    if (detail?.genres) {
      for (const genre of detail.genres) {
        genreSet.add(genre.id);
      }
    }
  }

  return Array.from(genreSet);
}
