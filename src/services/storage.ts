import * as SQLite from 'expo-sqlite';
import { TrackedShow, TrackedMovie, TrackedMedia, WatchedEpisode, ShowStatus, MovieStatus, SyncStatus, SyncOperation, SyncQueueItem, EpisodeReaction, EpisodeReactionType, MediaType, EpisodeWatchHistory, MovieWatchHistory, WatchHistorySummary } from '../types';

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

    // Create dismissed shows table (for hiding recommendations)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dismissed_shows (
        id TEXT PRIMARY KEY,
        tmdb_id INTEGER NOT NULL UNIQUE,
        dismissed_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        remote_id TEXT,
        last_synced_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_dismissed_tmdb ON dismissed_shows(tmdb_id);
    `);

    // Create dismissed movies table (for hiding movie recommendations)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dismissed_movies (
        id TEXT PRIMARY KEY,
        tmdb_id INTEGER NOT NULL UNIQUE,
        dismissed_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        remote_id TEXT,
        last_synced_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_dismissed_movie_tmdb ON dismissed_movies(tmdb_id);
    `);

    // Create episode watch history table (for rewatch tracking)
    // Unlike watched_episodes, this table allows multiple entries per episode
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS episode_watch_history (
        id TEXT PRIMARY KEY,
        show_tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        watched_at TEXT NOT NULL,
        episode_title TEXT,
        sync_status TEXT DEFAULT 'pending',
        remote_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_episode_watch_history ON episode_watch_history(show_tmdb_id, season_number, episode_number);
    `);

    // Create movie watch history table (for rewatch tracking)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS movie_watch_history (
        id TEXT PRIMARY KEY,
        movie_tmdb_id INTEGER NOT NULL,
        watched_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        remote_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_movie_watch_history ON movie_watch_history(movie_tmdb_id);
    `);

    // Migration: add movie support columns to tracked_shows
    const movieColumns = [
      { name: 'media_type', type: "TEXT DEFAULT 'tv'" },
      { name: 'release_date', type: 'TEXT' },
      { name: 'runtime', type: 'INTEGER' },
    ];

    for (const col of movieColumns) {
      try {
        await this.db.runAsync(`ALTER TABLE tracked_shows ADD COLUMN ${col.name} ${col.type}`);
      } catch {
        // Column already exists, ignore error
      }
    }

    // Migration: add unique constraint on (tmdb_id, media_type) for movies/shows with same ID
    // This allows both a movie and TV show to have the same TMDB ID (since TMDB uses separate ID spaces)
    try {
      await this.db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tmdb_media_type ON tracked_shows(tmdb_id, media_type)`);
    } catch {
      // Index already exists, ignore error
    }

    // Bug #22 fix: Deduplicate episode/movie watch history
    // Duplicates were created by sync pulling back records and re-inserting with new IDs
    await this.deduplicateWatchHistory();
  }

  // Remove duplicate watch history records (keeps the oldest record per unique watch)
  private async deduplicateWatchHistory(): Promise<void> {
    if (!this.db) return;

    // Deduplicate episode watch history: keep oldest record per (show, season, episode, watched_at)
    const epDupes = await this.db.runAsync(`
      DELETE FROM episode_watch_history
      WHERE id NOT IN (
        SELECT MIN(id) FROM episode_watch_history
        GROUP BY show_tmdb_id, season_number, episode_number, watched_at
      )
    `);
    if (epDupes.changes > 0) {
      console.log(`[Storage] Cleaned up ${epDupes.changes} duplicate episode watch history records`);
    }

    // Deduplicate movie watch history: keep oldest record per (movie, watched_at)
    const movieDupes = await this.db.runAsync(`
      DELETE FROM movie_watch_history
      WHERE id NOT IN (
        SELECT MIN(id) FROM movie_watch_history
        GROUP BY movie_tmdb_id, watched_at
      )
    `);
    if (movieDupes.changes > 0) {
      console.log(`[Storage] Cleaned up ${movieDupes.changes} duplicate movie watch history records`);
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
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
      media_type: MediaType | null;
    }>("SELECT * FROM tracked_shows WHERE media_type = 'tv' OR media_type IS NULL ORDER BY added_at DESC");

    return rows.map((row) => ({
      mediaType: 'tv' as const,
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
    }>("SELECT * FROM tracked_shows WHERE status = ? AND (media_type = 'tv' OR media_type IS NULL) ORDER BY added_at DESC", [status]);

    return rows.map((row) => ({
      mediaType: 'tv' as const,
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
    }>("SELECT * FROM tracked_shows WHERE tmdb_id = ? AND (media_type = 'tv' OR media_type IS NULL)", [tmdbId]);

    if (!row) return null;

    return {
      mediaType: 'tv' as const,
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

    // Track if operation succeeded (for sync queue)
    let added = false;

    // Helper to perform the update
    const doUpdate = async () => {
      await this.db!.runAsync(
        `UPDATE tracked_shows SET
           title = ?, poster_path = ?, status = ?, total_seasons = ?, total_episodes = ?,
           aired_episodes = ?, streaming_services = ?, sync_status = ?, media_type = 'tv'
         WHERE tmdb_id = ? AND (media_type = 'tv' OR media_type IS NULL)`,
        [
          show.title,
          show.posterPath,
          show.status,
          show.totalSeasons,
          show.totalEpisodes,
          show.airedEpisodes ?? null,
          JSON.stringify(show.streamingServices),
          DEFAULT_SYNC_STATUS,
          show.tmdbId,
        ]
      );
    };

    // Use transaction for atomic check-then-insert/update to prevent race conditions
    await this.db!.withTransactionAsync(async () => {
      // Check for ANY existing row with this tmdb_id (regardless of media_type)
      // This prevents PRIMARY KEY constraint violation when movie has same ID
      const existing = await this.db!.getFirstAsync<{ tmdb_id: number; media_type: string | null }>(
        "SELECT tmdb_id, media_type FROM tracked_shows WHERE tmdb_id = ?",
        [show.tmdbId]
      );

      if (existing) {
        if (existing.media_type === 'tv' || existing.media_type === null) {
          // Update existing TV show
          await doUpdate();
          added = true;
        } else {
          // A movie with this TMDB ID already exists - can't add TV show with same ID
          // This is rare (TMDB IDs don't usually overlap) but possible
          console.warn(`Cannot add TV show ${show.tmdbId}: a movie with this TMDB ID already exists`);
          // added remains false - don't queue for sync
        }
      } else {
        await this.db!.runAsync(
          `INSERT INTO tracked_shows
           (tmdb_id, title, poster_path, status, added_at, total_seasons, total_episodes, aired_episodes, streaming_services, sync_status, media_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tv')`,
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
        added = true;
      }
    });

    // Only queue for sync if operation succeeded
    if (!added) return;
    await this.addToSyncQueue('tracked_shows', show.tmdbId.toString(), 'create', { ...show, mediaType: 'tv' });
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

    // Queue show for sync before deleting locally
    await this.addToSyncQueue('tracked_shows', tmdbId.toString(), 'delete', { tmdbId });

    // Delete all related data with proper sync queueing
    await this.deleteWatchedEpisodesForShow(tmdbId);
    await this.deleteReactionsForShow(tmdbId);
    await this.deleteShowWatchHistory(tmdbId);

    // Finally delete the show itself
    await this.db!.runAsync('DELETE FROM tracked_shows WHERE tmdb_id = ?', [tmdbId]);
  }

  async deleteWatchedEpisodesForShow(showTmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Get all watched episodes for this show (use DISTINCT since we queue by episode, not by row)
    const rows = await this.db!.getAllAsync<{ season_number: number; episode_number: number }>(
      'SELECT DISTINCT season_number, episode_number FROM watched_episodes WHERE show_tmdb_id = ?',
      [showTmdbId]
    );

    // Queue each episode for sync deletion
    for (const row of rows) {
      const id = `${showTmdbId}-${row.season_number}-${row.episode_number}`;
      await this.addToSyncQueue('watched_episodes', id, 'delete', {
        showTmdbId,
        season: row.season_number,
        episode: row.episode_number,
      });
    }

    // Then delete locally
    await this.db!.runAsync('DELETE FROM watched_episodes WHERE show_tmdb_id = ?', [showTmdbId]);
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

    await this.db!.withTransactionAsync(async () => {
      // Check if episode is already marked as watched
      const existing = await this.db!.getFirstAsync<{ id: string }>(
        'SELECT id FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
        [episode.showTmdbId, episode.seasonNumber, episode.episodeNumber]
      );

      if (existing) {
        // Episode already watched - update metadata if provided
        await this.db!.runAsync(
          `UPDATE watched_episodes
           SET watched_at = ?, episode_title = COALESCE(?, episode_title), still_path = COALESCE(?, still_path), sync_status = ?
           WHERE id = ?`,
          [
            episode.watchedAt,
            episode.episodeTitle ?? null,
            episode.stillPath ?? null,
            DEFAULT_SYNC_STATUS,
            existing.id,
          ]
        );
        await this._addToSyncQueueRaw('watched_episodes', existing.id, 'update', { ...episode, id: existing.id });
        return;
      }

      // Insert new watched episode entry
      await this.db!.runAsync(
        `INSERT INTO watched_episodes
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
      await this._addToSyncQueueRaw('watched_episodes', id, 'create', { ...episode, id });
    });
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

    await this.db!.withTransactionAsync(async () => {
      for (const ep of episodes) {
        const id = `${showTmdbId}-${seasonNumber}-${ep.episodeNumber}`;
        const episodeTitle = ep.name ?? null;
        const stillPath = ep.stillPath ?? null;

        const existing = await this.db!.getFirstAsync<{ id: string }>(
          'SELECT id FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?',
          [showTmdbId, seasonNumber, ep.episodeNumber]
        );

        if (existing) {
          await this.db!.runAsync(
            `UPDATE watched_episodes
             SET watched_at = ?, episode_title = COALESCE(?, episode_title), still_path = COALESCE(?, still_path), sync_status = ?
             WHERE id = ?`,
            [now, episodeTitle, stillPath, DEFAULT_SYNC_STATUS, existing.id]
          );
          await this._addToSyncQueueRaw('watched_episodes', existing.id, 'update', {
            showTmdbId, seasonNumber, episodeNumber: ep.episodeNumber, watchedAt: now,
            episodeTitle: ep.name ?? undefined, stillPath: ep.stillPath ?? undefined, id: existing.id,
          });
        } else {
          await this.db!.runAsync(
            `INSERT INTO watched_episodes
             (id, show_tmdb_id, season_number, episode_number, watched_at, episode_title, still_path, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, showTmdbId, seasonNumber, ep.episodeNumber, now, episodeTitle, stillPath, DEFAULT_SYNC_STATUS]
          );
          await this._addToSyncQueueRaw('watched_episodes', id, 'create', {
            showTmdbId, seasonNumber, episodeNumber: ep.episodeNumber, watchedAt: now,
            episodeTitle: ep.name ?? undefined, stillPath: ep.stillPath ?? undefined, id,
          });
        }
      }
    });
  }

  async markSeasonUnwatched(showTmdbId: number, seasonNumber: number): Promise<void> {
    if (!this.db) await this.init();

    // Query episodes first to queue for sync deletion
    const rows = await this.db!.getAllAsync<{ episode_number: number }>(
      'SELECT DISTINCT episode_number FROM watched_episodes WHERE show_tmdb_id = ? AND season_number = ?',
      [showTmdbId, seasonNumber]
    );

    for (const row of rows) {
      const id = `${showTmdbId}-${seasonNumber}-${row.episode_number}`;
      await this.addToSyncQueue('watched_episodes', id, 'delete', {
        showTmdbId,
        season: seasonNumber,
        episode: row.episode_number,
      });
    }

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

  // Raw sync queue logic without transaction wrapper.
  // Use this inside an existing withTransactionAsync to avoid nesting.
  private async _addToSyncQueueRaw(
    tableName: string,
    recordId: string,
    operation: SyncOperation,
    payload: unknown
  ): Promise<void> {
    const existing = await this.db!.getFirstAsync<{ id: number }>(
      'SELECT id FROM sync_queue WHERE table_name = ? AND record_id = ? AND operation = ?',
      [tableName, recordId, operation]
    );

    if (existing) {
      await this.db!.runAsync(
        'UPDATE sync_queue SET payload = ? WHERE id = ?',
        [JSON.stringify(payload), existing.id]
      );
    } else {
      await this.db!.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tableName, recordId, operation, JSON.stringify(payload), new Date().toISOString()]
      );
    }
  }

  async addToSyncQueue(
    tableName: string,
    recordId: string,
    operation: SyncOperation,
    payload: unknown
  ): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.withTransactionAsync(async () => {
      await this._addToSyncQueueRaw(tableName, recordId, operation, payload);
    });
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

  async removeSyncQueueItemByKey(tableName: string, recordId: string, operation: string): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      'DELETE FROM sync_queue WHERE table_name = ? AND record_id = ? AND operation = ?',
      [tableName, recordId, operation]
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

  // Update sync status for a show or movie
  async updateShowSyncStatus(
    tmdbId: number,
    syncStatus: SyncStatus,
    remoteId?: string
  ): Promise<void> {
    if (!this.db) await this.init();

    const now = new Date().toISOString();
    // Note: tmdb_id is PRIMARY KEY so at most one row matches locally.
    // The media_type filter is not needed since the PK enforces uniqueness.
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
    }>("SELECT * FROM tracked_shows WHERE (sync_status = ? OR sync_status IS NULL) AND (media_type = 'tv' OR media_type IS NULL)", [DEFAULT_SYNC_STATUS]);

    return rows.map((row) => ({
      mediaType: 'tv' as const,
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

    await this.db!.withTransactionAsync(async () => {
      // Check if reaction already exists
      const existing = await this.db!.getFirstAsync<{ id: string }>(
        `SELECT id FROM episode_reactions
         WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?`,
        [showTmdbId, seasonNumber, episodeNumber]
      );

      if (existing) {
        // UPDATE existing reaction
        await this.db!.runAsync(
          `UPDATE episode_reactions
           SET reaction = ?, updated_at = ?, sync_status = ?
           WHERE id = ?`,
          [reaction, now, DEFAULT_SYNC_STATUS, existing.id]
        );

        // Queue for sync as update
        await this._addToSyncQueueRaw('episode_reactions', existing.id, 'update', {
          id: existing.id,
          showTmdbId,
          seasonNumber,
          episodeNumber,
          reaction,
          updatedAt: now,
        });
      } else {
        // INSERT new reaction
        await this.db!.runAsync(
          `INSERT INTO episode_reactions
           (id, show_tmdb_id, season_number, episode_number, reaction, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, showTmdbId, seasonNumber, episodeNumber, reaction, now, now, DEFAULT_SYNC_STATUS]
        );

        // Queue for sync as create
        await this._addToSyncQueueRaw('episode_reactions', id, 'create', {
          id,
          showTmdbId,
          seasonNumber,
          episodeNumber,
          reaction,
          createdAt: now,
          updatedAt: now,
        });
      }
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

  // Dismissed Shows (for hiding recommendations)
  // Auto-expires dismissals older than 90 days so users get fresh recommendations
  async getDismissedShowIds(): Promise<Set<number>> {
    if (!this.db) await this.init();

    // Only return dismissals from the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString();

    const rows = await this.db!.getAllAsync<{ tmdb_id: number }>(
      'SELECT tmdb_id FROM dismissed_shows WHERE dismissed_at > ?',
      [cutoffDate]
    );

    return new Set(rows.map((row) => row.tmdb_id));
  }

  async dismissShow(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    const id = `dismissed-${tmdbId}`;
    const now = new Date().toISOString();

    await this.db!.withTransactionAsync(async () => {
      // Check if show is already dismissed
      const existing = await this.db!.getFirstAsync<{ id: string }>(
        'SELECT id FROM dismissed_shows WHERE tmdb_id = ?',
        [tmdbId]
      );

      if (existing) {
        // Update dismissed_at to refresh the 90-day window
        await this.db!.runAsync(
          'UPDATE dismissed_shows SET dismissed_at = ?, sync_status = ? WHERE tmdb_id = ?',
          [now, DEFAULT_SYNC_STATUS, tmdbId]
        );
        // Queue sync for update
        await this._addToSyncQueueRaw('dismissed_shows', existing.id, 'update', {
          id: existing.id,
          tmdbId,
          dismissedAt: now,
        });
        return;
      }

      // Insert new dismissed show
      await this.db!.runAsync(
        `INSERT INTO dismissed_shows
         (id, tmdb_id, dismissed_at, sync_status)
         VALUES (?, ?, ?, ?)`,
        [id, tmdbId, now, DEFAULT_SYNC_STATUS]
      );

      // Queue for sync
      await this._addToSyncQueueRaw('dismissed_shows', id, 'create', {
        id,
        tmdbId,
        dismissedAt: now,
      });
    });
  }

  async undismissShow(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    const id = `dismissed-${tmdbId}`;

    // Queue for sync before deleting locally
    await this.addToSyncQueue('dismissed_shows', id, 'delete', { tmdbId });

    await this.db!.runAsync('DELETE FROM dismissed_shows WHERE tmdb_id = ?', [tmdbId]);
  }

  async isShowDismissed(tmdbId: number): Promise<boolean> {
    if (!this.db) await this.init();

    // Respect 90-day expiry to match getDismissedShowIds()
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM dismissed_shows WHERE tmdb_id = ? AND dismissed_at > ?',
      [tmdbId, cutoffDate]
    );

    return (row?.count ?? 0) > 0;
  }

  // ==================== DISMISSED MOVIES ====================

  // Auto-expires dismissals older than 90 days so users get fresh recommendations
  async getDismissedMovieIds(): Promise<Set<number>> {
    if (!this.db) await this.init();

    // Only return dismissals from the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString();

    const rows = await this.db!.getAllAsync<{ tmdb_id: number }>(
      'SELECT tmdb_id FROM dismissed_movies WHERE dismissed_at > ?',
      [cutoffDate]
    );

    return new Set(rows.map((row) => row.tmdb_id));
  }

  async dismissMovie(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    const id = `dismissed-movie-${tmdbId}`;
    const now = new Date().toISOString();

    await this.db!.withTransactionAsync(async () => {
      // Check if movie is already dismissed
      const existing = await this.db!.getFirstAsync<{ id: string }>(
        'SELECT id FROM dismissed_movies WHERE tmdb_id = ?',
        [tmdbId]
      );

      if (existing) {
        // Update dismissed_at to refresh the 90-day window
        await this.db!.runAsync(
          'UPDATE dismissed_movies SET dismissed_at = ?, sync_status = ? WHERE tmdb_id = ?',
          [now, DEFAULT_SYNC_STATUS, tmdbId]
        );
        // Queue sync for update
        await this._addToSyncQueueRaw('dismissed_movies', existing.id, 'update', {
          id: existing.id,
          tmdbId,
          dismissedAt: now,
        });
        return;
      }

      // Insert new dismissed movie
      await this.db!.runAsync(
        `INSERT INTO dismissed_movies
         (id, tmdb_id, dismissed_at, sync_status)
         VALUES (?, ?, ?, ?)`,
        [id, tmdbId, now, DEFAULT_SYNC_STATUS]
      );

      // Queue for sync
      await this._addToSyncQueueRaw('dismissed_movies', id, 'create', {
        id,
        tmdbId,
        dismissedAt: now,
      });
    });
  }

  // ==================== MOVIE METHODS ====================

  async getAllMovies(): Promise<TrackedMovie[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: MovieStatus;
      added_at: string;
      streaming_services: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
      release_date: string | null;
      runtime: number | null;
    }>("SELECT * FROM tracked_shows WHERE media_type = 'movie' ORDER BY added_at DESC");

    return rows.map((row) => ({
      mediaType: 'movie' as const,
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      releaseDate: row.release_date,
      runtime: row.runtime,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    }));
  }

  async getMoviesByStatus(status: MovieStatus): Promise<TrackedMovie[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: MovieStatus;
      added_at: string;
      streaming_services: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
      release_date: string | null;
      runtime: number | null;
    }>("SELECT * FROM tracked_shows WHERE status = ? AND media_type = 'movie' ORDER BY added_at DESC", [status]);

    return rows.map((row) => ({
      mediaType: 'movie' as const,
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      releaseDate: row.release_date,
      runtime: row.runtime,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    }));
  }

  async getMovie(tmdbId: number): Promise<TrackedMovie | null> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: MovieStatus;
      added_at: string;
      streaming_services: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
      release_date: string | null;
      runtime: number | null;
    }>("SELECT * FROM tracked_shows WHERE tmdb_id = ? AND media_type = 'movie'", [tmdbId]);

    if (!row) return null;

    return {
      mediaType: 'movie' as const,
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status,
      addedAt: row.added_at,
      releaseDate: row.release_date,
      runtime: row.runtime,
      streamingServices: JSON.parse(row.streaming_services || '[]'),
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
    };
  }

  async addMovie(movie: TrackedMovie): Promise<void> {
    if (!this.db) await this.init();

    // Track if operation succeeded (for sync queue)
    let added = false;

    // Helper to perform the update
    const doUpdate = async () => {
      await this.db!.runAsync(
        `UPDATE tracked_shows SET
           title = ?, poster_path = ?, status = ?, streaming_services = ?,
           release_date = ?, runtime = ?, sync_status = ?
         WHERE tmdb_id = ? AND media_type = 'movie'`,
        [
          movie.title,
          movie.posterPath,
          movie.status,
          JSON.stringify(movie.streamingServices),
          movie.releaseDate,
          movie.runtime,
          DEFAULT_SYNC_STATUS,
          movie.tmdbId,
        ]
      );
    };

    // Use transaction for atomic check-then-insert/update to prevent race conditions
    await this.db!.withTransactionAsync(async () => {
      // Check for ANY existing row with this tmdb_id (regardless of media_type)
      // This prevents PRIMARY KEY constraint violation when TV show has same ID
      const existing = await this.db!.getFirstAsync<{ tmdb_id: number; media_type: string | null }>(
        "SELECT tmdb_id, media_type FROM tracked_shows WHERE tmdb_id = ?",
        [movie.tmdbId]
      );

      if (existing) {
        if (existing.media_type === 'movie') {
          // Update existing movie
          await doUpdate();
          added = true;
        } else {
          // A TV show with this TMDB ID already exists - can't add movie with same ID
          // This is rare (TMDB IDs don't usually overlap) but possible
          console.warn(`Cannot add movie ${movie.tmdbId}: a TV show with this TMDB ID already exists`);
          // added remains false - don't queue for sync
        }
      } else {
        await this.db!.runAsync(
          `INSERT INTO tracked_shows
           (tmdb_id, title, poster_path, status, added_at, total_seasons, total_episodes, streaming_services, sync_status, media_type, release_date, runtime)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'movie', ?, ?)`,
          [
            movie.tmdbId,
            movie.title,
            movie.posterPath,
            movie.status,
            movie.addedAt,
            JSON.stringify(movie.streamingServices),
            DEFAULT_SYNC_STATUS,
            movie.releaseDate,
            movie.runtime,
          ]
        );
        added = true;
      }
    });

    // Only queue for sync if operation succeeded
    if (!added) return;

    // Queue for sync
    await this.addToSyncQueue('tracked_shows', `movie-${movie.tmdbId}`, 'create', movie);
  }

  async updateMovieStatus(tmdbId: number, status: MovieStatus): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      "UPDATE tracked_shows SET status = ?, sync_status = ? WHERE tmdb_id = ? AND media_type = 'movie'",
      [status, DEFAULT_SYNC_STATUS, tmdbId]
    );

    // Queue for sync
    await this.addToSyncQueue('tracked_shows', `movie-${tmdbId}`, 'update', { tmdbId, status, mediaType: 'movie' });
  }

  async deleteMovie(tmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Queue movie for sync before deleting locally
    await this.addToSyncQueue('tracked_shows', `movie-${tmdbId}`, 'delete', { tmdbId, mediaType: 'movie' });

    // Delete watch history first (queues each watch for sync)
    await this.deleteAllMovieWatchHistory(tmdbId);

    // Finally delete the movie itself
    await this.db!.runAsync("DELETE FROM tracked_shows WHERE tmdb_id = ? AND media_type = 'movie'", [tmdbId]);
  }

  async isMovieTracked(tmdbId: number): Promise<boolean> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM tracked_shows WHERE tmdb_id = ? AND media_type = 'movie'",
      [tmdbId]
    );

    return (row?.count ?? 0) > 0;
  }

  // Get all media (shows + movies) for library screen
  async getAllMedia(): Promise<TrackedMedia[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      title: string;
      poster_path: string | null;
      status: string;
      added_at: string;
      total_seasons: number;
      total_episodes: number;
      aired_episodes: number | null;
      streaming_services: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
      last_synced_at: string | null;
      media_type: MediaType | null;
      release_date: string | null;
      runtime: number | null;
    }>('SELECT * FROM tracked_shows ORDER BY added_at DESC');

    return rows.map((row) => {
      const mediaType = row.media_type || 'tv';
      if (mediaType === 'movie') {
        return {
          mediaType: 'movie' as const,
          tmdbId: row.tmdb_id,
          title: row.title,
          posterPath: row.poster_path,
          status: row.status as MovieStatus,
          addedAt: row.added_at,
          releaseDate: row.release_date,
          runtime: row.runtime,
          streamingServices: JSON.parse(row.streaming_services || '[]'),
          syncStatus: row.sync_status ?? undefined,
          remoteId: row.remote_id ?? undefined,
          lastSyncedAt: row.last_synced_at ?? undefined,
        } as TrackedMovie;
      } else {
        return {
          mediaType: 'tv' as const,
          tmdbId: row.tmdb_id,
          title: row.title,
          posterPath: row.poster_path,
          status: row.status as ShowStatus,
          addedAt: row.added_at,
          totalSeasons: row.total_seasons,
          totalEpisodes: row.total_episodes,
          airedEpisodes: row.aired_episodes ?? undefined,
          streamingServices: JSON.parse(row.streaming_services || '[]'),
          syncStatus: row.sync_status ?? undefined,
          remoteId: row.remote_id ?? undefined,
          lastSyncedAt: row.last_synced_at ?? undefined,
        } as TrackedShow;
      }
    });
  }

  // ==================== EPISODE WATCH HISTORY ====================

  // Add a watch to episode history (called when marking episode as watched)
  async addEpisodeWatchHistory(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    watchedAt: string,
    episodeTitle?: string
  ): Promise<string> {
    if (!this.db) await this.init();

    // Generate unique ID with timestamp to allow multiple watches
    const id = `${showTmdbId}-${seasonNumber}-${episodeNumber}-${Date.now()}`;

    await this.db!.runAsync(
      `INSERT INTO episode_watch_history
       (id, show_tmdb_id, season_number, episode_number, watched_at, episode_title, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, showTmdbId, seasonNumber, episodeNumber, watchedAt, episodeTitle ?? null, DEFAULT_SYNC_STATUS]
    );

    // Queue for sync
    await this.addToSyncQueue('episode_watch_history', id, 'create', {
      id,
      showTmdbId,
      seasonNumber,
      episodeNumber,
      watchedAt,
      episodeTitle,
    });

    return id;
  }

  // Import a watch from cloud sync (preserves original ID, no sync queue)
  async importEpisodeWatchHistory(
    id: string,
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    watchedAt: string,
    episodeTitle?: string,
    remoteId?: string
  ): Promise<void> {
    if (!this.db) await this.init();

    // Check if this exact ID already exists locally
    const existing = await this.db!.getFirstAsync<{ id: string }>(
      'SELECT id FROM episode_watch_history WHERE id = ?',
      [id]
    );
    if (existing) return;

    // Also check by content to prevent duplicates when local_id is null on remote
    const existingContent = await this.db!.getFirstAsync<{ id: string }>(
      `SELECT id FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ? AND watched_at = ?`,
      [showTmdbId, seasonNumber, episodeNumber, watchedAt]
    );
    if (existingContent) return;

    await this.db!.runAsync(
      `INSERT INTO episode_watch_history
       (id, show_tmdb_id, season_number, episode_number, watched_at, episode_title, sync_status, remote_id)
       VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [id, showTmdbId, seasonNumber, episodeNumber, watchedAt, episodeTitle ?? null, remoteId ?? null]
    );
  }

  // Get all watches for a specific episode
  async getEpisodeWatchHistory(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeWatchHistory[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      watched_at: string;
      episode_title: string | null;
      sync_status: SyncStatus | null;
      remote_id: string | null;
    }>(
      `SELECT * FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?
       ORDER BY watched_at DESC`,
      [showTmdbId, seasonNumber, episodeNumber]
    );

    return rows.map((row) => ({
      id: row.id,
      showTmdbId: row.show_tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      watchedAt: row.watched_at,
      episodeTitle: row.episode_title ?? undefined,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
    }));
  }

  // Get watch count for a specific episode
  async getEpisodeWatchCount(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<number> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?`,
      [showTmdbId, seasonNumber, episodeNumber]
    );

    return row?.count ?? 0;
  }

  // Get watch counts for all episodes of a show (for efficient batch loading)
  async getEpisodeWatchCountsForShow(showTmdbId: number): Promise<Map<string, number>> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      season_number: number;
      episode_number: number;
      count: number;
    }>(
      `SELECT season_number, episode_number, COUNT(*) as count
       FROM episode_watch_history
       WHERE show_tmdb_id = ?
       GROUP BY season_number, episode_number`,
      [showTmdbId]
    );

    const countMap = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.season_number}-${row.episode_number}`;
      countMap.set(key, row.count);
    }
    return countMap;
  }

  // Get watch history summary for an episode
  async getEpisodeWatchHistorySummary(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<WatchHistorySummary> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{ id: string; watched_at: string }>(
      `SELECT id, watched_at FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?
       ORDER BY watched_at DESC`,
      [showTmdbId, seasonNumber, episodeNumber]
    );

    return {
      totalWatches: rows.length,
      // With ORDER BY DESC: rows[0] is newest, rows[length-1] is oldest
      firstWatchedAt: rows.length > 0 ? rows[rows.length - 1].watched_at : null,
      lastWatchedAt: rows.length > 0 ? rows[0].watched_at : null,
      watches: rows.map((r) => ({ id: r.id, watchedAt: r.watched_at })),
    };
  }

  // Delete a specific watch from episode history
  async deleteEpisodeWatch(watchId: string): Promise<void> {
    if (!this.db) await this.init();

    // Queue for sync before deleting locally
    await this.addToSyncQueue('episode_watch_history', watchId, 'delete', { id: watchId });

    await this.db!.runAsync('DELETE FROM episode_watch_history WHERE id = ?', [watchId]);
  }

  // Update the watched_at date for an episode watch
  async updateEpisodeWatchDate(watchId: string, watchedAt: string): Promise<void> {
    if (!this.db) await this.init();

    // Get the existing watch to include full data in sync queue
    const existing = await this.db!.getFirstAsync<{
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      episode_title: string | null;
    }>(
      `SELECT show_tmdb_id, season_number, episode_number, episode_title
       FROM episode_watch_history WHERE id = ?`,
      [watchId]
    );

    if (!existing) {
      throw new Error(`Watch not found: ${watchId}`);
    }

    await this.db!.runAsync(
      'UPDATE episode_watch_history SET watched_at = ? WHERE id = ?',
      [watchedAt, watchId]
    );

    // Queue for sync with updated data
    await this.addToSyncQueue('episode_watch_history', watchId, 'update', {
      id: watchId,
      showTmdbId: existing.show_tmdb_id,
      seasonNumber: existing.season_number,
      episodeNumber: existing.episode_number,
      watchedAt,
      episodeTitle: existing.episode_title,
    });
  }

  // Delete the most recent watch for an episode (for undo/unwatch)
  async deleteLatestEpisodeWatch(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<string | null> {
    if (!this.db) await this.init();

    // Get the most recent watch
    const latest = await this.db!.getFirstAsync<{ id: string }>(
      `SELECT id FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?
       ORDER BY watched_at DESC LIMIT 1`,
      [showTmdbId, seasonNumber, episodeNumber]
    );

    if (latest) {
      await this.deleteEpisodeWatch(latest.id);
      return latest.id;
    }
    return null;
  }

  // Delete all watch history for an episode
  async deleteAllEpisodeWatchHistory(
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    if (!this.db) await this.init();

    // Get all watches to queue for sync deletion
    const watches = await this.getEpisodeWatchHistory(showTmdbId, seasonNumber, episodeNumber);
    for (const watch of watches) {
      await this.addToSyncQueue('episode_watch_history', watch.id, 'delete', { id: watch.id });
    }

    await this.db!.runAsync(
      `DELETE FROM episode_watch_history
       WHERE show_tmdb_id = ? AND season_number = ? AND episode_number = ?`,
      [showTmdbId, seasonNumber, episodeNumber]
    );
  }

  // Delete all watch history for a show (when removing show)
  async deleteShowWatchHistory(showTmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Get all watches to queue for sync deletion
    const rows = await this.db!.getAllAsync<{ id: string }>(
      'SELECT id FROM episode_watch_history WHERE show_tmdb_id = ?',
      [showTmdbId]
    );
    for (const row of rows) {
      await this.addToSyncQueue('episode_watch_history', row.id, 'delete', { id: row.id });
    }

    await this.db!.runAsync('DELETE FROM episode_watch_history WHERE show_tmdb_id = ?', [showTmdbId]);
  }

  // ==================== MOVIE WATCH HISTORY ====================

  // Add a watch to movie history
  async addMovieWatchHistory(movieTmdbId: number, watchedAt: string): Promise<string> {
    if (!this.db) await this.init();

    // Generate unique ID with timestamp to allow multiple watches
    const id = `movie-${movieTmdbId}-${Date.now()}`;

    await this.db!.runAsync(
      `INSERT INTO movie_watch_history
       (id, movie_tmdb_id, watched_at, sync_status)
       VALUES (?, ?, ?, ?)`,
      [id, movieTmdbId, watchedAt, DEFAULT_SYNC_STATUS]
    );

    // Queue for sync
    await this.addToSyncQueue('movie_watch_history', id, 'create', {
      id,
      movieTmdbId,
      watchedAt,
    });

    return id;
  }

  // Import a watch from cloud sync (preserves original ID, no sync queue)
  async importMovieWatchHistory(
    id: string,
    movieTmdbId: number,
    watchedAt: string,
    remoteId?: string
  ): Promise<void> {
    if (!this.db) await this.init();

    // Check if this exact ID already exists locally
    const existing = await this.db!.getFirstAsync<{ id: string }>(
      'SELECT id FROM movie_watch_history WHERE id = ?',
      [id]
    );
    if (existing) return;

    // Also check by content to prevent duplicates when local_id is null on remote
    const existingContent = await this.db!.getFirstAsync<{ id: string }>(
      'SELECT id FROM movie_watch_history WHERE movie_tmdb_id = ? AND watched_at = ?',
      [movieTmdbId, watchedAt]
    );
    if (existingContent) return;

    await this.db!.runAsync(
      `INSERT INTO movie_watch_history
       (id, movie_tmdb_id, watched_at, sync_status, remote_id)
       VALUES (?, ?, ?, 'synced', ?)`,
      [id, movieTmdbId, watchedAt, remoteId ?? null]
    );
  }

  // Get all watches for a specific movie
  async getMovieWatchHistory(movieTmdbId: number): Promise<MovieWatchHistory[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      movie_tmdb_id: number;
      watched_at: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
    }>(
      'SELECT * FROM movie_watch_history WHERE movie_tmdb_id = ? ORDER BY watched_at DESC',
      [movieTmdbId]
    );

    return rows.map((row) => ({
      id: row.id,
      movieTmdbId: row.movie_tmdb_id,
      watchedAt: row.watched_at,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
    }));
  }

  // Get watch count for a specific movie
  async getMovieWatchCount(movieTmdbId: number): Promise<number> {
    if (!this.db) await this.init();

    const row = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM movie_watch_history WHERE movie_tmdb_id = ?',
      [movieTmdbId]
    );

    return row?.count ?? 0;
  }

  // Get watch history summary for a movie
  async getMovieWatchHistorySummary(movieTmdbId: number): Promise<WatchHistorySummary> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{ id: string; watched_at: string }>(
      'SELECT id, watched_at FROM movie_watch_history WHERE movie_tmdb_id = ? ORDER BY watched_at DESC',
      [movieTmdbId]
    );

    return {
      totalWatches: rows.length,
      // With ORDER BY DESC: rows[0] is newest, rows[length-1] is oldest
      firstWatchedAt: rows.length > 0 ? rows[rows.length - 1].watched_at : null,
      lastWatchedAt: rows.length > 0 ? rows[0].watched_at : null,
      watches: rows.map((r) => ({ id: r.id, watchedAt: r.watched_at })),
    };
  }

  // Delete a specific watch from movie history
  async deleteMovieWatch(watchId: string): Promise<void> {
    if (!this.db) await this.init();

    // Queue for sync before deleting locally
    await this.addToSyncQueue('movie_watch_history', watchId, 'delete', { id: watchId });

    await this.db!.runAsync('DELETE FROM movie_watch_history WHERE id = ?', [watchId]);
  }

  // Update the watched_at date for a movie watch
  async updateMovieWatchDate(watchId: string, watchedAt: string): Promise<void> {
    if (!this.db) await this.init();

    // Get the existing watch to include full data in sync queue
    const existing = await this.db!.getFirstAsync<{ movie_tmdb_id: number }>(
      'SELECT movie_tmdb_id FROM movie_watch_history WHERE id = ?',
      [watchId]
    );

    if (!existing) {
      throw new Error(`Watch not found: ${watchId}`);
    }

    await this.db!.runAsync(
      'UPDATE movie_watch_history SET watched_at = ? WHERE id = ?',
      [watchedAt, watchId]
    );

    // Queue for sync with updated data
    await this.addToSyncQueue('movie_watch_history', watchId, 'update', {
      id: watchId,
      movieTmdbId: existing.movie_tmdb_id,
      watchedAt,
    });
  }

  // Delete the most recent watch for a movie
  async deleteLatestMovieWatch(movieTmdbId: number): Promise<string | null> {
    if (!this.db) await this.init();

    const latest = await this.db!.getFirstAsync<{ id: string }>(
      'SELECT id FROM movie_watch_history WHERE movie_tmdb_id = ? ORDER BY watched_at DESC LIMIT 1',
      [movieTmdbId]
    );

    if (latest) {
      await this.deleteMovieWatch(latest.id);
      return latest.id;
    }
    return null;
  }

  // Delete all watch history for a movie
  async deleteAllMovieWatchHistory(movieTmdbId: number): Promise<void> {
    if (!this.db) await this.init();

    // Get all watches to queue for sync deletion
    const watches = await this.getMovieWatchHistory(movieTmdbId);
    for (const watch of watches) {
      await this.addToSyncQueue('movie_watch_history', watch.id, 'delete', { id: watch.id });
    }

    await this.db!.runAsync('DELETE FROM movie_watch_history WHERE movie_tmdb_id = ?', [movieTmdbId]);
  }

  // ========== BULK RETRIEVAL METHODS (for data export) ==========

  // Get all watched episodes across all shows
  async getAllWatchedEpisodes(): Promise<WatchedEpisode[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      watched_at: string;
      episode_title: string | null;
      still_path: string | null;
    }>('SELECT * FROM watched_episodes ORDER BY show_tmdb_id, season_number, episode_number');

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

  // Get all episode reactions across all shows
  async getAllEpisodeReactions(): Promise<EpisodeReaction[]> {
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
    }>('SELECT * FROM episode_reactions ORDER BY show_tmdb_id, season_number, episode_number');

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

  // Get all episode watch history (rewatch records)
  async getAllEpisodeWatchHistory(): Promise<EpisodeWatchHistory[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      show_tmdb_id: number;
      season_number: number;
      episode_number: number;
      watched_at: string;
      episode_title: string | null;
      sync_status: SyncStatus | null;
      remote_id: string | null;
    }>('SELECT * FROM episode_watch_history ORDER BY show_tmdb_id, watched_at');

    return rows.map((row) => ({
      id: row.id,
      showTmdbId: row.show_tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      watchedAt: row.watched_at,
      episodeTitle: row.episode_title ?? undefined,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
    }));
  }

  // Get all movie watch history (rewatch records)
  async getAllMovieWatchHistory(): Promise<MovieWatchHistory[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      id: string;
      movie_tmdb_id: number;
      watched_at: string;
      sync_status: SyncStatus | null;
      remote_id: string | null;
    }>('SELECT * FROM movie_watch_history ORDER BY movie_tmdb_id, watched_at');

    return rows.map((row) => ({
      id: row.id,
      movieTmdbId: row.movie_tmdb_id,
      watchedAt: row.watched_at,
      syncStatus: row.sync_status ?? undefined,
      remoteId: row.remote_id ?? undefined,
    }));
  }

  // Get all dismissed shows with full data
  async getAllDismissedShows(): Promise<{ tmdbId: number; dismissedAt: string }[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      dismissed_at: string;
    }>('SELECT tmdb_id, dismissed_at FROM dismissed_shows ORDER BY dismissed_at DESC');

    return rows.map((row) => ({
      tmdbId: row.tmdb_id,
      dismissedAt: row.dismissed_at,
    }));
  }

  // Get all dismissed movies with full data
  async getAllDismissedMovies(): Promise<{ tmdbId: number; dismissedAt: string }[]> {
    if (!this.db) await this.init();

    const rows = await this.db!.getAllAsync<{
      tmdb_id: number;
      dismissed_at: string;
    }>('SELECT tmdb_id, dismissed_at FROM dismissed_movies ORDER BY dismissed_at DESC');

    return rows.map((row) => ({
      tmdbId: row.tmdb_id,
      dismissedAt: row.dismissed_at,
    }));
  }

  // ==================== STATS AGGREGATE QUERIES ====================

  async getStatsTotalEpisodesWatched(): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM watched_episodes');
    return row?.count ?? 0;
  }

  async getStatsTotalMoviesWatched(): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ count: number }>('SELECT COUNT(DISTINCT movie_tmdb_id) as count FROM movie_watch_history');
    return row?.count ?? 0;
  }

  async getStatsEpisodeWatchTimeMinutes(): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ total: number | null }>(`
      SELECT SUM(ep_counts.cnt * COALESCE(ts.runtime, 30)) as total
      FROM (SELECT show_tmdb_id, COUNT(*) as cnt FROM episode_watch_history GROUP BY show_tmdb_id) ep_counts
      JOIN tracked_shows ts ON ts.tmdb_id = ep_counts.show_tmdb_id
    `);
    return row?.total ?? 0;
  }

  async getStatsMovieWatchTimeMinutes(): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ total: number | null }>(`
      SELECT SUM(COALESCE(ts.runtime, 90) * mwh.cnt) as total
      FROM tracked_shows ts
      JOIN (SELECT movie_tmdb_id, COUNT(*) as cnt FROM movie_watch_history GROUP BY movie_tmdb_id) mwh
        ON ts.tmdb_id = mwh.movie_tmdb_id
      WHERE ts.media_type = 'movie'
    `);
    return row?.total ?? 0;
  }

  async getStatsAllWatchDates(): Promise<string[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.getAllAsync<{ watch_date: string }>(`
      SELECT DISTINCT DATE(watched_at) as watch_date FROM episode_watch_history
      UNION
      SELECT DISTINCT DATE(watched_at) as watch_date FROM movie_watch_history
      ORDER BY watch_date DESC
    `);
    return rows.map(r => r.watch_date);
  }

  async getStatsLibraryBreakdown(): Promise<{ media_type: string | null; status: string; count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ media_type: string | null; status: string; count: number }>(
      'SELECT media_type, status, COUNT(*) as count FROM tracked_shows GROUP BY media_type, status'
    );
  }

  async getStatsReactionsSummary(): Promise<{ reaction: string; count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ reaction: string; count: number }>(
      'SELECT reaction, COUNT(*) as count FROM episode_reactions GROUP BY reaction'
    );
  }

  async getStatsStreamingServices(): Promise<string[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.getAllAsync<{ streaming_services: string }>(
      "SELECT streaming_services FROM tracked_shows WHERE streaming_services != '[]' AND streaming_services IS NOT NULL"
    );
    return rows.map(r => r.streaming_services);
  }

  async getStatsEpisodeWatchTimeForPeriod(sinceDateISO: string): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ total: number | null }>(`
      SELECT SUM(COALESCE(ts.runtime, 30)) as total
      FROM episode_watch_history ewh
      JOIN tracked_shows ts ON ts.tmdb_id = ewh.show_tmdb_id
      WHERE ewh.watched_at >= ?
    `, [sinceDateISO]);
    return row?.total ?? 0;
  }

  async getStatsMovieWatchTimeForPeriod(sinceDateISO: string): Promise<number> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ total: number | null }>(`
      SELECT SUM(COALESCE(ts.runtime, 90)) as total
      FROM movie_watch_history mwh
      JOIN tracked_shows ts ON ts.tmdb_id = mwh.movie_tmdb_id
      WHERE ts.media_type = 'movie' AND mwh.watched_at >= ?
    `, [sinceDateISO]);
    return row?.total ?? 0;
  }

  async getStatsBusiestDayOfWeek(): Promise<{ dow: number; count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ dow: number; count: number }>(`
      SELECT dow, SUM(cnt) as count FROM (
        SELECT CAST(strftime('%w', watched_at) AS INTEGER) as dow, COUNT(*) as cnt
        FROM episode_watch_history GROUP BY dow
        UNION ALL
        SELECT CAST(strftime('%w', watched_at) AS INTEGER) as dow, COUNT(*) as cnt
        FROM movie_watch_history GROUP BY dow
      ) GROUP BY dow ORDER BY dow
    `);
  }

  async getStatsActivityCalendar(days: number): Promise<{ d: string; count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ d: string; count: number }>(`
      SELECT d, SUM(cnt) as count FROM (
        SELECT DATE(watched_at) as d, COUNT(*) as cnt FROM episode_watch_history
        WHERE watched_at >= DATE('now', '-' || ? || ' days') GROUP BY d
        UNION ALL
        SELECT DATE(watched_at) as d, COUNT(*) as cnt FROM movie_watch_history
        WHERE watched_at >= DATE('now', '-' || ? || ' days') GROUP BY d
      ) GROUP BY d ORDER BY d
    `, [days, days]);
  }

  async getStatsMostWatchedShows(limit: number): Promise<{ show_tmdb_id: number; title: string; poster_path: string | null; total_episodes: number; watched_count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ show_tmdb_id: number; title: string; poster_path: string | null; total_episodes: number; watched_count: number }>(`
      SELECT ewh.show_tmdb_id, ts.title, ts.poster_path, ts.total_episodes, COUNT(*) as watched_count
      FROM episode_watch_history ewh
      JOIN tracked_shows ts ON ts.tmdb_id = ewh.show_tmdb_id
      GROUP BY ewh.show_tmdb_id ORDER BY watched_count DESC LIMIT ?
    `, [limit]);
  }

  async getStatsMonthlyTrend(months: number): Promise<{ month: string; count: number }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ month: string; count: number }>(`
      SELECT month, SUM(cnt) as count FROM (
        SELECT strftime('%Y-%m', watched_at) as month, COUNT(*) as cnt
        FROM episode_watch_history WHERE watched_at >= DATE('now', '-' || ? || ' months')
        GROUP BY month
        UNION ALL
        SELECT strftime('%Y-%m', watched_at) as month, COUNT(*) as cnt
        FROM movie_watch_history WHERE watched_at >= DATE('now', '-' || ? || ' months')
        GROUP BY month
      ) GROUP BY month ORDER BY month
    `, [months, months]);
  }

  async getStatsBiggestBingeDay(): Promise<{ d: string; count: number } | null> {
    if (!this.db) await this.init();
    // Filter out bulk-marks: only count show-day combos where timestamps are spread
    // (> 60s between first and last) or where count is small enough to be real
    return this.db!.getFirstAsync<{ d: string; count: number }>(`
      SELECT d, SUM(cnt) as count FROM (
        SELECT DATE(watched_at) as d, COUNT(*) as cnt
        FROM episode_watch_history
        GROUP BY d, show_tmdb_id
        HAVING COUNT(*) <= 12
           OR (julianday(MAX(watched_at)) - julianday(MIN(watched_at))) * 86400 > 60
        UNION ALL
        SELECT DATE(watched_at) as d, COUNT(*) as cnt FROM movie_watch_history GROUP BY d
      ) GROUP BY d ORDER BY count DESC LIMIT 1
    `);
  }

  async getStatsFastestBinge(): Promise<{ show_tmdb_id: number; title: string; eps: number; first: string; last: string }[]> {
    if (!this.db) await this.init();
    // Filter: watch span must be > 1 hour to exclude bulk-marks
    return this.db!.getAllAsync<{ show_tmdb_id: number; title: string; eps: number; first: string; last: string }>(`
      SELECT ewh.show_tmdb_id, ts.title, COUNT(*) as eps,
        MIN(ewh.watched_at) as first, MAX(ewh.watched_at) as last
      FROM episode_watch_history ewh
      JOIN tracked_shows ts ON ts.tmdb_id = ewh.show_tmdb_id
      WHERE ts.status = 'completed'
      GROUP BY ewh.show_tmdb_id
      HAVING COUNT(*) >= 5
        AND (julianday(MAX(ewh.watched_at)) - julianday(MIN(ewh.watched_at))) * 24 > 1
    `);
  }

  async getStatsTopReactedEpisodes(limit: number): Promise<{ show_tmdb_id: number; show_title: string; season_number: number; episode_number: number; episode_title: string | null; reaction: string }[]> {
    if (!this.db) await this.init();
    return this.db!.getAllAsync<{ show_tmdb_id: number; show_title: string; season_number: number; episode_number: number; episode_title: string | null; reaction: string }>(`
      SELECT er.show_tmdb_id, ts.title as show_title,
        er.season_number, er.episode_number,
        we.episode_title, er.reaction
      FROM episode_reactions er
      JOIN tracked_shows ts ON ts.tmdb_id = er.show_tmdb_id
      LEFT JOIN watched_episodes we ON we.show_tmdb_id = er.show_tmdb_id
        AND we.season_number = er.season_number
        AND we.episode_number = er.episode_number
      ORDER BY er.created_at DESC
      LIMIT ?
    `, [limit]);
  }

  async getStatsMostRewatchedShow(): Promise<{ show_tmdb_id: number; title: string; rewatch_count: number } | null> {
    if (!this.db) await this.init();
    return this.db!.getFirstAsync<{ show_tmdb_id: number; title: string; rewatch_count: number }>(`
      SELECT ewh.show_tmdb_id, ts.title,
        (COUNT(*) - COUNT(DISTINCT ewh.season_number || '-' || ewh.episode_number)) as rewatch_count
      FROM episode_watch_history ewh
      JOIN tracked_shows ts ON ts.tmdb_id = ewh.show_tmdb_id
      GROUP BY ewh.show_tmdb_id
      HAVING rewatch_count > 0
      ORDER BY rewatch_count DESC LIMIT 1
    `);
  }

  async getStatsFirstWatchDate(): Promise<string | null> {
    if (!this.db) await this.init();
    const row = await this.db!.getFirstAsync<{ earliest: string | null }>(`
      SELECT MIN(d) as earliest FROM (
        SELECT MIN(watched_at) as d FROM episode_watch_history
        UNION ALL
        SELECT MIN(watched_at) as d FROM movie_watch_history
      )
    `);
    return row?.earliest ?? null;
  }

  async getStatsShowsWithNullRuntime(): Promise<number[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.getAllAsync<{ tmdb_id: number }>(
      "SELECT tmdb_id FROM tracked_shows WHERE (media_type = 'tv' OR media_type IS NULL) AND runtime IS NULL"
    );
    return rows.map(r => r.tmdb_id);
  }

  async updateShowRuntime(tmdbId: number, runtime: number): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.runAsync('UPDATE tracked_shows SET runtime = ? WHERE tmdb_id = ? AND runtime IS NULL', [runtime, tmdbId]);
  }

  // Clear all local data (used on sign out to prevent data bleeding between accounts)
  async clearAllData(): Promise<void> {
    if (!this.db) await this.init();

    // Delete all data from all tables
    await this.db!.execAsync(`
      DELETE FROM episode_reactions;
      DELETE FROM dismissed_shows;
      DELETE FROM dismissed_movies;
      DELETE FROM sync_queue;
      DELETE FROM watched_episodes;
      DELETE FROM tracked_shows;
      DELETE FROM episode_watch_history;
      DELETE FROM movie_watch_history;
    `);
  }
}

export const storageService = new StorageService();
