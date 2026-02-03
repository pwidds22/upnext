import { useMemo } from 'react';
import { TMDBShow, TrackedShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { useMediaRecommendations } from './useMediaRecommendations';

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

// Number of pages to fetch for recommendations (2 pages = ~40 items per category)
// This ensures enough items for backfill after filtering out tracked/dismissed/duplicates
const RECOMMENDATION_PAGES = 2;

export function useRecommendations(trackedIds: Set<number>) {
  const config = useMemo(() => ({
    cacheKeyPrefix: 'show',
    getDismissedIds: () => storageService.getDismissedShowIds(),
    dismissItem: (tmdbId: number) => storageService.dismissShow(tmdbId),
    getAllTracked: () => storageService.getAllShows(),
    fetchTrending: () => tmdbService.getTrending('week', RECOMMENDATION_PAGES),
    fetchByGenres: (genreIds: number[]) => tmdbService.discoverByGenres(genreIds, RECOMMENDATION_PAGES),
    fetchPopular: () => tmdbService.getPopular(RECOMMENDATION_PAGES),
    fetchTopRated: () => tmdbService.getTopRated(RECOMMENDATION_PAGES),
    extractGenres: extractGenresFromShows,
  }), []);

  const result = useMediaRecommendations<TMDBShow, TrackedShow>(trackedIds, config);

  // Alias dismiss to dismissShow for backward compatibility
  return {
    ...result,
    dismissShow: result.dismiss,
  };
}
