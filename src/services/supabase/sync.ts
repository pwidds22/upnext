import AsyncStorage from '@react-native-async-storage/async-storage';
import { showsCloudService } from './shows';
import { episodesCloudService } from './episodes';
import { episodeReactionsCloudService } from './episodeReactions';
import { dismissedShowsCloudService } from './dismissedShows';
import { episodeWatchHistoryService, movieWatchHistoryService } from './watchHistory';
import { storageService } from '../storage';
import type {
  SyncResult,
  SyncQueueItem,
  TrackedShow,
  ShowStatus,
  WatchedEpisode,
  EpisodeReaction,
  DismissedShow,
  EpisodeWatchHistory,
  MovieWatchHistory,
  UserShowRow,
  UserWatchedEpisodeRow,
} from '../../types';

const LAST_SYNC_KEY = '@upnext_last_sync';

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

interface SyncOptions {
  fullSync?: boolean;
}

// Helper to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = RETRY_CONFIG.maxAttempts
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;

      const delayMs = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelay
      );

      await delay(delayMs);
    }
  }

  throw lastError;
}

// Conflict resolution: last-write-wins based on timestamps
function resolveConflict(
  localUpdatedAt: string | undefined,
  remoteUpdatedAt: string | undefined
): 'local' | 'remote' {
  const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
  const remoteTime = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  return localTime >= remoteTime ? 'local' : 'remote';
}

