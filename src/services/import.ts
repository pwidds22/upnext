import {
  NormalizedImportData,
  ImportResult,
  ImportProgress,
  ImportShowCandidate,
  ImportShowEntry,
  ImportMovieEntry,
  ImportEpisodeEntry,
  ImportRatingEntry,
  UnresolvedItem,
  ShowStatus,
  MovieStatus,
  TrackedShow,
  TrackedMovie,
  MediaType,
} from '../types';
import { tmdbIdResolver } from './tmdbIdResolver';
import { storageService } from './storage';
import { tmdbService } from './tmdb';
import { ratingsService } from './supabase/ratings';

// Status mapping from external sources to UpNext statuses
export function mapShowStatus(sourceStatus: string | undefined): ShowStatus {
  if (!sourceStatus) return 'watchlist';
  const s = sourceStatus.toLowerCase();
  if (s === 'watching' || s === 'currently watching') return 'watching';
  if (s === 'waiting' || s === 'on hold' || s === 'hold' || s === 'paused') return 'waiting';
  if (s === 'completed' || s === 'finished' || s === 'watched') return 'completed';
  if (s === 'dropped' || s === 'quit') return 'dropped';
  if (s === 'plan to watch' || s === 'plantowatch' || s === 'watchlist') return 'watchlist';
  return 'watchlist';
}

export function mapMovieStatus(sourceStatus: string | undefined): MovieStatus {
  if (!sourceStatus) return 'watchlist';
  const s = sourceStatus.toLowerCase();
  if (s === 'completed' || s === 'finished' || s === 'watched') return 'watched';
  if (s === 'dropped' || s === 'quit') return 'dropped';
  return 'watchlist';
}

// Convert various rating scales to UpNext's 0-10 scale
export function normalizeRating(value: number, maxScale: number): number {
  // UpNext uses 0-10 (0, 1, 2, ..., 10 with halves stored as 1-10)
  const normalized = (value / maxScale) * 10;
  // Round to nearest 0.5
  return Math.round(normalized * 2) / 2;
}

/**
 * Main import orchestrator.
 * Takes normalized data from any source, resolves TMDB IDs,
 * deduplicates against existing data, and inserts into SQLite.
 * Pass userId to enable ratings import (stored in Supabase, requires auth).
 */
