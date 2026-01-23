import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TrackedShow, RootStackParamList, ShowStatus } from '../types';
import { storageService } from '../services/storage';
import ShowPoster from '../components/ShowPoster';
import { COLORS, STATUS_CONFIG } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ShowWithProgress extends TrackedShow {
  watchedCount: number;
}

export default function MyShowsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [shows, setShows] = useState<ShowWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadShows = useCallback(async () => {
    try {
      const allShows = await storageService.getAllShows();

      // Get watched counts for each show
      const showsWithProgress: ShowWithProgress[] = await Promise.all(
        allShows.map(async (show) => {
          const watchedCount = await storageService.getWatchedCount(show.tmdbId);
          return { ...show, watchedCount };
        })
      );

      setShows(showsWithProgress);
    } catch (e) {
      console.error('Failed to load shows:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadShows();
    }, [loadShows])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadShows();
  }, [loadShows]);

  const sections = [
    {
      title: 'Watching',
      status: 'watching' as ShowStatus,
      data: shows.filter((s) => s.status === 'watching'),
    },
    {
      title: 'Waiting',
      status: 'waiting' as ShowStatus,
      data: shows.filter((s) => s.status === 'waiting'),
    },
    {
      title: 'Watchlist',
      status: 'watchlist' as ShowStatus,
      data: shows.filter((s) => s.status === 'watchlist'),
    },
    {
      title: 'Completed',
      status: 'completed' as ShowStatus,
      data: shows.filter((s) => s.status === 'completed'),
    },
    {
      title: 'Dropped',
      status: 'dropped' as ShowStatus,
      data: shows.filter((s) => s.status === 'dropped'),
    },
  ].filter((section) => section.data.length > 0);

  const renderItem = useCallback(
    ({ item }: { item: ShowWithProgress }) => {
      // Use aired episodes if available, otherwise fall back to total
      const displayTotal = item.airedEpisodes ?? item.totalEpisodes;
      const progress = displayTotal > 0 ? item.watchedCount / displayTotal : 0;
      const progressText =
        displayTotal > 0
          ? `${item.watchedCount}/${displayTotal} episodes`
          : `${item.watchedCount} watched`;

      return (
        <TouchableOpacity
          style={styles.showCard}
          onPress={() => navigation.navigate('ShowDetail', { show: item })}
          activeOpacity={0.7}
        >
          <ShowPoster path={item.posterPath} size="small" width={80} height={120} />

          <View style={styles.showInfo}>
            <Text style={styles.showTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <Text style={styles.progressText}>{progressText}</Text>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(progress * 100, 100)}%`,
                    backgroundColor: STATUS_CONFIG[item.status].color,
                  },
                ]}
              />
            </View>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${STATUS_CONFIG[item.status].color}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: STATUS_CONFIG[item.status].color }]}>
                {STATUS_CONFIG[item.status].label}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; data: ShowWithProgress[] } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    ),
    []
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="tv-outline" size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No Shows Yet</Text>
      <Text style={styles.emptyText}>Search for shows to add to your watchlist</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {shows.length === 0 && !loading ? (
        renderEmpty()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.tmdbId.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  showCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 12,
  },
  showInfo: {
    flex: 1,
    gap: 6,
  },
  showTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
