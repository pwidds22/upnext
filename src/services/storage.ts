import * as SQLite from 'expo-sqlite';
import { TrackedShow, WatchedEpisode, ShowStatus } from '../types';

const DB_NAME = 'showbuddy.db';

class StorageService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);

    // Create tables
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS tracked_shows (
        tmdb_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        poster_path TEXT,
        status TEXT NOT NULL DEFAULT 'watching',
        added_at TEXT NOT NULL,
        total_seasons INTEGER DEFAULT 0,
        total_episodes INTEGER DEFAULT 0,
        aired_episodes INTEGER,
        streaming_services TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS watched_episodes (
        id TEXT PRIMARY KEY,
        show_tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        watched_at TEXT NOT NULL,
        episode_title TEXT,
        still_path TEXT,
        FOREIGN KEY (show_tmdb_id) REFERENCES tracked_shows(tmdb_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_watched_show ON watched_episodes(show_tmdb_id);
    `);

    // Migration: add aired_episodes column if it doesn't exist
    try {
      await this.db.runAsync('ALTER TABLE tracked_shows ADD COLUMN aired_episodes INTEGER');
    } catch {
      // Column already exists, ignore error
    }
  }

  // Tracked Shows
  async getAllShows(): Promise<TrackedShow[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: ShowStatus;
      added_at: string;
      total_seasons: number;
      total_episodes: number;
      aired_episodes: number | null;
      streaming_services: string;
    }>('SELECT * FROM tracked_shows ORDER BY added_at DESC');

    return rows.map((row) => ({
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      totalSeasons: row.total_seasons,
      totalEpisodes: row.total_episodes,
      airedEpisodes: row.aired_episodes ?? undefined,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
    }));
  }

  async getShowsByStatus(status: ShowStatus): Promise<TrackedShow[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: ShowStatus;
      added_at: string;
      total_seasons: number;
      total_episodes: number;
      aired_episodes: number | null;
      streaming_services: string;
    }>('SELECT * FROM tracked_shows WHERE status = ? ORDER BY added_at DESC', [status]);

    return rows.map((row) => ({
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      totalSeasons: row.total_seasons,
      totalEpisodes: row.total_episodes,
      airedEpisodes: row.aired_episodes ?? undefined,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
    }));
  }

  async getShow(tmdbId: number): Promise<TrackedShow | null> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: ShowStatus;
      added_at: string;
      total_seasons: number;
      total_episodes: number;
      aired_episodes: number | null;
      streaming_services: string;
    }>('SELECT * FROM tracked_shows WHERE tmdb_id = ?', [tmdbId]);

    if (!row) return null;

    return {
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      totalSeasons: row.total_seasons,
      totalEpisodes: row.total_episodes,
      airedEpisodes: row.aired_episodes ?? undefined,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
    };
  }

  async addShow(show: TrackedShow): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO tracked_shows
       (tmdb_id, title, poster_path, status, added_at, total_seasons, total_episodes, aired_episodes, streaming_services)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        show.tmdbId,
        show.title,
        show.posterPath,
        show.status,
        show.addedAt,
        show.totalSeasons,
        show.totalEpisodes,
        show.airedEpisodes ?? null,
        JSON.stringify(show.streamingServices),
      ]
    );
  }

  async updateAiredEpisodes(tmdbId: number, airedEpisodes: number): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync('UPDATE tracked_shows SET aired_episodes = ? WHERE tmdb_id = ?', [
      airedEpisodes,
      tmdbId,
    ]);
  }

  async updateShowStatus(tmdbId: number, status: ShowStatus): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync('UPDATE tracked_shows SET status = ? WHERE tmdb_id = ?', [
      status,
      tmdbId,
    ]);
  }

  async deleteShow(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync('DELETE FROM tracked_shows WHERE tmdb_id = ?', [tmdbId]);
    await this.db!.runAsync('DELETE FROM watched_episodes WHERE show_tmdb_id = ?', [tmdbId]);
  }

  async isShowTracked(tmdbId: number): Promise<boolean> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM tracked_shows WHERE tmdb_id = ?',
      [tmdbId]
    );

    return (row?.count ?? 0) > 0;
  }

  // Watched Episodes
  async getWatchedEpisodes(showTmdbId: number): Promise<WatchedEpisode[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      watched_at: string;
      episode_title: string | null;
      still_path: string | null;
    }>('SELECT * FROM watched_episodes WHERE show_tmdb_id = ? ORDER BY season_number, episode_number', [
      showTmdbId,
    ]);

    return rows.map((row) => ({
      id: row.id,
      showTmdbId: row.show_tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      watchedAt: row.watched_at,
      episodeTitle: row.episode_title ?? undefined,
      stillPath: row.still_path ?? undefined,
    }));
  }

  async isEpisodeWatched(showTmdbId: number, season: number, episode: number): Promise<boolean> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
      [showTmdbId, season, episode]
    );

    return (row?.count ?? 0) > 0;
  }

  async markEpisodeWatched(episode: Omit<WatchedEpisode, 'id'>): Promise<void> {
    if (!this.db) await this.init();

    const id = `${episode.showTmdbId}-${episode.seasonNumber}-${episode.episodeNumber}`;

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO watched_episodes
       (id, show_tmdb_id, season_number, episode_number, watched_at, episode_title, still_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        episode.showTmdbId,
        episode.seasonNumber,
        episode.episodeNumber,
        episode.watchedAt,
        episode.episodeTitle ?? null,
        episode.stillPath ?? null,
      ]
    );
  }

  async markEpisodeUnwatched(showTmdbId: number, season: number, episode: number): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      'DELETE FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
      [showTmdbId, season, episode]
    );
  }

  async markSeasonWatched(
    showTmdbId: number,
    seasonNumber: number,
    episodes: Array<{ episodeNumber: number; name: string | null; stillPath: string | null }>
  ): Promise<void> {
    if (!this.db) await this.init();

    const now = new Date().toISOString();

    for (const ep of episodes) {
      await this.markEpisodeWatched({
        showTmdbId,
        seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: now,
        episodeTitle: ep.name ?? undefined,
        stillPath: ep.stillPath ?? undefined,
      });
    }
  }

  async markSeasonUnwatched(showTmdbId: number, seasonNumber: number): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      'DELETE FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ?',
      [showTmdbId, seasonNumber]
    );
  }

  async getWatchedCount(showTmdbId: number): Promise<number> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM watched_episodes WHERE show_tmdb_id = ?',
      [showTmdbId]
    );

    return row?.count ?? 0;
  }

  async getWatchedCountForSeason(showTmdbId: number, seasonNumber: number): Promise<number> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ?',
      [showTmdbId, seasonNumber]
    );

    return row?.count ?? 0;
  }
}

export const storageService = new StorageService();
