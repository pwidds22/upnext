import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { statsService } from '../services/statsService';
import {
  StatsData,
  HeroStats,
  StreakStats,
  LibraryBreakdownItem,
  ReactionsSummary,
  StreamingBreakdownItem,
  WatchTimeBreakdown,
  MostWatchedShow,
  MonthlyTrendItem,
  FunFact,
} from '../types';

interface UseStatsReturn {
  stats: StatsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const CACHE_TTL_MS = 30_000; // 30 seconds

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedRef = useRef<number>(0);

  const loadStats = useCallback(async (force: boolean = false) => {
    // Skip if cached and not stale
    if (!force && stats && Date.now() - lastLoadedRef.current < CACHE_TTL_MS) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Stage 1: Hero stats (fast)
      const hero = await statsService.getHeroStats();
      setStats(prev => prev ? { ...prev, hero } : createInitialStats(hero));

      // Stage 2: Library + Reactions (fast)
      const [library, reactions] = await Promise.all([
        statsService.getLibraryBreakdown(),
        statsService.getReactionsSummary(),
      ]);
      setStats(prev => prev ? { ...prev, library, reactions } : null);

      // Stage 3: Streak + Streaming + Monthly trend
      const [streak, streaming, monthlyTrend] = await Promise.all([
        statsService.getStreakStats(),
        statsService.getStreamingBreakdown(),
        statsService.getMonthlyTrend(),
      ]);
      setStats(prev => prev ? { ...prev, streak, streaming, monthlyTrend } : null);

      // Stage 4: Watch time + Calendar + Most watched + Fun facts
      const [watchTime, activityCalendar, mostWatched, funFacts] = await Promise.all([
        statsService.getWatchTimeBreakdown(),
        statsService.getActivityCalendar(),
        statsService.getMostWatchedShows(),
        statsService.getFunFacts(),
      ]);
      setStats(prev => prev ? { ...prev, watchTime, activityCalendar, mostWatched, funFacts } : null);

      lastLoadedRef.current = Date.now();

      // Trigger runtime backfill in the background (non-blocking)
      statsService.backfillShowRuntimes().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [stats]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const refresh = useCallback(() => {
    loadStats(true);
  }, [loadStats]);

  return { stats, loading, error, refresh };
}

function createInitialStats(hero: HeroStats): StatsData {
  return {
    hero,
    streak: { currentStreak: 0, longestStreak: 0, recentDays: new Array(14).fill(false) },
    library: [],
    reactions: { good: 0, meh: 0, bad: 0, total: 0, topEpisodes: [] },
    streaming: [],
    watchTime: {
      thisWeekMinutes: 0,
      thisMonthMinutes: 0,
      allTimeMinutes: 0,
      averagePerDayMinutes: 0,
      busiestDayOfWeek: [],
    },
    activityCalendar: new Map(),
    mostWatched: [],
    monthlyTrend: [],
    funFacts: [],
  };
}