export async function executeImport(
  data: NormalizedImportData,
  onProgress?: (progress: ImportProgress) => void,
  userId?: string,
): Promise<ImportResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const unresolved: UnresolvedItem[] = [];

  let showsImported = 0;
  let moviesImported = 0;
  let episodesImported = 0;
  let ratingsImported = 0;
  let showsSkipped = 0;
  let moviesSkipped = 0;
  let episodesSkipped = 0;

  // Phase 1: Collect all unique candidates that need TMDB ID resolution
  onProgress?.({
    phase: 'resolving_ids',
    current: 0,
    total: 0,
    message: 'Collecting items to resolve...',
  });

  const allCandidates = collectUniqueCandidates(data);
  const totalToResolve = allCandidates.length;

  // Phase 2: Resolve TMDB IDs for all candidates
  const resolvedMap = new Map<string, number>(); // candidateKey → tmdbId

  for (let i = 0; i < allCandidates.length; i++) {
    const candidate = allCandidates[i];
    const key = candidateKey(candidate);

    onProgress?.({
      phase: 'resolving_ids',
      current: i + 1,
      total: totalToResolve,
      message: `Resolving: ${candidate.title}`,
    });

    // Skip if already resolved in this batch (same show referenced multiple times)
    if (resolvedMap.has(key)) continue;

    const tmdbId = await tmdbIdResolver.resolve(candidate);

    if (tmdbId) {
      resolvedMap.set(key, tmdbId);
    } else {
      // Get suggestions for manual resolution
      const suggestions = await tmdbIdResolver.getSuggestions(
        candidate.title,
        candidate.year,
        candidate.mediaType,
      );
      unresolved.push({
        candidate,
        reason: `Could not find "${candidate.title}" (${candidate.year ?? 'unknown year'}) on TMDB`,
        suggestions,
      });
    }
  }

  // Phase 3: Import resolved items into SQLite
  const totalItems = data.shows.length + data.movies.length + data.episodes.length + data.ratings.length;
  let importedCount = 0;

  // Import shows
  for (const showEntry of data.shows) {
    importedCount++;
    onProgress?.({
      phase: 'importing',
      current: importedCount,
      total: totalItems,
      message: `Importing show: ${showEntry.candidate.title}`,
    });

    const tmdbId = resolvedMap.get(candidateKey(showEntry.candidate));
    if (!tmdbId) continue; // Unresolved, skip

    try {
      const result = await importShow(tmdbId, showEntry);
      if (result === 'imported') showsImported++;
      else if (result === 'skipped') showsSkipped++;
    } catch (e) {
      errors.push(`Show "${showEntry.candidate.title}": ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  // Import movies
  for (const movieEntry of data.movies) {
    importedCount++;
    onProgress?.({
      phase: 'importing',
      current: importedCount,
      total: totalItems,
      message: `Importing movie: ${movieEntry.candidate.title}`,
    });

    const tmdbId = resolvedMap.get(candidateKey(movieEntry.candidate));
    if (!tmdbId) continue;

    try {
      const result = await importMovie(tmdbId, movieEntry);
      if (result === 'imported') moviesImported++;
      else if (result === 'skipped') moviesSkipped++;
    } catch (e) {
      errors.push(`Movie "${movieEntry.candidate.title}": ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  // Import episodes
  for (const epEntry of data.episodes) {
    importedCount++;
    if (importedCount % 15 === 0) {
      onProgress?.({
        phase: 'importing',
        current: importedCount,
        total: totalItems,
        message: `Importing episodes... (${importedCount}/${totalItems})`,
      });
    }

    const tmdbId = resolvedMap.get(candidateKey(epEntry.showCandidate));
    if (!tmdbId) continue;

    try {
      const result = await importEpisode(tmdbId, epEntry);
      if (result === 'imported') episodesImported++;
      else if (result === 'skipped') episodesSkipped++;
    } catch (e) {
      // Don't log every episode error — could be thousands
      if (errors.length < 50) {
        errors.push(`Episode S${epEntry.seasonNumber}E${epEntry.episodeNumber}: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
  }

  // Indicate if errors were truncated
  if (errors.length >= 50) {
    errors.push('...additional errors were suppressed');
  }

  // Import ratings (requires userId — stored in Supabase, not SQLite)
  if (data.ratings.length > 0) {
    if (!userId) {
      errors.push(`Sign in to import ratings (${data.ratings.length} ratings skipped)`);
    } else {
      for (const ratingEntry of data.ratings) {
        importedCount++;
        if (importedCount % 10 === 0) {
          onProgress?.({
            phase: 'importing',
            current: importedCount,
            total: totalItems,
            message: `Importing ratings... (${importedCount}/${totalItems})`,
          });
        }

        const tmdbId = resolvedMap.get(candidateKey(ratingEntry.candidate));
        if (!tmdbId) continue;

        try {
          const ratingInput = { tmdbId, rating: ratingEntry.rating, isPublic: false };

          if (ratingEntry.ratingType === 'show') {
            await ratingsService.rateShow(userId, ratingInput);
          } else if (ratingEntry.ratingType === 'movie') {
            await ratingsService.rateMovie(userId, ratingInput);
          } else if (ratingEntry.ratingType === 'episode' && ratingEntry.seasonNumber != null && ratingEntry.episodeNumber != null) {
            await ratingsService.rateEpisode(userId, tmdbId, ratingEntry.seasonNumber, ratingEntry.episodeNumber, ratingInput);
          } else if (ratingEntry.ratingType === 'season' && ratingEntry.seasonNumber != null) {
            await ratingsService.rateSeason(userId, tmdbId, ratingEntry.seasonNumber, ratingInput);
          }

          ratingsImported++;
        } catch (e) {
          if (errors.length < 50) {
            errors.push(`Rating "${ratingEntry.candidate.title}": ${e instanceof Error ? e.message : 'unknown error'}`);
          }
        }
      }
    }
  }

  onProgress?.({
    phase: 'complete',
    current: totalItems,
    total: totalItems,
    message: 'Import complete!',
  });

  return {
    source: data.source,
    showsImported,
    moviesImported,
    episodesImported,
    ratingsImported,
    showsSkipped,
    moviesSkipped,
    episodesSkipped,
    unresolved,
    errors,
    durationMs: Date.now() - startTime,
  };
}

// Collect all unique candidates from the import data
function collectUniqueCandidates(data: NormalizedImportData): ImportShowCandidate[] {
  const seen = new Set<string>();
  const candidates: ImportShowCandidate[] = [];

  const add = (c: ImportShowCandidate) => {
    const key = candidateKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(c);
    }
  };

  for (const s of data.shows) add(s.candidate);
  for (const m of data.movies) add(m.candidate);
  for (const e of data.episodes) add(e.showCandidate);
  for (const r of data.ratings) add(r.candidate);

  return candidates;
}

// Generate a unique key for a candidate
function candidateKey(c: ImportShowCandidate): string {
  // Prefer external IDs for uniqueness, fall back to title+year
  if (c.externalIds?.imdbId) return `imdb:${c.externalIds.imdbId}`;
  if (c.externalIds?.tvdbId) return `tvdb:${c.externalIds.tvdbId}:${c.mediaType}`;
  if (c.externalIds?.traktId) return `trakt:${c.externalIds.traktId}:${c.mediaType}`;
  if (c.externalIds?.simklId) return `simkl:${c.externalIds.simklId}:${c.mediaType}`;
  return `title:${c.title.toLowerCase().trim()}:${c.year ?? ''}:${c.mediaType}`;
}

// Import a single show — returns 'imported', 'skipped', or throws
async function importShow(tmdbId: number, entry: ImportShowEntry): Promise<'imported' | 'skipped'> {
  // Check if already tracked
  const existing = await storageService.getShow(tmdbId);
  if (existing) return 'skipped';

  // Fetch full details from TMDB to get season/episode counts
  let totalSeasons = 0;
  let totalEpisodes = 0;
  let posterPath: string | null = null;
  let airedEpisodes: number | undefined;

  try {
    const details = await tmdbService.getShowDetails(tmdbId);
    totalSeasons = details.number_of_seasons ?? 0;
    totalEpisodes = details.number_of_episodes ?? 0;
    posterPath = details.poster_path;
    // aired_episodes not directly in TMDB show details, but total is close enough for import
    airedEpisodes = totalEpisodes;
  } catch {
    // If TMDB details fail, use what we have
    posterPath = null;
  }

  const show: TrackedShow = {
    mediaType: 'tv',
    tmdbId,
    title: entry.candidate.title,
    posterPath,
    status: entry.status,
    addedAt: entry.addedAt ?? new Date().toISOString(),
    totalSeasons,
    totalEpisodes,
    airedEpisodes,
    streamingServices: [],
  };

  await storageService.addShow(show);
  return 'imported';
}

// Import a single movie — returns 'imported', 'skipped', or throws
async function importMovie(tmdbId: number, entry: ImportMovieEntry): Promise<'imported' | 'skipped'> {
  // Check if already tracked
  const existing = await storageService.getMovie(tmdbId);
  if (existing) return 'skipped';

  let posterPath: string | null = null;
  let releaseDate: string | null = null;
  let runtime: number | null = null;

  try {
    const details = await tmdbService.getMovieDetails(tmdbId);
    posterPath = details.poster_path;
    releaseDate = details.release_date ?? null;
    runtime = details.runtime ?? null;
  } catch {
    // Use what we have
  }

  const movie: TrackedMovie = {
    mediaType: 'movie',
    tmdbId,
    title: entry.candidate.title,
    posterPath,
    status: entry.status,
    addedAt: entry.addedAt ?? new Date().toISOString(),
    releaseDate,
    runtime,
    streamingServices: [],
  };

  await storageService.addMovie(movie);

  // If there's a watched_at date and status is 'watched', add watch history
  if (entry.watchedAt && entry.status === 'watched') {
    try {
      await storageService.addMovieWatchHistory(tmdbId, entry.watchedAt);
    } catch {
      // Non-fatal — show was imported, history failed
    }
  }

  return 'imported';
}

// Import a single episode watch — returns 'imported', 'skipped', or throws
async function importEpisode(showTmdbId: number, entry: ImportEpisodeEntry): Promise<'imported' | 'skipped'> {
  // Ensure the show is tracked — addShow handles "already exists" internally,
  // so no need for a separate isShowTracked check (avoids race condition gap)
  let showTitle = entry.showCandidate.title;
  let posterPath: string | null = null;
  let totalSeasons = 0;
  let totalEpisodes = 0;

  try {
    const details = await tmdbService.getShowDetails(showTmdbId);
    showTitle = entry.showCandidate.title || details.name;
    posterPath = details.poster_path;
    totalSeasons = details.number_of_seasons ?? 0;
    totalEpisodes = details.number_of_episodes ?? 0;
  } catch {
    // If TMDB details fail, use what we have from the candidate
  }

  const show: TrackedShow = {
    mediaType: 'tv',
    tmdbId: showTmdbId,
    title: showTitle,
    posterPath,
    status: 'watching',
    addedAt: entry.watchedAt,
    totalSeasons,
    totalEpisodes,
    airedEpisodes: totalEpisodes || undefined,
    streamingServices: [],
  };
  await storageService.addShow(show); // No-op if already tracked

  // Mark episode as watched (check-then-insert handles dedup)
  await storageService.markEpisodeWatched({
    showTmdbId,
    seasonNumber: entry.seasonNumber,
    episodeNumber: entry.episodeNumber,
    watchedAt: entry.watchedAt,
    episodeTitle: entry.episodeTitle,
  });

  // Also add to watch history for rewatch tracking
  try {
    await storageService.addEpisodeWatchHistory(
      showTmdbId,
      entry.seasonNumber,
      entry.episodeNumber,
      entry.watchedAt,
      entry.episodeTitle,
    );
  } catch {
    // Non-fatal — episode was marked watched, history is a bonus
  }

  return 'imported';
}
