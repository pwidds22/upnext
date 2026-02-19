import {
  NormalizedImportData,
  ImportShowEntry,
  ImportMovieEntry,
  ImportEpisodeEntry,
  ImportRatingEntry,
  ImportShowCandidate,
  ImportProgress,
} from '../../types';
import { mapShowStatus, mapMovieStatus, normalizeRating } from '../import';

// SIMKL API configuration
const SIMKL_API_URL = 'https://api.simkl.com';
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// SIMKL API response types
interface SimklIds {
  simkl: number;
  imdb?: string;
  tmdb?: string; // Note: SIMKL returns tmdb as string
  tvdb?: string;
  slug?: string;
}

interface SimklShowItem {
  title: string;
  year?: number;
  ids: SimklIds;
  user_rating?: number; // 1-10
  last_watched_at?: string;
  status?: string; // 'watching', 'completed', 'plantowatch', 'hold', 'dropped'
  watched_episodes_count?: number;
  total_episodes_count?: number;
  seasons?: Array<{
    number: number;
    episodes: Array<{
      number: number;
      watched_at?: string;
    }>;
  }>;
}

interface SimklMovieItem {
  title: string;
  year?: number;
  ids: SimklIds;
  user_rating?: number;
  last_watched_at?: string;
  status?: string;
}

interface SimklAllItemsResponse {
  shows?: SimklShowItem[];
  movies?: SimklMovieItem[];
  anime?: SimklShowItem[];
}

// Build headers for authenticated SIMKL requests
function simklHeaders(clientId: string, accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'simkl-api-key': clientId,
    'Authorization': `Bearer ${accessToken}`,
  };
}

// Build an ImportShowCandidate from SIMKL show data
function showCandidate(show: SimklShowItem): ImportShowCandidate {
  return {
    title: show.title,
    year: show.year,
    mediaType: 'tv',
    tmdbId: show.ids.tmdb ? parseInt(show.ids.tmdb, 10) : undefined,
    externalIds: {
      imdbId: show.ids.imdb,
      tvdbId: show.ids.tvdb ? parseInt(show.ids.tvdb, 10) : undefined,
      simklId: show.ids.simkl,
    },
  };
}

// Build an ImportShowCandidate from SIMKL movie data
function movieCandidate(movie: SimklMovieItem): ImportShowCandidate {
  return {
    title: movie.title,
    year: movie.year,
    mediaType: 'movie',
    tmdbId: movie.ids.tmdb ? parseInt(movie.ids.tmdb, 10) : undefined,
    externalIds: {
      imdbId: movie.ids.imdb,
      simklId: movie.ids.simkl,
    },
  };
}

/**
 * Import all data from a user's SIMKL account.
 * Requires a valid OAuth access token and client ID.
 * SIMKL consolidates everything into /sync/all-items — only 3 API calls needed.
 */
export async function parseSimklData(
  clientId: string,
  accessToken: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<NormalizedImportData> {
  const hdrs = simklHeaders(clientId, accessToken);
  const shows: ImportShowEntry[] = [];
  const movies: ImportMovieEntry[] = [];
  const episodes: ImportEpisodeEntry[] = [];
  const ratings: ImportRatingEntry[] = [];

  // Step 1: Fetch all TV shows with episode details
  onProgress?.({ phase: 'parsing', current: 1, total: 3, message: 'Fetching TV shows from SIMKL...' });

  let tvData: { shows: SimklShowItem[] } = { shows: [] };
  try {
    const tvResponse = await fetchWithTimeout(
      `${SIMKL_API_URL}/sync/all-items/tv?extended=full&episode_watched_at=yes`,
      { headers: hdrs },
    );
    if (!tvResponse.ok) {
      throw new Error(`SIMKL API error (TV): ${tvResponse.status} ${tvResponse.statusText}`);
    }
    tvData = await tvResponse.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Failed to fetch TV shows from SIMKL: ${msg}`);
  }

  for (const show of tvData.shows ?? []) {
    const candidate = showCandidate(show);

    shows.push({
      candidate,
      status: mapShowStatus(show.status),
      addedAt: show.last_watched_at,
    });

    // Extract episode-level watch data
    if (show.seasons) {
      for (const season of show.seasons) {
        for (const ep of season.episodes) {
          episodes.push({
            showCandidate: candidate,
            seasonNumber: season.number,
            episodeNumber: ep.number,
            watchedAt: ep.watched_at || show.last_watched_at || new Date().toISOString(),
          });
        }
      }
    }

    // Extract rating
    if (show.user_rating) {
      ratings.push({
        candidate,
        ratingType: 'show',
        rating: show.user_rating, // SIMKL uses 1-10
      });
    }
  }

  // Step 2: Fetch all movies
  onProgress?.({ phase: 'parsing', current: 2, total: 3, message: 'Fetching movies from SIMKL...' });

  let movieData: { movies: SimklMovieItem[] } = { movies: [] };
  try {
    const movieResponse = await fetchWithTimeout(
      `${SIMKL_API_URL}/sync/all-items/movies?extended=full`,
      { headers: hdrs },
    );
    if (!movieResponse.ok) {
      throw new Error(`SIMKL API error (movies): ${movieResponse.status} ${movieResponse.statusText}`);
    }
    movieData = await movieResponse.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Failed to fetch movies from SIMKL: ${msg}`);
  }

  for (const movie of movieData.movies ?? []) {
    const candidate = movieCandidate(movie);

    movies.push({
      candidate,
      status: mapMovieStatus(movie.status),
      addedAt: movie.last_watched_at,
      watchedAt: movie.status === 'completed' ? movie.last_watched_at : undefined,
    });

    if (movie.user_rating) {
      ratings.push({
        candidate,
        ratingType: 'movie',
        rating: movie.user_rating,
      });
    }
  }

  // Step 3: Fetch anime (treated as TV shows)
  onProgress?.({ phase: 'parsing', current: 3, total: 3, message: 'Fetching anime from SIMKL...' });

  let animeData: { shows: SimklShowItem[] } = { shows: [] };
  try {
    const animeResponse = await fetchWithTimeout(
      `${SIMKL_API_URL}/sync/all-items/anime?extended=full&episode_watched_at=yes`,
      { headers: hdrs },
    );
    if (!animeResponse.ok) {
      throw new Error(`SIMKL API error (anime): ${animeResponse.status} ${animeResponse.statusText}`);
    }
    animeData = await animeResponse.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Failed to fetch anime from SIMKL: ${msg}`);
  }

  for (const anime of animeData.shows ?? []) {
    const candidate = showCandidate(anime);

    shows.push({
      candidate,
      status: mapShowStatus(anime.status),
      addedAt: anime.last_watched_at,
    });

    if (anime.seasons) {
      for (const season of anime.seasons) {
        for (const ep of season.episodes) {
          episodes.push({
            showCandidate: candidate,
            seasonNumber: season.number,
            episodeNumber: ep.number,
            watchedAt: ep.watched_at || anime.last_watched_at || new Date().toISOString(),
          });
        }
      }
    }

    if (anime.user_rating) {
      ratings.push({
        candidate,
        ratingType: 'show',
        rating: anime.user_rating,
      });
    }
  }

  return { source: 'simkl', shows, movies, episodes, ratings };
}
