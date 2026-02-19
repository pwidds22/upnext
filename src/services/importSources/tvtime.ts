import {
  NormalizedImportData,
  ImportShowEntry,
  ImportMovieEntry,
  ImportEpisodeEntry,
  ImportShowCandidate,
} from '../../types';
import { mapShowStatus, mapMovieStatus } from '../import';

// ==================== CSV ERA (pre-2025) ====================

// CSV column headers for TV Time tracking files
// tracking-prod-records-v2.csv: TV show episode data
// tracking-prod-records.csv: Movie tracking data
// seen_episode.csv: Episode watch history
// followed_tv_show.csv: Followed shows

interface TVTimeCSVRow {
  [key: string]: string | undefined;
}

// Parse a CSV string into rows (handles quoted fields, newlines in quotes)
function parseCSV(csvString: string): TVTimeCSVRow[] {
  const lines = csvString.split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0].trim();
  const headers = parseCSVLine(headerLine);

  const rows: TVTimeCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: TVTimeCSVRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

// Parse TV Time date format: "YYYY-MM-DD HH:MM:SS" (locale-dependent)
function parseTVTimeDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '' || dateStr.startsWith('0000-')) {
    return new Date().toISOString(); // Fallback for broken dates
  }

  // Try standard format first
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // Fall through
  }

  // Try "YYYY-MM-DD HH:MM:SS" format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    return new Date(
      Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(min), parseInt(sec)),
    ).toISOString();
  }

  return new Date().toISOString();
}

/**
 * Parse TV Time CSV-era export (pre-2025).
 * Expects file contents as a map of filename → content string.
 */
export function parseTVTimeCSV(files: Record<string, string>): NormalizedImportData {
  const shows: ImportShowEntry[] = [];
  const movies: ImportMovieEntry[] = [];
  const episodes: ImportEpisodeEntry[] = [];
  const seenShows = new Set<string>(); // Track by title (no IDs available)

  // Parse TV show episodes (tracking-prod-records-v2.csv)
  const tvFile = files['tracking-prod-records-v2.csv'] || files['seen_episode.csv'];
  if (tvFile) {
    const rows = parseCSV(tvFile);
    for (const row of rows) {
      const showName = row['tv_show_name'] || row['show_name'] || '';
      if (!showName) continue;

      const seasonStr = row['episode_season_number'] || row['season_number'] || '';
      const episodeStr = row['episode_number'] || '';
      const seasonNum = parseInt(seasonStr, 10);
      const episodeNum = parseInt(episodeStr, 10);

      if (isNaN(seasonNum) || isNaN(episodeNum) || episodeNum < 0) continue; // Skip rows with missing episode data

      const candidate: ImportShowCandidate = {
        title: showName,
        mediaType: 'tv',
        // TV Time has ZERO external IDs — name-only resolution
      };

      // Collect unique shows
      const showKey = showName.toLowerCase().trim();
      if (!seenShows.has(showKey)) {
        seenShows.add(showKey);
        shows.push({
          candidate,
          status: 'watching',
          addedAt: parseTVTimeDate(row['created_at']),
        });
      }

      episodes.push({
        showCandidate: candidate,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
        watchedAt: parseTVTimeDate(row['created_at'] || row['updated_at']),
      });
    }
  }

  // Parse movie tracking (tracking-prod-records.csv)
  const movieFile = files['tracking-prod-records.csv'];
  if (movieFile) {
    const rows = parseCSV(movieFile);
    for (const row of rows) {
      const movieName = row['movie_name'] || '';
      const type = row['type'] || '';

      if (!movieName || type !== 'watch') continue;

      const candidate: ImportShowCandidate = {
        title: movieName,
        mediaType: 'movie',
      };

      movies.push({
        candidate,
        status: 'watched',
        addedAt: parseTVTimeDate(row['created_at']),
        watchedAt: parseTVTimeDate(row['created_at']),
      });
    }
  }

  // Parse followed shows (followed_tv_show.csv) — adds shows not in watch history
  const followedFile = files['followed_tv_show.csv'];
  if (followedFile) {
    const rows = parseCSV(followedFile);
    for (const row of rows) {
      const showName = row['tv_show_name'] || row['name'] || '';
      if (!showName) continue;

      const showKey = showName.toLowerCase().trim();
      if (!seenShows.has(showKey)) {
        seenShows.add(showKey);
        shows.push({
          candidate: { title: showName, mediaType: 'tv' },
          status: 'watchlist',
          addedAt: parseTVTimeDate(row['created_at']),
        });
      }
    }
  }

  return { source: 'tvtime', shows, movies, episodes, ratings: [] };
}

