import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { tmdbService, isTmdbConfigured } from './tmdb';
import { storageService } from './storage';
import { hasAiredPacific } from '../utils/constants';

const LAST_REFRESH_KEY = '@upnext_last_metadata_refresh';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const THROTTLE_DELAY_MS = 400; // ~2.5 req/s, safely under TMDB 40/10s limit
const RATE_LIMIT_PAUSE_MS = 10_000; // Pause 10s on 429

export interface RefreshResult {
  showsRefreshed: number;
  moviesRefreshed: number;
  errors: string[];
  aborted: boolean;
}

type RefreshCallback = (result: RefreshResult) => void;

class MetadataRefreshService {
  private isRunning = false;
  private abortRequested = false;
  private onCompleteCallbacks: RefreshCallback[] = [];

  onComplete(callback: RefreshCallback): () => void {
    this.onCompleteCallbacks.push(callback);
    return () => {
      this.onCompleteCallbacks = this.onCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyComplete(result: RefreshResult) {
    for (const cb of this.onCompleteCallbacks) {
      try { cb(result); } catch { /* ignore callback errors */ }
    }
  }

  async getLastRefreshTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_REFRESH_KEY);
    } catch {
      return null;
    }
  }

  private async setLastRefreshTime(timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_REFRESH_KEY, timestamp);
    } catch { /* ignore storage errors */ }
  }

  async isStale(): Promise<boolean> {
    const last = await this.getLastRefreshTime();
    if (!last) return true;
    return Date.now() - new Date(last).getTime() > REFRESH_INTERVAL_MS;
  }

  abort() {
    this.abortRequested = true;
  }

  async refreshIfStale(): Promise<RefreshResult | null> {
    const stale = await this.isStale();
    if (!stale) return null;
    return this.refreshAll();
  }

  async refreshAll(): Promise<RefreshResult> {
    if (this.isRunning) {
      return { showsRefreshed: 0, moviesRefreshed: 0, errors: [], aborted: false };
    }
    if (!isTmdbConfigured()) {
      return { showsRefreshed: 0, moviesRefreshed: 0, errors: ['TMDB not configured'], aborted: false };
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { showsRefreshed: 0, moviesRefreshed: 0, errors: [], aborted: true };
    }

    this.isRunning = true;
    this.abortRequested = false;
    const result: RefreshResult = { showsRefreshed: 0, moviesRefreshed: 0, errors: [], aborted: false };

    try {
      // Refresh TV shows in watching/waiting status
      const showRows = await storageService.getShowsNeedingRefresh(['watching', 'waiting']);
      const tvShows = showRows.filter(s => s.media_type === 'tv' || !s.media_type);

      for (const show of tvShows) {
        if (this.abortRequested) { result.aborted = true; break; }
        try {
          await this.refreshShow(show.tmdb_id, show.total_seasons);
          result.showsRefreshed++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('429')) {
            await this.delay(RATE_LIMIT_PAUSE_MS);
            try {
              await this.refreshShow(show.tmdb_id, show.total_seasons);
              result.showsRefreshed++;
            } catch (retryErr) {
              result.errors.push(`Show ${show.tmdb_id}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
            }
          } else {
            result.errors.push(`Show ${show.tmdb_id}: ${msg}`);
          }
        }
        await this.delay(THROTTLE_DELAY_MS);
      }

      // Refresh movies in watchlist status
      if (!this.abortRequested) {
        const movieRows = await storageService.getShowsNeedingRefresh(['watchlist']);
        const movies = movieRows.filter(s => s.media_type === 'movie');

        for (const movie of movies) {
          if (this.abortRequested) { result.aborted = true; break; }
          try {
            await this.refreshMovie(movie.tmdb_id);
            result.moviesRefreshed++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('429')) {
              await this.delay(RATE_LIMIT_PAUSE_MS);
              try {
                await this.refreshMovie(movie.tmdb_id);
                result.moviesRefreshed++;
              } catch (retryErr) {
                result.errors.push(`Movie ${movie.tmdb_id}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
              }
            } else {
              result.errors.push(`Movie ${movie.tmdb_id}: ${msg}`);
            }
          }
          await this.delay(THROTTLE_DELAY_MS);
        }
      }

      if (!result.aborted) {
        await this.setLastRefreshTime(new Date().toISOString());
      }
    } finally {
      this.isRunning = false;
      this.notifyComplete(result);
    }

    return result;
  }

  private async refreshShow(tmdbId: number, currentTotalSeasons: number): Promise<void> {
    const details = await tmdbService.getShowDetails(tmdbId);
    const newTotalSeasons = details.number_of_seasons ?? 0;
    const newTotalEpisodes = details.number_of_episodes ?? 0;

    // Calculate aired episodes using seasons summary from details endpoint
    let airedEpisodes = 0;

    if (newTotalSeasons > 0) {
      // Sum episode counts from completed seasons (all assumed aired)
      if (details.seasons) {
        for (const s of details.seasons) {
          if (s.season_number === 0) continue; // Skip specials
          if (s.season_number < newTotalSeasons) {
            airedEpisodes += s.episode_count ?? 0;
          }
        }
      }

      // Fetch latest season for accurate aired count
      await this.delay(THROTTLE_DELAY_MS);
      const latestSeason = await tmdbService.getSeason(tmdbId, newTotalSeasons);
      if (latestSeason.episodes) {
        for (const ep of latestSeason.episodes) {
          if (hasAiredPacific(ep.air_date)) {
            airedEpisodes++;
          }
        }
      }
    }

    await storageService.updateShowMetadata(tmdbId, {
      totalSeasons: newTotalSeasons,
      totalEpisodes: newTotalEpisodes,
      airedEpisodes,
      posterPath: details.poster_path,
    });
  }

  private async refreshMovie(tmdbId: number): Promise<void> {
    const details = await tmdbService.getMovieDetails(tmdbId);
    await storageService.updateMovieMetadata(tmdbId, {
      releaseDate: details.release_date ?? null,
      runtime: details.runtime ?? null,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const metadataRefreshService = new MetadataRefreshService();
