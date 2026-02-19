import { MediaType, IdMappingCache, ImportShowCandidate } from '../types';
import { TMDB_BASE_URL, TMDB_API_KEY } from '../utils/constants';
import { isTmdbConfigured } from './tmdb';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'showbuddy.db';
const FETCH_TIMEOUT_MS = 15000;

// Rate limiting: TMDB allows ~40-50 req/s, we stay conservative
const REQUEST_DELAY_MS = 50; // ~20 req/s
let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${TMDB_API_KEY}`,
};

// TMDB /find endpoint response
interface TMDBFindResponse {
  movie_results: Array<{ id: number; title: string; release_date?: string; poster_path?: string | null }>;
  tv_results: Array<{ id: number; name: string; first_air_date?: string; poster_path?: string | null }>;
  tv_episode_results: Array<{ id: number; show_id: number; season_number: number; episode_number: number }>;
  tv_season_results: Array<{ id: number }>;
  person_results: Array<{ id: number }>;
}

// TMDB search response
interface TMDBSearchResult {
  id: number;
  title?: string; // movies
  name?: string; // tv
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  media_type?: string;
}

class TMDBIdResolver {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);

    // Create ID mapping cache table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS id_mapping_cache (
        external_source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        PRIMARY KEY (external_source, external_id, media_type)
      );

      CREATE INDEX IF NOT EXISTS idx_mapping_tmdb ON id_mapping_cache(tmdb_id);
    `);
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) await this.init();
    return this.db!;
  }

  // Check cache for an existing mapping
  async getCached(
    source: string,
    externalId: string,
    mediaType: MediaType,
  ): Promise<number | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ tmdb_id: number }>(
      'SELECT tmdb_id FROM id_mapping_cache WHERE external_source = ? AND external_id = ? AND media_type = ?',
      [source, externalId, mediaType],
    );
    return row?.tmdb_id ?? null;
  }

  // Store a mapping in cache
  async cacheMapping(
    source: string,
    externalId: string,
    tmdbId: number,
    mediaType: MediaType,
  ): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO id_mapping_cache (external_source, external_id, tmdb_id, media_type, cached_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(external_source, external_id, media_type) DO UPDATE SET
         tmdb_id = excluded.tmdb_id,
         cached_at = excluded.cached_at`,
      [source, externalId, tmdbId, mediaType, new Date().toISOString()],
    );
  }

  // Resolve a candidate to a TMDB ID using the priority chain:
  // 1. Direct TMDB ID (if already known)
  // 2. Cache lookup
  // 3. IMDB ID → TMDB /find
  // 4. TVDB ID → TMDB /find (TV only)
  // 5. Title + year → TMDB /search
  async resolve(candidate: ImportShowCandidate): Promise<number | null> {
    if (!isTmdbConfigured()) return null;

    // If already resolved, return it
    if (candidate.tmdbId) return candidate.tmdbId;

    const { externalIds, mediaType } = candidate;

    // Strategy 1: Try IMDB ID (most reliable)
    if (externalIds?.imdbId) {
      const cached = await this.getCached('imdb', externalIds.imdbId, mediaType);
      if (cached) return cached;

      const tmdbId = await this.findByExternalId(externalIds.imdbId, 'imdb_id', mediaType);
      if (tmdbId) {
        await this.cacheMapping('imdb', externalIds.imdbId, tmdbId, mediaType);
        return tmdbId;
      }
    }

    // Strategy 2: Try TVDB ID (TV shows only)
    if (externalIds?.tvdbId && mediaType === 'tv') {
      const tvdbStr = externalIds.tvdbId.toString();
      const cached = await this.getCached('tvdb', tvdbStr, mediaType);
      if (cached) return cached;

      const tmdbId = await this.findByExternalId(tvdbStr, 'tvdb_id', mediaType);
      if (tmdbId) {
        await this.cacheMapping('tvdb', tvdbStr, tmdbId, mediaType);
        return tmdbId;
      }
    }

    // Strategy 3: Title + year search (last resort, less reliable)
    const titleKey = `${candidate.title.toLowerCase()}::${candidate.year ?? ''}`;
    const cached = await this.getCached('title', titleKey, mediaType);
    if (cached) return cached;

    const tmdbId = await this.searchByTitle(candidate.title, candidate.year, mediaType);
    if (tmdbId) {
      await this.cacheMapping('title', titleKey, tmdbId, mediaType);
      return tmdbId;
    }

    return null;
  }

  // Resolve a batch of candidates with progress reporting
  async resolveBatch(
    candidates: ImportShowCandidate[],
    onProgress?: (resolved: number, total: number) => void,
  ): Promise<Map<ImportShowCandidate, number | null>> {
    const results = new Map<ImportShowCandidate, number | null>();

    for (let i = 0; i < candidates.length; i++) {
      const tmdbId = await this.resolve(candidates[i]);
      results.set(candidates[i], tmdbId);

      if (onProgress) {
        onProgress(i + 1, candidates.length);
      }
    }

    return results;
  }

  // Use TMDB /find endpoint to look up by external ID
  private async findByExternalId(
    externalId: string,
    source: 'imdb_id' | 'tvdb_id',
    mediaType: MediaType,
    attempt: number = 0,
  ): Promise<number | null> {
    try {
      await throttle();
      const url = `${TMDB_BASE_URL}/find/${encodeURIComponent(externalId)}?external_source=${source}`;
      const response = await fetchWithTimeout(url, { headers });

      if (!response.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.findByExternalId(externalId, source, mediaType, attempt + 1);
        }
        return null;
      }

      const data: TMDBFindResponse = await response.json();

      if (mediaType === 'movie' && data.movie_results.length > 0) {
        return data.movie_results[0].id;
      }
      if (mediaType === 'tv' && data.tv_results.length > 0) {
        return data.tv_results[0].id;
      }

      return null;
    } catch (e) {
      console.warn(`[TMDBResolver] /find failed for ${source}=${externalId}:`, e);
      return null;
    }
  }

  // Search TMDB by title + year
  private async searchByTitle(
    title: string,
    year: number | undefined,
    mediaType: MediaType,
    attempt: number = 0,
  ): Promise<number | null> {
    try {
      await throttle();
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      const yearParam = year
        ? mediaType === 'movie'
          ? `&primary_release_year=${year}`
          : `&first_air_date_year=${year}`
        : '';

      const url = `${TMDB_BASE_URL}/${endpoint}?query=${encodeURIComponent(title)}${yearParam}&include_adult=false`;
      const response = await fetchWithTimeout(url, { headers });

      if (!response.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.searchByTitle(title, year, mediaType, attempt + 1);
        }
        return null;
      }

      const data = await response.json();
      const results: TMDBSearchResult[] = data.results ?? [];

      if (results.length === 0) return null;

      // If there's an exact title match (case-insensitive), prefer it
      const normalizedTitle = title.toLowerCase().trim();
      const exactMatch = results.find((r) => {
        const name = (r.title || r.name || '').toLowerCase().trim();
        return name === normalizedTitle;
      });

      return exactMatch ? exactMatch.id : results[0].id;
    } catch (e) {
      console.warn(`[TMDBResolver] search failed for "${title}" (${year}):`, e);
      return null;
    }
  }

  // Get search suggestions for manual resolution of unresolved items
  async getSuggestions(
    title: string,
    year: number | undefined,
    mediaType: MediaType,
  ): Promise<Array<{ tmdbId: number; title: string; year?: string; posterPath?: string | null; mediaType: MediaType }>> {
    try {
      await throttle();
      const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
      const url = `${TMDB_BASE_URL}/${endpoint}?query=${encodeURIComponent(title)}&include_adult=false`;
      const response = await fetchWithTimeout(url, { headers });

      if (!response.ok) return [];

      const data = await response.json();
      const results: TMDBSearchResult[] = data.results ?? [];

      return results.slice(0, 5).map((r) => ({
        tmdbId: r.id,
        title: r.title || r.name || 'Unknown',
        year: (r.release_date || r.first_air_date || '').substring(0, 4) || undefined,
        posterPath: r.poster_path,
        mediaType,
      }));
    } catch {
      return [];
    }
  }

  // Clear the entire cache (for debugging/reset)
  async clearCache(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM id_mapping_cache');
  }
}

export const tmdbIdResolver = new TMDBIdResolver();
