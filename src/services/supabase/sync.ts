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
  TrackedMovie,
  ShowStatus,
  MovieStatus,
  WatchedEpisode,
  EpisodeReaction,
  EpisodeReactionType,
  DismissedShow,
  EpisodeWatchHistory,
  MovieWatchHistory,
  UserShowRow,
  UserWatchedEpisodeRow,
  UserEpisodeReactionRow,
  UserDismissedShowRow,
  UserEpisodeWatchHistoryRow,
  UserMovieWatchHistoryRow,
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
      result.errors.push(error instanceof Error ? error.message : 'Sync failed');
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
      // Push local shows that don't exist remotely, resolve conflicts
      const showsToPush: TrackedShow[] = [];
      const remoteWinningShows: TrackedShow[] = [];
      for (const localShow of localShows) {
        const remoteShow = remoteShowsMap.get(localShow.tmdbId);
        if (!remoteShow) {
          showsToPush.push(localShow);
        } else {
          // Conflict: both exist, use last-write-wins
          const winner = resolveConflict(localShow.lastSyncedAt, remoteShow.lastSyncedAt);
          if (winner === 'local') {
            showsToPush.push(localShow);
          } else {
            remoteWinningShows.push(remoteShow);
          }
          result.conflicts++;
        }
      }

      if (showsToPush.length > 0) {
        await withRetry(() => showsCloudService.upsertShows(userId, showsToPush));
        result.pushed.shows = showsToPush.length;
      }

      // Apply remote-winning conflict updates to local
      for (const remoteShow of remoteWinningShows) {
        await storageService.addShow(remoteShow);
        await storageService.updateShowSyncStatus(remoteShow.tmdbId, 'synced', remoteShow.remoteId);
        result.pulled.shows++;
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
      // Push local episodes that don't exist remotely, resolve conflicts
      const episodesToPush: WatchedEpisode[] = [];
      const remoteWinningEpisodes: WatchedEpisode[] = [];
      for (const localEp of localEpisodes) {
        const remoteEp = remoteEpisodesMap.get(localEp.id);
        if (!remoteEp) {
          episodesToPush.push(localEp);
        } else {
          // Conflict: both exist, use last-write-wins
          const winner = resolveConflict(localEp.lastSyncedAt, remoteEp.lastSyncedAt);
          if (winner === 'local') {
            episodesToPush.push(localEp);
          } else {
            remoteWinningEpisodes.push(remoteEp);
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

      // Apply remote-winning episode conflict updates to local
      for (const remoteEp of remoteWinningEpisodes) {
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

      // Step 5: Sync movies
      const localMovies = await storageService.getAllMovies();
      const remoteMovies = await showsCloudService.fetchAllMovies(userId);
      const remoteMoviesMap = new Map(remoteMovies.map((m) => [m.tmdbId, m]));
      const localMoviesMap = new Map(localMovies.map((m) => [m.tmdbId, m]));

      // Push local-only movies, resolve conflicts
      const moviesToPush: TrackedMovie[] = [];
      const remoteWinningMovies: TrackedMovie[] = [];
      for (const localMovie of localMovies) {
        const remoteMovie = remoteMoviesMap.get(localMovie.tmdbId);
        if (!remoteMovie) {
          moviesToPush.push(localMovie);
        } else {
          const winner = resolveConflict(localMovie.lastSyncedAt, remoteMovie.lastSyncedAt);
          if (winner === 'local') {
            moviesToPush.push(localMovie);
          } else {
            remoteWinningMovies.push(remoteMovie);
          }
          result.conflicts++;
        }
      }
      if (moviesToPush.length > 0) {
        for (const movie of moviesToPush) {
          await showsCloudService.upsertMovie(userId, movie);
        }
      }

      // Apply remote-winning movie conflict updates to local
      for (const remoteMovie of remoteWinningMovies) {
        await storageService.addMovie(remoteMovie);
        await storageService.updateShowSyncStatus(remoteMovie.tmdbId, 'synced', remoteMovie.remoteId);
      }

      // Pull remote-only movies
      for (const remoteMovie of remoteMovies) {
        if (!localMoviesMap.has(remoteMovie.tmdbId)) {
          await storageService.addMovie(remoteMovie);
          await storageService.updateShowSyncStatus(remoteMovie.tmdbId, 'synced', remoteMovie.remoteId);
        }
      }

      // Step 6: Sync episode reactions
      const localReactions = await storageService.getAllEpisodeReactions();
      const remoteReactions = await episodeReactionsCloudService.fetchAllReactions(userId);
      const remoteReactionsMap = new Map(
        remoteReactions.map((r) => [`${r.showTmdbId}-${r.seasonNumber}-${r.episodeNumber}`, r])
      );
      const localReactionsMap = new Map(
        localReactions.map((r) => [`${r.showTmdbId}-${r.seasonNumber}-${r.episodeNumber}`, r])
      );

      // Push local-only reactions
      for (const localReaction of localReactions) {
        const key = `${localReaction.showTmdbId}-${localReaction.seasonNumber}-${localReaction.episodeNumber}`;
        if (!remoteReactionsMap.has(key)) {
          await episodeReactionsCloudService.upsertReaction(userId, localReaction);
        }
      }

      // Pull remote-only reactions
      for (const remoteReaction of remoteReactions) {
        const key = `${remoteReaction.showTmdbId}-${remoteReaction.seasonNumber}-${remoteReaction.episodeNumber}`;
        if (!localReactionsMap.has(key)) {
          await storageService.setReaction(
            remoteReaction.showTmdbId,
            remoteReaction.seasonNumber,
            remoteReaction.episodeNumber,
            remoteReaction.reaction
          );
        }
      }

      // Step 7: Sync dismissed shows
      const localDismissedShows = await storageService.getAllDismissedShows();
      const remoteDismissed = await dismissedShowsCloudService.fetchAllDismissed(userId);
      const remoteDismissedMap = new Map(remoteDismissed.map((d) => [d.tmdbId, d]));
      const localDismissedMap = new Map(localDismissedShows.map((d) => [d.tmdbId, d]));

      // Push local-only dismissals
      for (const localDismissed of localDismissedShows) {
        if (!remoteDismissedMap.has(localDismissed.tmdbId)) {
          await dismissedShowsCloudService.upsertDismissed(userId, {
            id: `dismissed-${localDismissed.tmdbId}`,
            tmdbId: localDismissed.tmdbId,
            dismissedAt: localDismissed.dismissedAt,
          });
        }
      }

      // Pull remote-only dismissals
      for (const remoteDismissedShow of remoteDismissed) {
        if (!localDismissedMap.has(remoteDismissedShow.tmdbId)) {
          await storageService.dismissShow(remoteDismissedShow.tmdbId);
        }
      }

      // Step 8: Sync episode watch history
      const localEpHistory = await storageService.getAllEpisodeWatchHistory();
      const remoteEpHistory = await episodeWatchHistoryService.fetchAllWatchHistory(userId);
      const localEpHistoryIds = new Set(localEpHistory.map((h) => h.id));
      const remoteEpHistoryLocalIds = new Set(
        remoteEpHistory.map((h) => h.id).filter(Boolean)
      );

      // Push local-only episode watch history
      const epHistoryToPush = localEpHistory.filter((h) => !remoteEpHistoryLocalIds.has(h.id));
      if (epHistoryToPush.length > 0) {
        await episodeWatchHistoryService.insertWatches(userId, epHistoryToPush);
      }

      // Pull remote-only episode watch history
      for (const remoteWatch of remoteEpHistory) {
        if (!localEpHistoryIds.has(remoteWatch.id)) {
          await storageService.addEpisodeWatchHistory(
            remoteWatch.showTmdbId,
            remoteWatch.seasonNumber,
            remoteWatch.episodeNumber,
            remoteWatch.watchedAt,
            remoteWatch.episodeTitle
          );
        }
      }

      // Step 9: Sync movie watch history
      const localMovieHistory = await storageService.getAllMovieWatchHistory();
      const remoteMovieHistory = await movieWatchHistoryService.fetchAllWatchHistory(userId);
      const localMovieHistoryIds = new Set(localMovieHistory.map((h) => h.id));
      const remoteMovieHistoryLocalIds = new Set(
        remoteMovieHistory.map((h) => h.id).filter(Boolean)
      );

      // Push local-only movie watch history
      const movieHistoryToPush = localMovieHistory.filter(
        (h) => !remoteMovieHistoryLocalIds.has(h.id)
      );
      if (movieHistoryToPush.length > 0) {
        await movieWatchHistoryService.insertWatches(userId, movieHistoryToPush);
      }

      // Pull remote-only movie watch history
      for (const remoteWatch of remoteMovieHistory) {
        if (!localMovieHistoryIds.has(remoteWatch.id)) {
          await storageService.addMovieWatchHistory(
            remoteWatch.movieTmdbId,
            remoteWatch.watchedAt
          );
        }
      }

      // Step 10: Clear sync queue and update timestamp
      await storageService.clearSyncQueue();
      await this.setLastSyncTime(new Date().toISOString());

      // Mark all local shows as synced
      for (const show of localShows) {
        const remoteId = (await showsCloudService.getShowRemoteId(userId, show.tmdbId, 'tv')) ?? undefined;
        await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteId);
      }

      // Mark all local movies as synced
      for (const movie of localMovies) {
        const remoteId = (await showsCloudService.getShowRemoteId(userId, movie.tmdbId, 'movie')) ?? undefined;
        await storageService.updateShowSyncStatus(movie.tmdbId, 'synced', remoteId);
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Sync failed');
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
        const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
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
    const [
      remoteShowChanges,
      remoteEpisodeChanges,
      remoteReactionChanges,
      remoteDismissedChanges,
      remoteEpHistoryChanges,
      remoteMovieHistoryChanges,
    ] = await Promise.all([
      showsCloudService.fetchShowsSince(userId, since),
      episodesCloudService.fetchEpisodesSince(userId, since),
      episodeReactionsCloudService.fetchReactionsSince(userId, since),
      dismissedShowsCloudService.fetchDismissedSince(userId, since),
      episodeWatchHistoryService.fetchWatchHistorySince(userId, since),
      movieWatchHistoryService.fetchWatchHistorySince(userId, since),
    ]);

    // Apply show/movie changes (fetchShowsSince returns all media types)
    for (const remoteRow of remoteShowChanges) {
      const isMovie = remoteRow.media_type === 'movie';

      if (remoteRow.deleted_at) {
        const queueId = isMovie ? `movie-${remoteRow.tmdb_id}` : remoteRow.tmdb_id.toString();
        if (isMovie) {
          await storageService.deleteMovie(remoteRow.tmdb_id);
        } else {
          await storageService.deleteShow(remoteRow.tmdb_id);
        }
        await this.removeFromQueueIfExists('tracked_shows', queueId, 'delete');
        await this.removeFromQueueIfExists('tracked_shows', queueId, 'create');
        await this.removeFromQueueIfExists('tracked_shows', queueId, 'update');
        pulled.shows++;
        continue;
      }

      if (isMovie) {
        const movieQueueId = `movie-${remoteRow.tmdb_id}`;
        const localMovie = await storageService.getMovie(remoteRow.tmdb_id);
        if (!localMovie) {
          const movie = this.rowToTrackedMovie(remoteRow);
          await storageService.addMovie(movie);
          await this.removeFromQueueIfExists('tracked_shows', movieQueueId, 'create');
          pulled.shows++;
        } else {
          const winner = resolveConflict(localMovie.lastSyncedAt, remoteRow.updated_at);
          if (winner === 'remote') {
            const movie = this.rowToTrackedMovie(remoteRow);
            await storageService.addMovie(movie);
            await this.removeFromQueueIfExists('tracked_shows', movieQueueId, 'create');
            await this.removeFromQueueIfExists('tracked_shows', movieQueueId, 'update');
            pulled.shows++;
          }
          conflicts++;
        }
      } else {
        const localShow = await storageService.getShow(remoteRow.tmdb_id);
        if (!localShow) {
          const show = this.rowToTrackedShow(remoteRow);
          await storageService.addShow(show);
          await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteRow.id);
          await this.removeFromQueueIfExists('tracked_shows', remoteRow.tmdb_id.toString(), 'create');
          pulled.shows++;
        } else {
          const winner = resolveConflict(localShow.lastSyncedAt, remoteRow.updated_at);
          if (winner === 'remote') {
            const show = this.rowToTrackedShow(remoteRow);
            await storageService.addShow(show);
            await storageService.updateShowSyncStatus(show.tmdbId, 'synced', remoteRow.id);
            await this.removeFromQueueIfExists('tracked_shows', remoteRow.tmdb_id.toString(), 'create');
            await this.removeFromQueueIfExists('tracked_shows', remoteRow.tmdb_id.toString(), 'update');
            pulled.shows++;
          }
          conflicts++;
        }
      }
    }

    // Apply episode changes
    for (const remoteRow of remoteEpisodeChanges) {
      const episodeId = `${remoteRow.tmdb_show_id}-${remoteRow.season_number}-${remoteRow.episode_number}`;

      if (remoteRow.deleted_at) {
        await storageService.markEpisodeUnwatched(
          remoteRow.tmdb_show_id,
          remoteRow.season_number,
          remoteRow.episode_number
        );
        await this.removeFromQueueIfExists('watched_episodes', episodeId, 'delete');
        await this.removeFromQueueIfExists('watched_episodes', episodeId, 'create');
        await this.removeFromQueueIfExists('watched_episodes', episodeId, 'update');
        pulled.episodes++;
        continue;
      }

      await storageService.markEpisodeWatched({
        showTmdbId: remoteRow.tmdb_show_id,
        seasonNumber: remoteRow.season_number,
        episodeNumber: remoteRow.episode_number,
        watchedAt: remoteRow.watched_at,
        episodeTitle: remoteRow.episode_title ?? undefined,
        stillPath: remoteRow.still_path ?? undefined,
      });
      // markEpisodeWatched queues 'create' or 'update' depending on whether episode existed
      await this.removeFromQueueIfExists('watched_episodes', episodeId, 'create');
      await this.removeFromQueueIfExists('watched_episodes', episodeId, 'update');
      pulled.episodes++;
    }

    // Apply reaction changes
    for (const remoteRow of remoteReactionChanges) {
      const reactionId = `${remoteRow.tmdb_show_id}-${remoteRow.season_number}-${remoteRow.episode_number}-reaction`;

      if (remoteRow.deleted_at) {
        await storageService.removeReaction(
          remoteRow.tmdb_show_id,
          remoteRow.season_number,
          remoteRow.episode_number
        );
        await this.removeFromQueueIfExists('episode_reactions', reactionId, 'delete');
        await this.removeFromQueueIfExists('episode_reactions', reactionId, 'create');
        await this.removeFromQueueIfExists('episode_reactions', reactionId, 'update');
        continue;
      }

      await storageService.setReaction(
        remoteRow.tmdb_show_id,
        remoteRow.season_number,
        remoteRow.episode_number,
        remoteRow.reaction as EpisodeReactionType
      );
      // setReaction queues 'create' or 'update' depending on whether reaction existed
      await this.removeFromQueueIfExists('episode_reactions', reactionId, 'create');
      await this.removeFromQueueIfExists('episode_reactions', reactionId, 'update');
    }

    // Apply dismissed show changes
    for (const remoteRow of remoteDismissedChanges) {
      if (remoteRow.deleted_at) {
        await storageService.undismissShow(remoteRow.tmdb_id);
        await this.removeFromQueueIfExists('dismissed_shows', `dismissed-${remoteRow.tmdb_id}`, 'delete');
        await this.removeFromQueueIfExists('dismissed_shows', `dismissed-${remoteRow.tmdb_id}`, 'create');
        await this.removeFromQueueIfExists('dismissed_shows', `dismissed-${remoteRow.tmdb_id}`, 'update');
        continue;
      }

      await storageService.dismissShow(remoteRow.tmdb_id);
      // dismissShow queues 'create' or 'update' depending on whether it existed
      await this.removeFromQueueIfExists('dismissed_shows', `dismissed-${remoteRow.tmdb_id}`, 'create');
      await this.removeFromQueueIfExists('dismissed_shows', `dismissed-${remoteRow.tmdb_id}`, 'update');
    }

    // Apply episode watch history changes
    for (const remoteRow of remoteEpHistoryChanges) {
      if (remoteRow.deleted_at) {
        if (remoteRow.local_id) {
          await storageService.deleteEpisodeWatch(remoteRow.local_id);
          await this.removeFromQueueIfExists('episode_watch_history', remoteRow.local_id, 'delete');
          await this.removeFromQueueIfExists('episode_watch_history', remoteRow.local_id, 'create');
          await this.removeFromQueueIfExists('episode_watch_history', remoteRow.local_id, 'update');
        } else {
          console.warn(`Cannot delete episode watch history: remote row missing local_id (remote id: ${remoteRow.id})`);
        }
        continue;
      }

      await storageService.addEpisodeWatchHistory(
        remoteRow.tmdb_show_id,
        remoteRow.season_number,
        remoteRow.episode_number,
        remoteRow.watched_at,
        remoteRow.episode_title ?? undefined
      );
      if (remoteRow.local_id) {
        await this.removeFromQueueIfExists('episode_watch_history', remoteRow.local_id, 'create');
        await this.removeFromQueueIfExists('episode_watch_history', remoteRow.local_id, 'update');
      }
    }

    // Apply movie watch history changes
    for (const remoteRow of remoteMovieHistoryChanges) {
      if (remoteRow.deleted_at) {
        if (remoteRow.local_id) {
          await storageService.deleteMovieWatch(remoteRow.local_id);
          await this.removeFromQueueIfExists('movie_watch_history', remoteRow.local_id, 'delete');
          await this.removeFromQueueIfExists('movie_watch_history', remoteRow.local_id, 'create');
          await this.removeFromQueueIfExists('movie_watch_history', remoteRow.local_id, 'update');
        } else {
          console.warn(`Cannot delete movie watch history: remote row missing local_id (remote id: ${remoteRow.id})`);
        }
        continue;
      }

      await storageService.addMovieWatchHistory(
        remoteRow.tmdb_movie_id,
        remoteRow.watched_at
      );
      if (remoteRow.local_id) {
        await this.removeFromQueueIfExists('movie_watch_history', remoteRow.local_id, 'create');
        await this.removeFromQueueIfExists('movie_watch_history', remoteRow.local_id, 'update');
      }
    }

    return { pulled, conflicts };
  },

  // Process a single sync queue item
  async processSyncQueueItem(userId: string, item: SyncQueueItem): Promise<void> {
    let payload;
    try {
      payload = JSON.parse(item.payload);
    } catch (e) {
      console.error('Malformed sync queue payload, skipping item:', item.id, e);
      return;
    }

    if (item.tableName === 'tracked_shows') {
      switch (item.operation) {
        case 'create':
        case 'update': {
          if (payload.mediaType === 'movie') {
            const movie = payload as TrackedMovie;
            const result = await withRetry(() => showsCloudService.upsertMovie(userId, movie));
            await storageService.updateShowSyncStatus(movie.tmdbId, 'synced', result.id);
          } else {
            const show = payload as TrackedShow;
            const result = await withRetry(() => showsCloudService.upsertShow(userId, show));
            await storageService.updateShowSyncStatus(show.tmdbId, 'synced', result.id);
          }
          break;
        }
        case 'delete': {
          const { tmdbId, mediaType } = payload;
          if (mediaType === 'movie') {
            await withRetry(() => showsCloudService.softDeleteMovie(userId, tmdbId));
          } else {
            await withRetry(() => showsCloudService.softDeleteShow(userId, tmdbId));
            // Also soft-delete episodes and reactions for this show
            await withRetry(() => episodesCloudService.softDeleteShowEpisodes(userId, tmdbId));
            await withRetry(() => episodeReactionsCloudService.softDeleteShowReactions(userId, tmdbId));
          }
          break;
        }
      }
    } else if (item.tableName === 'watched_episodes') {
      switch (item.operation) {
        case 'create': {
          const episode = payload as WatchedEpisode;
          // Get the user_show_id for this episode's show
          const userShowId = await showsCloudService.getShowRemoteId(userId, episode.showTmdbId, 'tv');
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
          const { id } = payload;
          await withRetry(() => episodeWatchHistoryService.softDeleteWatchByLocalId(userId, id));
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
          const { id } = payload;
          await withRetry(() => movieWatchHistoryService.softDeleteWatchByLocalId(userId, id));
          break;
        }
      }
    }
  },

  // Helper to get all local episodes across all shows
  async getAllLocalEpisodes(): Promise<WatchedEpisode[]> {
    return storageService.getAllWatchedEpisodes();
  },

  // Helper to remove an item from sync queue if it exists (direct SQL, no full queue load)
  async removeFromQueueIfExists(tableName: string, recordId: string, operation: string): Promise<void> {
    await storageService.removeSyncQueueItemByKey(tableName, recordId, operation);
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

  // Convert Supabase row to TrackedMovie
  rowToTrackedMovie(row: UserShowRow): TrackedMovie {
    return {
      mediaType: 'movie',
      tmdbId: row.tmdb_id,
      title: row.title,
      posterPath: row.poster_path,
      status: row.status as MovieStatus,
      addedAt: row.added_at,
      releaseDate: row.release_date,
      runtime: row.runtime,
      streamingServices: row.streaming_services ?? [],
      syncStatus: 'synced',
      remoteId: row.id,
      lastSyncedAt: row.synced_at,
    };
  },
};
