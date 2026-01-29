import { useState, useEffect, useCallback } from 'react';
import { TMDBMovie, TrackedMovie } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';

// Simple in-memory cache with TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ITEMS = 10;
const MAX_MOVIES_FOR_GENRES = 5;

interface CacheEntry {
  data: TMDBMovie[];
  timestamp: number;
}

const movieCache: Record<string, CacheEntry> = {};

function isCacheValid(key: string): boolean {
  const entry = movieCache[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function useMovieRecommendations(trackedIds: Set<number>) {
  const [trending, setTrending] = useState<TMDBMovie[]>([]);
  const [forYou, setForYou] = useState<TMDBMovie[]>([]);
  const [topRated, setTopRated] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  // Load dismissed IDs on mount
  useEffect(() => {
    async function loadDismissed() {
      const ids = await storageService.getDismissedMovieIds();
      setDismissedIds(ids);
    }
    loadDismissed();
  }, []);

  const loadRecommendations = useCallback(async (excludeIds: Set<number>, dismissed: Set<number>) => {
    setLoading(true);
    setError(null);

    try {
      // Get user's tracked movies to extract genres
      const trackedMovies = await storageService.getAllMovies();
      const genreIds = await extractGenresFromMovies(trackedMovies.slice(0, MAX_MOVIES_FOR_GENRES));

      // Create cache key based on genres
      const genreCacheKey = genreIds.length > 0 ? `movieForYou_${genreIds.sort().join(',')}` : 'moviePopular';

      // Load from cache if valid
      const cachedTrending = isCacheValid('movieTrending') ? movieCache['movieTrending'].data : null;
      const cachedForYou = isCacheValid(genreCacheKey) ? movieCache[genreCacheKey].data : null;
      const cachedTopRated = isCacheValid('movieTopRated') ? movieCache['movieTopRated'].data : null;

      const [trendingData, forYouData, topRatedData] = await Promise.all([
        cachedTrending ?? tmdbService.getTrendingMovies('week'),
        cachedForYou ?? (genreIds.length > 0 ? tmdbService.discoverMoviesByGenres(genreIds) : tmdbService.getPopularMovies()),
        cachedTopRated ?? tmdbService.getTopRatedMovies(),
      ]);

      // Update cache with raw data (before filtering)
      if (!cachedTrending) {
        movieCache['movieTrending'] = { data: trendingData, timestamp: Date.now() };
      }
      if (!cachedForYou) {
        movieCache[genreCacheKey] = { data: forYouData, timestamp: Date.now() };
      }
      if (!cachedTopRated) {
        movieCache['movieTopRated'] = { data: topRatedData, timestamp: Date.now() };
      }

      // Create a set to track IDs we've already used (for deduplication)
      const usedIds = new Set<number>([...excludeIds, ...dismissed]);

      // Filter trending first (highest priority)
      const filteredTrending = trendingData
        .filter((movie) => !usedIds.has(movie.id))
        .slice(0, MAX_ITEMS);

      // Add trending IDs to usedIds
      filteredTrending.forEach((movie) => usedIds.add(movie.id));

      // Filter forYou, excluding trending movies
      const filteredForYou = forYouData
        .filter((movie) => !usedIds.has(movie.id))
        .slice(0, MAX_ITEMS);

      // Add forYou IDs to usedIds
      filteredForYou.forEach((movie) => usedIds.add(movie.id));

      // Filter topRated, excluding trending and forYou movies
      const filteredTopRated = topRatedData
        .filter((movie) => !usedIds.has(movie.id))
        .slice(0, MAX_ITEMS);

      setTrending(filteredTrending);
      setForYou(filteredForYou);
      setTopRated(filteredTopRated);
    } catch (e) {
      console.error('Failed to load movie recommendations:', e);
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Dismiss a movie from recommendations
  const dismissMovie = useCallback(async (tmdbId: number) => {
    await storageService.dismissMovie(tmdbId);
    setDismissedIds((prev) => new Set([...prev, tmdbId]));
    // Remove from current lists immediately for responsive UI
    setTrending((prev) => prev.filter((m) => m.id !== tmdbId));
    setForYou((prev) => prev.filter((m) => m.id !== tmdbId));
    setTopRated((prev) => prev.filter((m) => m.id !== tmdbId));
  }, []);

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
    dismissMovie,
  };
}

// Helper to extract genre IDs from tracked movies
async function extractGenresFromMovies(movies: TrackedMovie[]): Promise<number[]> {
  if (movies.length === 0) return [];

  const genreSet = new Set<number>();

  // Fetch details for each movie to get genres
  const detailsPromises = movies.map((movie) =>
    tmdbService.getMovieDetails(movie.tmdbId).catch(() => null)
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
