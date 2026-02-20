import { storageService } from './storage';
import { tmdbService } from './tmdb';
import { isTmdbConfigured } from './tmdb';
import {
  HeroStats,
  StreakStats,
  LibraryBreakdownItem,
  ReactionsSummary,
  StreamingBreakdownItem,
  WatchTimeBreakdown,
  MostWatchedShow,
  MonthlyTrendItem,
  FunFact,
  MediaType,
} from '../types';

class StatsService {
  async getHeroStats(): Promise<HeroStats> {
    const [totalEpisodesWatched, totalMoviesWatched, epMinutes, movieMinutes] = await Promise.all([
      storageService.getStatsTotalEpisodesWatched(),
      storageService.getStatsTotalMoviesWatched(),
      storageService.getStatsEpisodeWatchTimeMinutes(),
      storageService.getStatsMovieWatchTimeMinutes(),
    ]);

    return {
      totalEpisodesWatched,
      totalMoviesWatched,
      totalWatchTimeMinutes: epMinutes + movieMinutes,
    };
  }

  async getStreakStats(): Promise<StreakStats> {
    const watchDates = await storageService.getStatsAllWatchDates();

    if (watchDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, recentDays: new Array(14).fill(false) };
    }

    const dateSet = new Set(watchDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Recent 14 days (newest first)
    const recentDays: boolean[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      recentDays.push(dateSet.has(dateStr));
    }

    // Current streak - walk backward from today
    let currentStreak = 0;
    const cursor = new Date(today);
    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (dateSet.has(dateStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak - walk through all dates sorted ascending
    const sortedDates = [...watchDates].sort();
    let longestStreak = 0;
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);

    return { currentStreak, longestStreak, recentDays };
  }

  async getLibraryBreakdown(): Promise<LibraryBreakdownItem[]> {
    const rows = await storageService.getStatsLibraryBreakdown();
    return rows.map(r => ({
      mediaType: (r.media_type ?? 'tv') as MediaType,
      status: r.status,
      count: r.count,
    }));
  }

  async getReactionsSummary(): Promise<ReactionsSummary> {
    const [rows, topEpisodes] = await Promise.all([
      storageService.getStatsReactionsSummary(),
      storageService.getStatsTopReactedEpisodes(5),
    ]);
    const summary: ReactionsSummary = { good: 0, meh: 0, bad: 0, total: 0, topEpisodes: [] };
    for (const row of rows) {
      if (row.reaction === 'good') summary.good = row.count;
      else if (row.reaction === 'meh') summary.meh = row.count;
      else if (row.reaction === 'bad') summary.bad = row.count;
    }
    summary.total = summary.good + summary.meh + summary.bad;
    summary.topEpisodes = topEpisodes.map(e => ({
      showTitle: e.show_title,
      seasonNumber: e.season_number,
      episodeNumber: e.episode_number,
      episodeTitle: e.episode_title,
      reaction: e.reaction as 'good' | 'meh' | 'bad',
    }));
    return summary;
  }

  async getStreamingBreakdown(): Promise<StreamingBreakdownItem[]> {
    const rawRows = await storageService.getStatsStreamingServices();
    const counts = new Map<string, number>();

    for (const raw of rawRows) {
      try {
        const services: string[] = JSON.parse(raw);
        for (const service of services) {
          if (service) {
            counts.set(service, (counts.get(service) ?? 0) + 1);
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return [...counts.entries()]
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getWatchTimeBreakdown(): Promise<WatchTimeBreakdown> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekISO = startOfWeek.toISOString();
    const monthISO = startOfMonth.toISOString();

    const [epWeek, movieWeek, epMonth, movieMonth, epAll, movieAll, busiestDay, firstDate] = await Promise.all([
      storageService.getStatsEpisodeWatchTimeForPeriod(weekISO),
      storageService.getStatsMovieWatchTimeForPeriod(weekISO),
      storageService.getStatsEpisodeWatchTimeForPeriod(monthISO),
      storageService.getStatsMovieWatchTimeForPeriod(monthISO),
      storageService.getStatsEpisodeWatchTimeMinutes(),
      storageService.getStatsMovieWatchTimeMinutes(),
      storageService.getStatsBusiestDayOfWeek(),
      storageService.getStatsFirstWatchDate(),
    ]);

    const allTimeMinutes = epAll + movieAll;

    // Calculate average per day
    let averagePerDayMinutes = 0;
    if (firstDate) {
      const firstMs = new Date(firstDate).getTime();
      const nowMs = Date.now();
      const totalDays = Math.max(1, Math.ceil((nowMs - firstMs) / (1000 * 60 * 60 * 24)));
      averagePerDayMinutes = Math.round(allTimeMinutes / totalDays);
    }

    return {
      thisWeekMinutes: epWeek + movieWeek,
      thisMonthMinutes: epMonth + movieMonth,
      allTimeMinutes,
      averagePerDayMinutes,
      busiestDayOfWeek: busiestDay.map(r => ({ day: r.dow, count: r.count })),
    };
  }

  async getActivityCalendar(days: number = 90): Promise<Map<string, number>> {
    const rows = await storageService.getStatsActivityCalendar(days);
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.d, row.count);
    }
    return map;
  }

  async getMostWatchedShows(limit: number = 5): Promise<MostWatchedShow[]> {
    const rows = await storageService.getStatsMostWatchedShows(limit);
    return rows.map(r => ({
      tmdbId: r.show_tmdb_id,
      title: r.title,
      posterPath: r.poster_path,
      watchedCount: r.watched_count,
      totalEpisodes: r.total_episodes,
    }));
  }

  async getMonthlyTrend(months: number = 12): Promise<MonthlyTrendItem[]> {
    const rows = await storageService.getStatsMonthlyTrend(months);
    return rows.map(r => ({ month: r.month, count: r.count }));
  }

  async getFunFacts(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    // Biggest single-day binge
    const biggestDay = await storageService.getStatsBiggestBingeDay();
    if (biggestDay && biggestDay.count >= 3) {
      const date = new Date(biggestDay.d);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      facts.push({
        icon: 'flame',
        text: `Your biggest binge: ${biggestDay.count} episodes on ${dateStr}`,
      });
    }

    // Fastest binge (completed shows)
    const binges = await storageService.getStatsFastestBinge();
    if (binges.length > 0) {
      let fastest: { title: string; eps: number; days: number } | null = null;
      for (const b of binges) {
        const firstDate = new Date(b.first);
        const lastDate = new Date(b.last);
        const days = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (!fastest || days < fastest.days || (days === fastest.days && b.eps > fastest.eps)) {
          fastest = { title: b.title, eps: b.eps, days };
        }
      }
      if (fastest && fastest.days <= 14) {
        facts.push({
          icon: 'rocket',
          text: fastest.days <= 1
            ? `Speed run! You finished ${fastest.title} (${fastest.eps} episodes) in a single day`
            : `You binged ${fastest.title} (${fastest.eps} episodes) in just ${fastest.days} days`,
        });
      }
    }

    // Most rewatched show
    const mostRewatched = await storageService.getStatsMostRewatchedShow();
    if (mostRewatched && mostRewatched.rewatch_count >= 2) {
      facts.push({
        icon: 'repeat',
        text: `You've rewatched ${mostRewatched.rewatch_count} episodes of ${mostRewatched.title}`,
      });
    }

    return facts;
  }

  private backfillInProgress = false;

  async backfillShowRuntimes(): Promise<void> {
    if (this.backfillInProgress || !isTmdbConfigured()) return;
    this.backfillInProgress = true;

    try {
      const showIds = await storageService.getStatsShowsWithNullRuntime();
      if (showIds.length === 0) return;

      // Process in batches of 5 to avoid hammering the API
      const batchSize = 5;
      for (let i = 0; i < showIds.length; i += batchSize) {
        const batch = showIds.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (tmdbId) => {
            const detail = await tmdbService.getShowDetails(tmdbId);
            const runTimes = detail.episode_run_time;
            if (runTimes && runTimes.length > 0) {
              const avgRuntime = Math.round(
                runTimes.reduce((s, r) => s + r, 0) / runTimes.length
              );
              await storageService.updateShowRuntime(tmdbId, avgRuntime);
            }
          })
        );
        // Small delay between batches
        if (i + batchSize < showIds.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (e) {
      console.error('Runtime backfill error:', e);
    } finally {
      this.backfillInProgress = false;
    }
  }
}

export const statsService = new StatsService();
