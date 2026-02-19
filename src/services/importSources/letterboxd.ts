import {
  NormalizedImportData,
  ImportMovieEntry,
  ImportRatingEntry,
  ImportShowCandidate,
} from '../../types';
import { normalizeRating } from '../import';

/**
 * Parse Letterboxd CSV export.
 * Letterboxd exports a ZIP containing multiple CSVs:
 *   - diary.csv: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
 *   - ratings.csv: Date, Name, Year, Letterboxd URI, Rating
 *   - watched.csv: Date, Name, Year, Letterboxd URI
 *   - watchlist.csv: Date, Name, Year, Letterboxd URI
 *
 * IMPORTANT: Letterboxd exports contain ZERO TMDB or IMDB IDs.
 * Movies are identified by Name + Year only, requiring title-based TMDB search.
 * Letterboxd is movies-only — no TV show data.
 */

interface LetterboxdRow {
  [key: string]: string | undefined;
}

// Parse CSV string into rows
function parseCSV(csvString: string): LetterboxdRow[] {
  const lines = csvString.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0].trim());
  const rows: LetterboxdRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: LetterboxdRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

// Validate YYYY-MM-DD format and convert to ISO timestamp
function toISODate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T00:00:00.000Z`;
  }
  return undefined;
}

function makeCandidate(name: string, year: string | undefined): ImportShowCandidate {
  return {
    title: name,
    year: year ? parseInt(year, 10) : undefined,
    mediaType: 'movie',
    // No IDs available from Letterboxd export
  };
}

/**
 * Parse Letterboxd export files.
 * @param files Map of filename → file content string (from ZIP extraction)
 */
export function parseLetterboxdExport(files: Record<string, string>): NormalizedImportData {
  const movies: ImportMovieEntry[] = [];
  const ratings: ImportRatingEntry[] = [];
  const seenMovies = new Set<string>(); // "title::year" dedup

  // 1. Parse diary.csv (richest data — has watched dates, ratings, rewatch flag)
  const diaryContent = files['diary.csv'];
  if (diaryContent) {
    const rows = parseCSV(diaryContent);
    for (const row of rows) {
      const name = row['Name'] || '';
      const year = row['Year'];
      const watchedDate = row['Watched Date'] || row['Date'] || '';
      const rating = row['Rating'];
      const rewatch = row['Rewatch']?.toLowerCase() === 'yes';

      if (!name) continue;

      const key = `${name.toLowerCase()}::${year ?? ''}`;
      const candidate = makeCandidate(name, year);

      if (!seenMovies.has(key)) {
        seenMovies.add(key);
        movies.push({
          candidate,
          status: 'watched',
          addedAt: toISODate(watchedDate) ?? new Date().toISOString(),
          watchedAt: toISODate(watchedDate),
        });
      }

      // Letterboxd ratings: 0.5 to 5.0 in half-star increments
      if (rating) {
        const ratingNum = parseFloat(rating);
        if (!isNaN(ratingNum) && ratingNum > 0) {
          ratings.push({
            candidate,
            ratingType: 'movie',
            rating: normalizeRating(ratingNum, 5), // Convert 0.5-5 to 0-10
          });
        }
      }
    }
  }

  // 2. Parse watched.csv (for movies not in diary)
  const watchedContent = files['watched.csv'];
  if (watchedContent) {
    const rows = parseCSV(watchedContent);
    for (const row of rows) {
      const name = row['Name'] || '';
      const year = row['Year'];
      const date = row['Date'] || '';

      if (!name) continue;

      const key = `${name.toLowerCase()}::${year ?? ''}`;
      if (seenMovies.has(key)) continue; // Already from diary
      seenMovies.add(key);

      movies.push({
        candidate: makeCandidate(name, year),
        status: 'watched',
        addedAt: toISODate(date) ?? new Date().toISOString(),
      });
    }
  }

  // 3. Parse watchlist.csv
  const watchlistContent = files['watchlist.csv'];
  if (watchlistContent) {
    const rows = parseCSV(watchlistContent);
    for (const row of rows) {
      const name = row['Name'] || '';
      const year = row['Year'];
      const date = row['Date'] || '';

      if (!name) continue;

      const key = `${name.toLowerCase()}::${year ?? ''}`;
      if (seenMovies.has(key)) continue;
      seenMovies.add(key);

      movies.push({
        candidate: makeCandidate(name, year),
        status: 'watchlist',
        addedAt: toISODate(date) ?? new Date().toISOString(),
      });
    }
  }

  // 4. Parse ratings.csv (for ratings not already captured from diary)
  const ratingsContent = files['ratings.csv'];
  if (ratingsContent) {
    const rows = parseCSV(ratingsContent);
    const ratedMovies = new Set(ratings.map((r) => `${r.candidate.title.toLowerCase()}::${r.candidate.year ?? ''}`));

    for (const row of rows) {
      const name = row['Name'] || '';
      const year = row['Year'];
      const rating = row['Rating'];

      if (!name || !rating) continue;

      const key = `${name.toLowerCase()}::${year ?? ''}`;
      if (ratedMovies.has(key)) continue; // Already have rating from diary

      const ratingNum = parseFloat(rating);
      if (!isNaN(ratingNum) && ratingNum > 0) {
        ratings.push({
          candidate: makeCandidate(name, year),
          ratingType: 'movie',
          rating: normalizeRating(ratingNum, 5),
        });
      }
    }
  }

  return {
    source: 'letterboxd',
    shows: [], // Letterboxd is movies only
    movies,
    episodes: [], // No TV episode data
    ratings,
  };
}
