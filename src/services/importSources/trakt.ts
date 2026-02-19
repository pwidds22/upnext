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

// Trakt API configuration
const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_API_VERSION = '2';
const PAGE_SIZE = 1000; // Max allowed by Trakt
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

// Trakt API response types
interface TraktIds {
  trakt: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

interface TraktShow {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktMovie {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktEpisode {
  season: number;
  number: number;
  title?: string;
  ids: TraktIds;
}

interface TraktWatchedShow {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  show: TraktShow;
  seasons: Array<{
    number: number;
    episodes: Array<{
      number: number;
      plays: number;
      last_watched_at: string;
    }>;
  }>;
}

interface TraktWatchedMovie {
  plays: number;
  last_watched_at: string;
  movie: TraktMovie;
}

interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: string;
  episode?: TraktEpisode;
  show?: TraktShow;
  movie?: TraktMovie;
}

interface TraktRatingItem {
  rated_at: string;
  rating: number; // 1-10
  type: string;
  show?: TraktShow;
  movie?: TraktMovie;
  episode?: TraktEpisode;
  season?: { number: number; ids: TraktIds };
}

interface TraktWatchlistItem {
  listed_at: string;
  type: string;
  show?: TraktShow;
  movie?: TraktMovie;
}

// Build headers for authenticated Trakt requests
function traktHeaders(clientId: string, accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'trakt-api-key': clientId,
    'trakt-api-version': TRAKT_API_VERSION,
    'Authorization': `Bearer ${accessToken}`,
  };
}

// Fetch all pages from a paginated Trakt endpoint
async function fetchAllPages<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T[]> {
  const allResults: T[] = [];
  let page = 1;
  let retries = 0;
  const MAX_RETRIES = 3;

  while (true) {
    const separator = url.includes('?') ? '&' : '?';
    const pageUrl = `${url}${separator}page=${page}&limit=${PAGE_SIZE}`;

    const response = await fetchWithTimeout(pageUrl, { headers });

    if (response.status === 429) {
      if (retries >= MAX_RETRIES) {
        throw new Error('Trakt API rate limit exceeded after multiple retries');
      }
      retries++;
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue; // Retry same page
    }
    retries = 0; // Reset on successful request

    if (!response.ok) {
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`);
    }

    const data: T[] = await response.json();
    allResults.push(...data);

    const totalPages = parseInt(response.headers.get('X-Pagination-Page-Count') || '1', 10);
    if (page >= totalPages) break;
    page++;
  }

  return allResults;
}

// Build an ImportShowCandidate from Trakt show data
function showCandidate(show: TraktShow): ImportShowCandidate {
  return {
    title: show.title,
    year: show.year ?? undefined,
    mediaType: 'tv',
    tmdbId: show.ids.tmdb, // Trakt provides TMDB IDs natively
    externalIds: {
      imdbId: show.ids.imdb,
      tvdbId: show.ids.tvdb,
      traktId: show.ids.trakt,
      traktSlug: show.ids.slug,
    },
  };
}

// Build an ImportShowCandidate from Trakt movie data
function movieCandidate(movie: TraktMovie): ImportShowCandidate {
  return {
    title: movie.title,
    year: movie.year ?? undefined,
    mediaType: 'movie',
    tmdbId: movie.ids.tmdb,
    externalIds: {
      imdbId: movie.ids.imdb,
      traktId: movie.ids.trakt,
      traktSlug: movie.ids.slug,
    },
  };
}

/**
 * Import all data from a user's Trakt account.
 * Requires a valid OAuth access token and client ID.
 */
export async function parseTraktData(
  clientId: string,
  accessToken: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<NormalizedImportData> {
  const hdrs = traktHeaders(clientId, accessToken);
  const shows: ImportShowEntry[] = [];
  const movies: ImportMovieEntry[] = [];
  const episodes: ImportEpisodeEntry[] = [];
  const ratings: ImportRatingEntry[] = [];

  // Step 1: Fetch watched shows (summary with seasons/episodes)
  onProgress?.({ phase: 'parsing', current: 1, total: 6, message: 'Fetching watched shows...' });
  const watchedShows = await fetchAllPages<TraktWatchedShow>(
    `${TRAKT_API_URL}/sync/watched/shows`,
    hdrs,
  );

  for (const ws of watchedShows) {
    const candidate = showCandidate(ws.show);

    // Determine status based on watch data
    shows.push({
      candidate,
      status: 'watching', // Will be refined by the user or kept as default
      addedAt: ws.last_watched_at,
    });

    // Extract individual episode watches with timestamps
    for (const season of ws.seasons) {
      for (const ep of season.episodes) {
        episodes.push({
          showCandidate: candidate,
          seasonNumber: season.number,
          episodeNumber: ep.number,
          watchedAt: ep.last_watched_at,
        });
      }
    }
  }

  // Step 2: Fetch watched movies
  onProgress?.({ phase: 'parsing', current: 2, total: 6, message: 'Fetching watched movies...' });
  const watchedMovies = await fetchAllPages<TraktWatchedMovie>(
    `${TRAKT_API_URL}/sync/watched/movies`,
    hdrs,
  );

  for (const wm of watchedMovies) {
    movies.push({
      candidate: movieCandidate(wm.movie),
      status: 'watched',
      addedAt: wm.last_watched_at,
      watchedAt: wm.last_watched_at,
    });
  }

  // Step 3: Fetch watchlist (shows)
  onProgress?.({ phase: 'parsing', current: 3, total: 6, message: 'Fetching watchlist...' });
  const watchlistShows = await fetchAllPages<TraktWatchlistItem>(
    `${TRAKT_API_URL}/sync/watchlist/shows`,
    hdrs,
  );

  for (const item of watchlistShows) {
    if (!item.show) continue;
    // Only add if not already in watched shows
    const alreadyWatched = shows.some(
      (s) => s.candidate.externalIds?.traktId === item.show!.ids.trakt,
    );
    if (!alreadyWatched) {
      shows.push({
        candidate: showCandidate(item.show),
        status: 'watchlist',
        addedAt: item.listed_at,
      });
    }
  }

  // Step 4: Fetch watchlist (movies)
  onProgress?.({ phase: 'parsing', current: 4, total: 6, message: 'Fetching movie watchlist...' });
  const watchlistMovies = await fetchAllPages<TraktWatchlistItem>(
    `${TRAKT_API_URL}/sync/watchlist/movies`,
    hdrs,
  );

  for (const item of watchlistMovies) {
    if (!item.movie) continue;
    const alreadyWatched = movies.some(
      (m) => m.candidate.externalIds?.traktId === item.movie!.ids.trakt,
    );
    if (!alreadyWatched) {
      movies.push({
        candidate: movieCandidate(item.movie),
        status: 'watchlist',
        addedAt: item.listed_at,
      });
    }
  }

  // Step 5: Fetch ratings
  onProgress?.({ phase: 'parsing', current: 5, total: 6, message: 'Fetching ratings...' });

  const showRatings = await fetchAllPages<TraktRatingItem>(
    `${TRAKT_API_URL}/sync/ratings/shows`,
    hdrs,
  );
  const movieRatings = await fetchAllPages<TraktRatingItem>(
    `${TRAKT_API_URL}/sync/ratings/movies`,
    hdrs,
  );
  const episodeRatings = await fetchAllPages<TraktRatingItem>(
    `${TRAKT_API_URL}/sync/ratings/episodes`,
    hdrs,
  );

  for (const r of showRatings) {
    if (!r.show) continue;
    ratings.push({
      candidate: showCandidate(r.show),
      ratingType: 'show',
      rating: r.rating, // Trakt already uses 1-10
      createdAt: r.rated_at,
    });
  }

  for (const r of movieRatings) {
    if (!r.movie) continue;
    ratings.push({
      candidate: movieCandidate(r.movie),
      ratingType: 'movie',
      rating: r.rating,
      createdAt: r.rated_at,
    });
  }

  for (const r of episodeRatings) {
    if (!r.show || !r.episode) continue;
    ratings.push({
      candidate: showCandidate(r.show),
      ratingType: 'episode',
      rating: r.rating,
      seasonNumber: r.episode.season,
      episodeNumber: r.episode.number,
      createdAt: r.rated_at,
    });
  }

  onProgress?.({ phase: 'parsing', current: 6, total: 6, message: 'Trakt data fetched!' });

  return {
    source: 'trakt',
    shows,
    movies,
    episodes,
    ratings,
  };
}