// ==================== JSON ERA (2025+) ====================

// TV Time JSON format (approximate — format may vary)
interface TVTimeJsonItem {
  uuid?: string;
  type?: string; // 'episode', 'movie'
  meta?: {
    name?: string;
    show_name?: string;
    season_number?: number;
    episode_number?: number;
    first_release_date?: string;
  };
  watched_at?: string;
  created_at?: string;
}

interface TVTimeJsonRating {
  uuid?: string;
  type?: string;
  meta?: {
    name?: string;
    show_name?: string;
  };
  rating?: number;
  rated_at?: string;
}

/**
 * Parse TV Time JSON-era export (2025+).
 * Expects file contents as a map of filename → content string.
 */
export function parseTVTimeJSON(files: Record<string, string>): NormalizedImportData {
  const shows: ImportShowEntry[] = [];
  const movies: ImportMovieEntry[] = [];
  const episodes: ImportEpisodeEntry[] = [];
  const seenShows = new Set<string>();

  // Look for the watched/tracking JSON file
  for (const [filename, content] of Object.entries(files)) {
    if (!filename.endsWith('.json')) continue;

    let items: TVTimeJsonItem[];
    try {
      items = JSON.parse(content);
      if (!Array.isArray(items)) continue;
    } catch {
      continue;
    }

    for (const item of items) {
      const watchedAt = item.watched_at || item.created_at || new Date().toISOString();

      if (item.type === 'episode' && item.meta) {
        const showName = item.meta.show_name || item.meta.name || '';
        if (!showName) continue;

        const candidate: ImportShowCandidate = {
          title: showName,
          mediaType: 'tv',
        };

        // Collect unique shows
        const showKey = showName.toLowerCase().trim();
        if (!seenShows.has(showKey)) {
          seenShows.add(showKey);
          shows.push({
            candidate,
            status: 'watching',
            addedAt: watchedAt,
          });
        }

        if (item.meta.season_number != null && item.meta.episode_number != null && item.meta.episode_number >= 0) {
          episodes.push({
            showCandidate: candidate,
            seasonNumber: item.meta.season_number,
            episodeNumber: item.meta.episode_number,
            watchedAt,
          });
        }
      } else if (item.type === 'movie' && item.meta) {
        const movieName = item.meta.name || '';
        if (!movieName) continue;

        movies.push({
          candidate: { title: movieName, mediaType: 'movie' },
          status: 'watched',
          addedAt: watchedAt,
          watchedAt,
        });
      }
    }
  }

  return { source: 'tvtime', shows, movies, episodes, ratings: [] };
}

/**
 * Detect TV Time export format and parse accordingly.
 * @param files Map of filename → file content string (from ZIP extraction)
 */
export function parseTVTimeExport(files: Record<string, string>): NormalizedImportData {
  // Check for CSV files (old format)
  const hasCSV = Object.keys(files).some((name) => name.endsWith('.csv'));
  // Check for JSON files (new format)
  const hasJSON = Object.keys(files).some((name) => name.endsWith('.json'));

  if (hasCSV) {
    return parseTVTimeCSV(files);
  } else if (hasJSON) {
    return parseTVTimeJSON(files);
  }

  throw new Error(
    'Could not detect TV Time export format. Expected CSV files (pre-2025) or JSON files (2025+) in the ZIP.',
  );
}