export const syncService = {
  // Get last sync timestamp
  async getLastSyncTime(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_SYNC_KEY);
  },

  // Set last sync timestamp
  async setLastSyncTime(timestamp: string): Promise<void> {
    await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
  },

  // Main sync entry point
  async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      pushed: { shows: 0, episodes: 0 },
      pulled: { shows: 0, episodes: 0 },
      conflicts: 0,
      errors: [],
    };

    try {
      if (options?.fullSync) {
        return await this.initialSync(userId);
      }

      // Process sync queue (push local changes)
      const pushResult = await this.pushChanges(userId);
      result.pushed = pushResult.pushed;
      result.errors.push(...pushResult.errors);

      // Pull remote changes
      const lastSync = await this.getLastSyncTime();
      if (lastSync) {
        const pullResult = await this.pullChanges(userId, lastSync);
        result.pulled = pullResult.pulled;
        result.conflicts = pullResult.conflicts;
      }

      // Update last sync time
      await this.setLastSyncTime(new Date().toISOString());

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push((error as Error).message);
    }

    return result;
  },

  // Initial sync on sign-in (full merge)
  async initialSync(userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      pushed: { shows: 0, episodes: 0 },
      pulled: { shows: 0, episodes: 0 },
      conflicts: 0,
      errors: [],
    };

    try {
      // Step 1: Get all local and remote data
      const [localShows, remoteShows, localEpisodes, remoteEpisodes] = await Promise.all([
        storageService.getAllShows(),
        showsCloudService.fetchAllShows(userId),
        this.getAllLocalEpisodes(),
        episodesCloudService.fetchAllEpisodes(userId),
      ]);

      // Step 2: Build lookup maps
      const remoteShowsMap = new Map(remoteShows.map((s) => [s.tmdbId, s]));
      const localShowsMap = new Map(localShows.map((s) => [s.tmdbId, s]));
      const remoteEpisodesMap = new Map(remoteEpisodes.map((e) => [e.id, e]));
      const localEpisodesMap = new Map(localEpisodes.map((e) => [e.id, e]));

      // Step 3: Sync shows
      // Push local shows that don't exist remotely
      const showsToPush: TrackedShow[] = [];
      for (const localShow of localShows) {
        const remoteShow = remoteShowsMap.get(localShow.tmdbId);
        if (!remoteShow) {
          showsToPush.push(localShow);
        } else {
          // Conflict: both exist, use last-write-wins
          const winner = resolveConflict(localShow.lastSyncedAt, remoteShow.lastSyncedAt);
          if (winner === 'local') {
            showsToPush.push(localShow);
          }
          result.conflicts++;
        }
      }

      if (showsToPush.length > 0) {
        await withRetry(() => showsCloudService.upsertShows(userId, showsToPush));
        result.pushed.shows = showsToPush.length;
      }

      // Pull remote shows that don't exist locally
      for (const remoteShow of remoteShows) {
        if (!localShowsMap.has(remoteShow.tmdbId)) {
          await storageService.addShow(remoteShow);
          // Mark as synced since it came from remote
          await storageService.updateShowSyncStatus(remoteShow.tmdbId, 'synced', remoteShow.remoteId);
          result.pulled.shows++;
        }
      }

      // Step 4: Sync episodes
      // Push local episodes that don't exist remotely
      const episodesToPush: WatchedEpisode[] = [];
      for (const localEp of localEpisodes) {
        const remoteEp = remoteEpisodesMap.get(localEp.id);
        if (!remoteEp) {
          episodesToPush.push(localEp);
        } else {
          // Conflict: both exist, use last-write-wins
          const winner = resolveConflict(localEp.lastSyncedAt, remoteEp.lastSyncedAt);
          if (winner === 'local') {
            episodesToPush.push(localEp);
          }
          result.conflicts++;
        }
      }

      if (episodesToPush.length > 0) {
        // Batch in chunks of 100
        for (let i = 0; i < episodesToPush.length; i += 100) {
          const batch = episodesToPush.slice(i, i + 100);
          await withRetry(() => episodesCloudService.upsertEpisodes(userId, batch));
        }
        result.pushed.episodes = episodesToPush.length;
      }

      // Pull remote episodes that don't exist locally
      for (const remoteEp of remoteEpisodes) {
        if (!localEpisodesMap.has(remoteEp.id)) {
          await storageService.markEpisodeWatched({
            showTmdbId: remoteEp.showTmdbId,
            seasonNumber: remoteEp.seasonNumber,
            episodeNumber: remoteEp.episodeNumber,
            watchedAt: remoteEp.watchedAt,
            episodeTitle: remoteEp.episodeTitle,
            stillPath: remoteEp.stillPath,
          });
          result.pulled.episodes++;
        }
      }

      // Step 5: Clear sync queue and update timestamp
      await storageService.clearSyncQueue();
      await this.setLastSyncTime(new Date().toISOString());

      // Mark all local shows as synced
      for (const show of localShows) {
        const remoteId = (await showsCloudService.getShowRemoteId(userId, show.tmdbId)) ?? undefined;
        await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteId);
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push((error as Error).message);
    }

    return result;
  },

  // Push local changes to cloud
  async pushChanges(userId: string): Promise<{ pushed: { shows: number; episodes: number }; errors: string[] }> {
    const pushed = { shows: 0, episodes: 0 };
    const errors: string[] = [];

    const queue = await storageService.getSyncQueue();

    for (const item of queue) {
      try {
        await this.processSyncQueueItem(userId, item);

        if (item.tableName === 'tracked_shows') pushed.shows++;
        if (item.tableName === 'watched_episodes') pushed.episodes++;

        await storageService.removeSyncQueueItem(item.id);
      } catch (error) {
        const errorMsg = (error as Error).message;
        errors.push(`Failed to sync ${item.tableName} ${item.recordId}: ${errorMsg}`);

        // Update retry count
        await storageService.updateSyncQueueItemError(item.id, errorMsg);

        // If too many attempts, remove from queue
        if (item.attempts >= RETRY_CONFIG.maxAttempts - 1) {
          await storageService.removeSyncQueueItem(item.id);
          errors.push(`Gave up syncing ${item.tableName} ${item.recordId} after ${item.attempts + 1} attempts`);
        }
      }
    }

    return { pushed, errors };
  },

  // Pull remote changes since last sync
  async pullChanges(
    userId: string,
    since: string
  ): Promise<{ pulled: { shows: number; episodes: number }; conflicts: number }> {
    const pulled = { shows: 0, episodes: 0 };
    let conflicts = 0;

    // Fetch changes from remote
    const [remoteShowChanges, remoteEpisodeChanges] = await Promise.all([
      showsCloudService.fetchShowsSince(userId, since),
      episodesCloudService.fetchEpisodesSince(userId, since),
    ]);

    // Apply show changes
    for (const remoteRow of remoteShowChanges) {
      const localShow = await storageService.getShow(remoteRow.tmdb_id);

      if (remoteRow.deleted_at) {
        // Remote was deleted
        if (localShow) {
          await storageService.deleteShow(remoteRow.tmdb_id);
          // Remove the delete from sync queue since it came from remote
          await this.removeFromQueueIfExists('tracked_shows', remoteRow.tmdb_id.toString(), 'delete');
        }
        pulled.shows++;
        continue;
      }

      if (!localShow) {
        // New remote show - add locally
        const show = this.rowToTrackedShow(remoteRow);
        await storageService.addShow(show);
        await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteRow.id);
        // Remove from queue since we just pulled it
        await this.removeFromQueueIfExists('tracked_shows', remoteRow.tmdb_id.toString(), 'create');
        pulled.shows++;
      } else {
        // Both exist - conflict resolution
        const winner = resolveConflict(localShow.lastSyncedAt, remoteRow.updated_at);
        if (winner === 'remote') {
          // Update local with remote data
          const show = this.rowToTrackedShow(remoteRow);
          await storageService.addShow(show); // addShow uses INSERT OR REPLACE
          await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteRow.id);
          pulled.shows++;
        }
        conflicts++;
      }
    }

    // Apply episode changes
    for (const remoteRow of remoteEpisodeChanges) {
      const episodeId = `${remoteRow.tmdb_show_id}-${remoteRow.season_number}-${remoteRow.episode_number}`;

      if (remoteRow.deleted_at) {
        // Remote was deleted
        await storageService.markEpisodeUnwatched(
          remoteRow.tmdb_show_id,
          remoteRow.season_number,
          remoteRow.episode_number
        );
        await this.removeFromQueueIfExists('watched_episodes', episodeId, 'delete');
        pulled.episodes++;
        continue;
      }

      // Add/update episode locally
      await storageService.markEpisodeWatched({
        showTmdbId: remoteRow.tmdb_show_id,
        seasonNumber: remoteRow.season_number,
        episodeNumber: remoteRow.episode_number,
        watchedAt: remoteRow.watched_at,
        episodeTitle: remoteRow.episode_title ?? undefined,
        stillPath: remoteRow.still_path ?? undefined,
      });
      await this.removeFromQueueIfExists('watched_episodes', episodeId, 'create');
      pulled.episodes++;
    }

    return { pulled, conflicts };
  },

  // Process a single sync queue item
  async processSyncQueueItem(userId: string, item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);

    if (item.tableName === 'tracked_shows') {
      switch (item.operation) {
        case 'create':
        case 'update': {
          const show = payload as TrackedShow;
          const result = await withRetry(() => showsCloudService.upsertShow(userId, show));
          await storageService.updateShowSyncStatus(show.tmdbId, 'synced', result.id);
          break;
        }
        case 'delete': {
          const { tmdbId } = payload;
          await withRetry(() => showsCloudService.softDeleteShow(userId, tmdbId));
          // Also soft-delete episodes and reactions for this show
          await withRetry(() => episodesCloudService.softDeleteShowEpisodes(userId, tmdbId));
          await withRetry(() => episodeReactionsCloudService.softDeleteShowReactions(userId, tmdbId));
          break;
        }
      }
    } else if (item.tableName === 'watched_episodes') {
      switch (item.operation) {
        case 'create': {
          const episode = payload as WatchedEpisode;
          // Get the user_show_id for this episode's show
          const userShowId = await showsCloudService.getShowRemoteId(userId, episode.showTmdbId);
          await withRetry(() => episodesCloudService.upsertEpisode(userId, episode, userShowId ?? undefined));
          break;
        }
        case 'delete': {
          const { showTmdbId, season, episode } = payload;
          await withRetry(() =>
            episodesCloudService.softDeleteEpisode(userId, showTmdbId, season, episode)
          );
          break;
        }
      }
    } else if (item.tableName === 'episode_reactions') {
      switch (item.operation) {
        case 'create': {
          const reaction = payload as EpisodeReaction;
          await withRetry(() => episodeReactionsCloudService.upsertReaction(userId, reaction));
          break;
        }
        case 'delete': {
          const { showTmdbId, seasonNumber, episodeNumber } = payload;
          await withRetry(() =>
            episodeReactionsCloudService.softDeleteReaction(userId, showTmdbId, seasonNumber, episodeNumber)
          );
          break;
        }
      }
    } else if (item.tableName === 'dismissed_shows') {
      switch (item.operation) {
        case 'create': {
          const dismissed = payload as DismissedShow;
          await withRetry(() => dismissedShowsCloudService.upsertDismissed(userId, dismissed));
          break;
        }
        case 'delete': {
          const { tmdbId } = payload;
          await withRetry(() => dismissedShowsCloudService.softDeleteDismissed(userId, tmdbId));
          break;
        }
      }
    } else if (item.tableName === 'episode_watch_history') {
      switch (item.operation) {
        case 'create': {
          const watch = payload as EpisodeWatchHistory;
          await withRetry(() => episodeWatchHistoryService.insertWatch(userId, watch));
          break;
        }
        case 'delete': {
          const { localId } = payload;
          await withRetry(() => episodeWatchHistoryService.softDeleteWatchByLocalId(userId, localId));
          break;
        }
      }
    } else if (item.tableName === 'movie_watch_history') {
      switch (item.operation) {
        case 'create': {
          const watch = payload as MovieWatchHistory;
          await withRetry(() => movieWatchHistoryService.insertWatch(userId, watch));
          break;
        }
        case 'delete': {
          const { localId } = payload;
          await withRetry(() => movieWatchHistoryService.softDeleteWatchByLocalId(userId, localId));
          break;
        }
      }
    }
  },

  // Helper to get all local episodes across all shows
  async getAllLocalEpisodes(): Promise<WatchedEpisode[]> {
    const shows = await storageService.getAllShows();
    const allEpisodes: WatchedEpisode[] = [];

    for (const show of shows) {
      const episodes = await storageService.getWatchedEpisodes(show.tmdbId);
      allEpisodes.push(...episodes);
    }

    return allEpisodes;
  },

  // Helper to remove an item from sync queue if it exists
  async removeFromQueueIfExists(tableName: string, recordId: string, operation: string): Promise<void> {
    const queue = await storageService.getSyncQueue();
    const item = queue.find(
      (i) => i.tableName === tableName && i.recordId === recordId && i.operation === operation
    );
    if (item) {
      await storageService.removeSyncQueueItem(item.id);
    }
  },

  // Convert Supabase row to TrackedShow
  rowToTrackedShow(row: UserShowRow): TrackedShow {
    return {
      mediaType: 'tv',
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status as ShowStatus,
      addedAt: row.added_at,
      totalSeasons: row.total_seasons,
      totalEpisodes: row.total_episodes,
      airedEpisodes: row.aired_episodes ?? undefined,
      streamingServices: row.streaming_services ?? [],
      syncStatus: 'synced',
      remoteId: row.id,
      lastSyncedAt: row.synced_at,
    };
  },
};
