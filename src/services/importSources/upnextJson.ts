import {
  NormalizedImportData,
  ExportData,
  ImportShowEntry,
  ImportMovieEntry,
  ImportEpisodeEntry,
  ImportRatingEntry,
  ImportShowCandidate,
} from '../../types';

/**
 * Parse an UpNext JSON export file and convert to normalized import format.
 * This is the simplest import source since the export already uses TMDB IDs.
 */
export function parseUpNextJson(jsonString: string): NormalizedImportData {
  let data: ExportData;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid UpNext export file.');
  }

  // Validate it's an UpNext export
  if (!data.formatVersion || !data.exportedAt) {
    throw new Error('This doesn\'t appear to be an UpNext export file. Missing formatVersion or exportedAt.');
  }

  const shows: ImportShowEntry[] = [];
  const movies: ImportMovieEntry[] = [];
  const episodes: ImportEpisodeEntry[] = [];
  const ratings: ImportRatingEntry[] = [];

  // Convert shows — TMDB IDs are already known
  for (const show of Array.isArray(data.shows) ? data.shows : []) {
    const candidate: ImportShowCandidate = {
      title: show.title,
      mediaType: 'tv',
      tmdbId: show.tmdbId, // Already resolved
    };

    shows.push({
      candidate,
      status: show.status,
      addedAt: show.addedAt,
    });
  }

  // Convert movies — TMDB IDs are already known
  for (const movie of Array.isArray(data.movies) ? data.movies : []) {
    const candidate: ImportShowCandidate = {
      title: movie.title,
      mediaType: 'movie',
      tmdbId: movie.tmdbId,
    };

    movies.push({
      candidate,
      status: movie.status,
      addedAt: movie.addedAt,
    });
  }

  // Convert watched episodes
  // Prefer episodeWatchHistory (rewatch-aware) over legacy watchedEpisodes
  const episodeHistory = Array.isArray(data.episodeWatchHistory) ? data.episodeWatchHistory : [];
  const legacyEpisodes = Array.isArray(data.watchedEpisodes) ? data.watchedEpisodes : [];

  if (episodeHistory.length > 0) {
    // Use rewatch-aware history
    for (const ep of episodeHistory) {
      // Build a candidate for the show (with TMDB ID)
      const showCandidate: ImportShowCandidate = {
        title: findShowTitle(data, ep.showTmdbId),
        mediaType: 'tv',
        tmdbId: ep.showTmdbId,
      };

      episodes.push({
        showCandidate,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: ep.watchedAt,
        episodeTitle: ep.episodeTitle,
      });
    }
  } else {
    // Fall back to legacy format
    for (const ep of legacyEpisodes) {
      const showCandidate: ImportShowCandidate = {
        title: findShowTitle(data, ep.showTmdbId),
        mediaType: 'tv',
        tmdbId: ep.showTmdbId,
      };

      episodes.push({
        showCandidate,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: ep.watchedAt,
        episodeTitle: ep.episodeTitle,
      });
    }
  }

  // Convert ratings
  for (const rating of Array.isArray(data.ratings) ? data.ratings : []) {
    const mediaType: 'tv' | 'movie' = rating.ratingType === 'movie' ? 'movie' : 'tv';
    const candidate: ImportShowCandidate = {
      title: findShowTitle(data, rating.tmdbId) || `TMDB #${rating.tmdbId}`,
      mediaType,
      tmdbId: rating.tmdbId,
    };

    ratings.push({
      candidate,
      ratingType: rating.ratingType,
      rating: rating.rating,
      seasonNumber: rating.seasonNumber,
      episodeNumber: rating.episodeNumber,
      createdAt: rating.createdAt,
    });
  }

  return {
    source: 'upnext',
    shows,
    movies,
    episodes,
    ratings,
  };
}

// Helper to find a show title from the export data by TMDB ID
function findShowTitle(data: ExportData, tmdbId: number): string {
  const show = data.shows?.find((s) => s.tmdbId === tmdbId);
  if (show) return show.title;
  const movie = data.movies?.find((m) => m.tmdbId === tmdbId);
  if (movie) return movie.title;
  return `Show #${tmdbId}`;
}
