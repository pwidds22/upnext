import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../utils/constants';
import { useStats } from '../hooks/useStats';
import { useSubscription } from '../contexts/SubscriptionContext';
import type { RootStackParamList } from '../types';
import HeroBanner from '../components/stats/HeroBanner';
import WatchingStreak from '../components/stats/WatchingStreak';
import LibraryOverview from '../components/stats/LibraryOverview';
import ReactionsSummary from '../components/stats/ReactionsSummary';
import StreamingBreakdown from '../components/stats/StreamingBreakdown';
import WatchTimeBreakdown from '../components/stats/WatchTimeBreakdown';
import ActivityCalendar from '../components/stats/ActivityCalendar';
import MostWatchedShows from '../components/stats/MostWatchedShows';
import MonthlyTrend from '../components/stats/MonthlyTrend';
import FunFacts from '../components/stats/FunFacts';
import LockedSection from '../components/stats/LockedSection';

export default function StatsScreen() {
  const { stats, loading, error, refresh } = useStats();
  const { isPremium } = useSubscription();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleUnlock = useCallback(() => {
    navigation.navigate('Paywall');
  }, [navigation]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    refresh();
    // Give a brief delay so the user sees the refresh indicator
    setTimeout(() => setRefreshing(false), 500);
  }, [refresh]);

  if (loading && !stats) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Crunching your stats...</Text>
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText}>Pull down to retry</Text>
      </View>
    );
  }

  if (!stats) return null;

  const hasNoData = stats.hero.totalEpisodesWatched === 0 && stats.hero.totalMoviesWatched === 0;

  if (hasNoData) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        <Ionicons name="stats-chart-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.emptyTitle}>No stats yet</Text>
        <Text style={styles.emptySubtitle}>
          Start tracking shows and movies to see your viewing stats here
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
    >
      {/* FREE: Hero Banner */}
      <HeroBanner stats={stats.hero} />

      {/* FREE: Watching Streak */}
      <WatchingStreak streak={stats.streak} />

      {/* FREE: Library Overview */}
      <LibraryOverview breakdown={stats.library} />

      {/* FREE: Episode Reactions */}
      {stats.reactions.total > 0 && (
        <ReactionsSummary reactions={stats.reactions} />
      )}

      {/* FREE: Streaming Services */}
      {stats.streaming.length > 0 && (
        <StreamingBreakdown services={stats.streaming} />
      )}

      {/* PREMIUM: Watch Time Breakdown */}
      <LockedSection isPremium={isPremium} title="Watch Time" onUnlock={handleUnlock}>
        <WatchTimeBreakdown watchTime={stats.watchTime} />
      </LockedSection>

      {/* PREMIUM: Activity Calendar */}
      <LockedSection isPremium={isPremium} title="Activity" onUnlock={handleUnlock}>
        <ActivityCalendar data={stats.activityCalendar} />
      </LockedSection>

      {/* PREMIUM: Most Watched Shows */}
      {stats.mostWatched.length > 0 && (
        <LockedSection isPremium={isPremium} title="Most Watched" onUnlock={handleUnlock}>
          <MostWatchedShows shows={stats.mostWatched} />
        </LockedSection>
      )}

      {/* PREMIUM: Monthly Trend */}
      {stats.monthlyTrend.length > 0 && (
        <LockedSection isPremium={isPremium} title="Monthly Trend" onUnlock={handleUnlock}>
          <MonthlyTrend data={stats.monthlyTrend} />
        </LockedSection>
      )}

      {/* PREMIUM: Fun Facts (first one free) */}
      {stats.funFacts.length > 0 && (
        <FunFacts facts={stats.funFacts} isPremium={isPremium} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
