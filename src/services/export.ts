import { Paths, File } from 'expo-file-system';
import { storageService } from './storage';
import { ratingsService } from './supabase/ratings';
import { followsService } from './supabase/follows';
import { ExportData, ExportStats, ExportRating } from '../types';

export const exportService = {
  /**
   * Collect all user data for export
   * @param userId - Optional user ID for fetching cloud-only data (ratings)
   */
  async collectExportData(userId?: string): Promise<ExportData> {
    // Fetch all local data in parallel
    const [
      shows,
      movies,
      watchedEpisodes,
      reactions,
      episodeHistory,
      movieHistory,
      dismissedShows,
      dismissedMovies,
    ] = await Promise.all([
      storageService.getAllShows(),
      storageService.getAllMovies(),
      storageService.getAllWatchedEpisodes(),
      storageService.getAllEpisodeReactions(),
      storageService.getAllEpisodeWatchHistory(),
      storageService.getAllMovieWatchHistory(),
      storageService.getAllDismissedShows(),
      storageService.getAllDismissedMovies(),
    ]);

    // Fetch cloud data if user is signed in
    let ratings: ExportRating[] | undefined;
    let username: string | undefined;

    if (userId) {
      // Fetch ratings (cloud-only)
      try {
        const userRatings = await ratingsService.getUserRatings(userId);
        ratings = userRatings.map((r) => ({
          tmdbId: r.tmdb_id,
          ratingType: r.rating_type,
          seasonNumber: r.season_number ?? undefined,
          episodeNumber: r.episode_number ?? undefined,
          rating: r.rating,
          review: r.review ?? undefined,
          isPublic: r.is_public,
          createdAt: r.created_at,
        }));
      } catch (e) {
        console.error('Failed to fetch ratings for export:', e);
      }

      // Fetch username from profile
      try {
        const profile = await followsService.getUserProfile(userId);
        username = profile?.username ?? undefined;
      } catch (e) {
        console.error('Failed to fetch profile for export:', e);
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      formatVersion: '1.0',
      user: userId ? { id: userId, username } : undefined,
      shows,
      movies,
      watchedEpisodes,
      episodeReactions: reactions,
      episodeWatchHistory: episodeHistory,
      movieWatchHistory: movieHistory,
      dismissedShows,
      dismissedMovies,
      ratings,
    };
  },

  /**
   * Get export stats for preview
   */
  async getExportStats(userId?: string): Promise<ExportStats> {
    const data = await this.collectExportData(userId);
    return {
      showsCount: data.shows.length,
      moviesCount: data.movies.length,
      watchedEpisodesCount: data.watchedEpisodes.length,
      episodeReactionsCount: data.episodeReactions.length,
      episodeWatchHistoryCount: data.episodeWatchHistory.length,
      movieWatchHistoryCount: data.movieWatchHistory.length,
      dismissedShowsCount: data.dismissedShows.length,
      dismissedMoviesCount: data.dismissedMovies.length,
      ratingsCount: data.ratings?.length ?? 0,
    };
  },

  /**
   * Export data to a JSON file
   * @returns The file path of the exported file
   */
  async exportToFile(data: ExportData): Promise<string> {
    const json = JSON.stringify(data, null, 2);
    const fileName = `upnext-export-${Date.now()}.json`;

    // Create file in document directory using new expo-file-system API
    const file = new File(Paths.document, fileName);
    await file.write(json);

    return file.uri;
  },
};
