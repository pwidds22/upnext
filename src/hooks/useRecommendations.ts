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

export function useRecommendations(trackedIds: Set<number>) {
  const config = useMemo(() => ({
    cacheKeyPrefix: 'show',
    getDismissedIds: () => storageService.getDismissedShowIds(),
    dismissItem: (tmdbId: number) => storageService.dismissShow(tmdbId),
    getAllTracked: () => storageService.getAllShows(),
    fetchTrending: () => tmdbService.getTrending('week'),
    fetchByGenres: (genreIds: number[]) => tmdbService.discoverByGenres(genreIds),
    fetchPopular: () => tmdbService.getPopular(),
    fetchTopRated: () => tmdbService.getTopRated(),
    extractGenres: extractGenresFromShows,
  }), []);

  const result = useMediaRecommendations<TMDBShow, TrackedShow>(trackedIds, config);

  // Alias dismiss to dismissShow for backward compatibility
  return {
    ...result,
    dismissShow: result.dismiss,
  };
}
