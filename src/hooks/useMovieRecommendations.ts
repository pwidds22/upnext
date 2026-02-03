import { useMemo } from 'react';
import { TMDBMovie, TrackedMovie } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { useMediaRecommendations } from './useMediaRecommendations';

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

// Number of pages to fetch for recommendations (2 pages = ~40 items per category)
// This ensures enough items for backfill after filtering out tracked/dismissed/duplicates
const RECOMMENDATION_PAGES = 2;

export function useMovieRecommendations(trackedIds: Set<number>) {
  const config = useMemo(() => ({
    cacheKeyPrefix: 'movie',
    getDismissedIds: () => storageService.getDismissedMovieIds(),
    dismissItem: (tmdbId: number) => storageService.dismissMovie(tmdbId),
    getAllTracked: () => storageService.getAllMovies(),
    fetchTrending: () => tmdbService.getTrendingMovies('week', RECOMMENDATION_PAGES),
    fetchByGenres: (genreIds: number[]) => tmdbService.discoverMoviesByGenres(genreIds, RECOMMENDATION_PAGES),
    fetchPopular: () => tmdbService.getPopularMovies(RECOMMENDATION_PAGES),
    fetchTopRated: () => tmdbService.getTopRatedMovies(RECOMMENDATION_PAGES),
    extractGenres: extractGenresFromMovies,
  }), []);

  const result = useMediaRecommendations<TMDBMovie, TrackedMovie>(trackedIds, config);

  // Alias dismiss to dismissMovie for backward compatibility
  return {
    ...result,
    dismissMovie: result.dismiss,
  };
}
