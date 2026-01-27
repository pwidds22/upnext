import * as SQLite from 'expo-sqlite';
import { TrackedShow, WatchedEpisode, ShowStatus, SyncStatus, SyncOperation, SyncQueueItem, EpisodeReaction, EpisodeReactionType } from '../types';

const DB_NAME = 'showbuddy.db';
const DEFAULT_SYNC_STATUS: SyncStatus = 'pending';

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

    // Migration: add sync columns to tracked_shows
    const syncColumns = [
      { name: 'sync_status', type: 'TEXT DEFAULT \'pending\'' },
      { name: 'remote_id', type: 'TEXT' },
      { name: 'last_synced_at', type: 'TEXT' },
    ];

    for (const col of syncColumns) {
      try {
        await this.db.runAsync(`ALTER TABLE tracked_shows ADD COLUMN ${col.name} ${col.type}`);
      } catch {
        // Column already exists, ignore error
      }
    }

    // Migration: add sync columns to watched_episodes
    for (const col of syncColumns) {
      try {
        await this.db.runAsync(`ALTER TABLE watched_episodes ADD COLUMN ${col.name} ${col.type}`);
      } catch {
        // Column already exists, ignore error
      }
    }

    // Create sync queue table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        UNIQUE(table_name, record_id, operation)
      );
    `);

    // Create episode reactions table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS episode_reactions (
        id TEXT PRIMARY KEY,
        show_tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        reaction TEXT NOT NULL CHECK (reaction IN ('good', 'meh', 'bad')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        remote_id TEXT,
        last_synced_at TEXT,
        UNIQUE(show_tmdb_id, season_number, episode_number)
      );

      CREATE INDEX IF NOT EXISTS idx_reactions_show ON episode_reactions(show_tmdb_id);
    `);
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
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
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
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
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
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
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
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
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
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
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
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    };
  }

  async addShow(show: TrackedShow): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO tracked_shows
       (tmdb_id, title, poster_path, status, added_at, total_seasons, total_episodes, aired_episodes, streaming_services, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        DEFAULT_SYNC_STATUS,
      ]
    );

    // Queue for sync
    await this.addToSyncQueue('tracked_shows', show.tmdbId.toString(), 'create', show);
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

    await this.db!.runAsync(
      'UPDATE tracked_shows SET status = ?, sync_status = ? WHERE tmdb_id = ?',
      [status, DEFAULT_SYNC_STATUS, tmdbId]
    );

    // Queue for sync
    await this.addToSyncQueue('tracked_shows', tmdbId.toString(), 'update', { tmdbId, status });
  }

  async deleteShow(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Queue for sync before deleting locally
    await this.addToSyncQueue('tracked_shows', tmdbId.toString(), 'delete', { tmdbId });

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
       (id, show_tmdb_id, season_number, episode_number, watched_at, episode_title, still_path, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        episode.showTmdbId,
        episode.seasonNumber,
        episode.episodeNumber,
        episode.watchedAt,
        episode.episodeTitle ?? null,
        episode.stillPath ?? null,
        DEFAULT_SYNC_STATUS,
      ]
    );

    // Queue for sync
    await this.addToSyncQueue('watched_episodes', id, 'create', { ...episode, id });
  }

  async markEpisodeUnwatched(showTmdbId: number, season: number, episode: number): Promise<void> {
    if (!this.db) await this.init();

    const id = `${showTmdbId}-${season}-${episode}`;

    // Queue for sync before deleting locally
    await this.addToSyncQueue('watched_episodes', id, 'delete', { showTmdbId, season, episode });

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

  // Sync Queue Operations
  async addToSyncQueue(
    tableName: string,
    recordId: string,
    operation: SyncOperation,
    payload: unknown
  ): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, operation, JSON.stringify(payload), new Date().toISOString()]
    );
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: number;
      table_name: string;
      record_id: string;
      operation: SyncOperation;
      payload: string;
      created_at: string;
      attempts: number;
      last_error: string | null;
    }>('SELECT * FROM sync_queue ORDER BY created_at ASC');

    return rows.map((row) => ({
      id: row.id,
      tableName: row.table_name,
      recordId: row.record_id,
      operation: row.operation,
      payload: row.payload,
      createdAt: row.created_at,
      attempts: row.attempts,
      lastError: row.last_error ?? undefined,
    }));
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async updateSyncQueueItemError(id: number, error: string): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
      [error, id]
    );
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync('DELETE FROM sync_queue');
  }

  async getSyncQueueCount(): Promise<number> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue'
    );

    return row?.count ?? 0;
  }

  // Update sync status for a show
  async updateShowSyncStatus(
    tmdbId: number,
    syncStatus: SyncStatus,
    remoteId?: string
  ): Promise<void> {
    if (!this.db) await this.init();

    const now = new Date().toISOString();
    await this.db!.runAsync(
      `UPDATE tracked_shows
       SET sync_status = ?, remote_id = COALESCE(?, remote_id), last_synced_at = ?
       WHERE tmdb_id = ?`,
      [syncStatus, remoteId ?? null, now, tmdbId]
    );
  }

  // Get all pending sync shows
  async getPendingSyncShows(): Promise<TrackedShow[]> {
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
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
    }>('SELECT * FROM tracked_shows WHERE sync_status = ? OR sync_status IS NULL', [DEFAULT_SYNC_STATUS]);

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
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    }));
  }

  // Episode Reactions
  async getReactionsForShow(showTmdbId: number): Promise<EpisodeReaction[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      reaction: EpisodeReactionType;
      created_at: string;
      updated_at: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
    }>('SELECT * FROM episode_reactions WHERE show_tmdb_id = ?', [showTmdbId]);

    return rows.map((row) => ({
      id: row.id,
      showTmdbId: row.show_tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      reaction: row.reaction,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    }));
  }

  async getReaction(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeReaction | null> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      reaction: EpisodeReactionType;
      created_at: string;
      updated_at: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
    }>(
      'SELECT * FROM episode_reactions WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
      [showTmdbId, seasonNumber, episodeNumber]
    );

    if (!row) return null;

    return {
      id: row.id,
      showTmdbId: row.show_tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      reaction: row.reaction,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    };
  }

  async setReaction(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    reaction: EpisodeReactionType
  ): Promise<void> {
    if (!this.db) await this.init();

    const id = `${showTmdbId}-${seasonNumber}-${episodeNumber}-reaction`;
    const now = new Date().toISOString();

    await this.db!.runAsync(
      `INSERT INTO episode_reactions
       (id, show_tmdb_id, season_number, episode_number, reaction, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(show_tmdb_id, season_number, episode_number)
       DO UPDATE SET reaction = ?, updated_at = ?, sync_status = ?`,
      [
        id,
        showTmdbId,
        seasonNumber,
        episodeNumber,
        reaction,
        now,
        now,
        DEFAULT_SYNC_STATUS,
        reaction,
        now,
        DEFAULT_SYNC_STATUS,
      ]
    );

    // Queue for sync
    await this.addToSyncQueue('episode_reactions', id, 'create', {
      id,
      showTmdbId,
      seasonNumber,
      episodeNumber,
      reaction,
      createdAt: now,
      updatedAt: now,
    });
  }

  async removeReaction(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    if (!this.db) await this.init();

    const id = `${showTmdbId}-${seasonNumber}-${episodeNumber}-reaction`;

    // Queue for sync before deleting locally
    await this.addToSyncQueue('episode_reactions', id, 'delete', {
      showTmdbId,
      seasonNumber,
      episodeNumber,
    });

    await this.db!.runAsync(
      'DELETE FROM episode_reactions WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
      [showTmdbId, seasonNumber, episodeNumber]
    );
  }

  async deleteReactionsForShow(showTmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Queue each reaction for sync deletion
    const reactions = await this.getReactionsForShow(showTmdbId);
    for (const reaction of reactions) {
      await this.addToSyncQueue('episode_reactions', reaction.id, 'delete', {
        showTmdbId: reaction.showTmdbId,
        seasonNumber: reaction.seasonNumber,
        episodeNumber: reaction.episodeNumber,
      });
    }

    await this.db!.runAsync('DELETE FROM episode_reactions WHERE show_tmdb_id = ?', [showTmdbId]);
  }
}

export const storageService = new StorageService();
