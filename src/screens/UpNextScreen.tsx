import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, TrackedShow, UpNextEpisode } from '../types';
import { storageService } from '../services/storage';
import { tmdbService } from '../services/tmdb';
import ShowPoster from '../components/ShowPoster';
import { COLORS, formatEpisodeCode, getCountdownText, hasAiredPacific } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function UpNextScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [readyToWatch, setReadyToWatch] = useState<UpNextEpisode[]>([]);
  const [comingSoon, setComingSoon] = useState<UpNextEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUpNext = useCallback(async () => {
    try {
      setError(null);
      const watchingShows = await storageService.getShowsByStatus('watching');

      const ready: UpNextEpisode[] = [];
      const upcoming: UpNextEpisode[] = [];

      for (const show of watchingShows) {
        try {
          const nextEp = await findNextEpisode(show);
          if (nextEp) {
            if (nextEp.isUpcoming) {
              upcoming.push(nextEp);
            } else {
              ready.push(nextEp);
            }
          }
        } catch (e) {
          console.error(`Failed to find next episode for ${show.title}:`, e);
        }
      }

      // Sort ready by show title
      ready.sort((a, b) => a.show.title.localeCompare(b.show.title));

      // Sort upcoming by air date
      upcoming.sort((a, b) => {
        if (!a.airDate) return 1;
        if (!b.airDate) return -1;
        return new Date(a.airDate).getTime() - new Date(b.airDate).getTime();
      });

      setReadyToWatch(ready);
      setComingSoon(upcoming);
    } catch (e) {
      console.error('Failed to load up next:', e);
      setError('Failed to load your shows. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Find next unwatched episode for a show
  const findNextEpisode = async (show: TrackedShow): Promise<UpNextEpisode | null> => {
    if (show.totalSeasons === 0) return null;

    const watchedEpisodes = await storageService.getWatchedEpisodes(show.tmdbId);
    const watchedSet = new Set(
      watchedEpisodes.map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
    );

    // Find highest watched to start search
    let startSeason = 1;
    let startEpisode = 1;

    if (watchedEpisodes.length > 0) {
      const sorted = watchedEpisodes.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
        return a.episodeNumber - b.episodeNumber;
      });
      const last = sorted[sorted.length - 1];
      startSeason = last.seasonNumber;
      startEpisode = last.episodeNumber + 1;
    }

    // Search through seasons
    for (let season = startSeason; season <= show.totalSeasons; season++) {
      try {
        const seasonData = await tmdbService.getSeason(show.tmdbId, season);
        if (!seasonData.episodes) continue;

        const episodeStart = season === startSeason ? startEpisode : 1;

        for (const episode of seasonData.episodes) {
          if (episode.episode_number < episodeStart) continue;

          const key = `${season}-${episode.episode_number}`;
          if (!watchedSet.has(key)) {
            // If no air date, treat as upcoming (we don't know when it airs)
            // If air date exists and has aired (Pacific Time), it's ready to watch
            // If air date exists and hasn't aired yet, it's upcoming
            const hasAirDate = !!episode.air_date;
            const hasAired = hasAiredPacific(episode.air_date);
            const isUpcoming = !hasAirDate || !hasAired;

            return {
              id: `${show.tmdbId}-${season}-${episode.episode_number}`,
              show,
              seasonNumber: season,
              episodeNumber: episode.episode_number,
              episodeTitle: episode.name,
              stillPath: episode.still_path,
              airDate: episode.air_date,
              isUpcoming,
            };
          }
        }
      } catch (e) {
        console.error(`Failed to load season ${season}:`, e);
      }
    }

    return null;
  };

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUpNext();
    }, [loadUpNext])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadUpNext();
  }, [loadUpNext]);

  const handleMarkWatched = useCallback(
    async (episode: UpNextEpisode) => {
      await storageService.markEpisodeWatched({
        showTmdbId: episode.show.tmdbId,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        watchedAt: new Date().toISOString(),
        episodeTitle: episode.episodeTitle ?? undefined,
        stillPath: episode.stillPath ?? undefined,
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Remove from list and reload
      setReadyToWatch((prev) => prev.filter((e) => e.id !== episode.id));

      // Load next episode for this show
      const nextEp = await findNextEpisode(episode.show);
      if (nextEp) {
        if (nextEp.isUpcoming) {
          setComingSoon((prev) => [...prev, nextEp].sort((a, b) => {
            if (!a.airDate) return 1;
            if (!b.airDate) return -1;
            return new Date(a.airDate).getTime() - new Date(b.airDate).getTime();
          }));
        } else {
          setReadyToWatch((prev) => [...prev, nextEp].sort((a, b) =>
            a.show.title.localeCompare(b.show.title)
          ));
        }
      }
    },
    []
  );

  const renderEpisodeCard = useCallback(
    ({ item, showCountdown }: { item: UpNextEpisode; showCountdown: boolean }) => {
      const countdown = getCountdownText(item.airDate);
      // Show "Date TBA" if upcoming but no air date
      const displayText = item.isUpcoming && !item.airDate ? 'Date TBA' : countdown;

      return (
        <TouchableOpacity
          style={styles.episodeCard}
          onPress={() => navigation.navigate('ShowDetail', { show: item.show })}
          activeOpacity={0.7}
        >
          <ShowPoster path={item.show.posterPath} size="small" />

          <View style={styles.episodeInfo}>
            <Text style={styles.showTitle} numberOfLines={1}>
              {item.show.title}
            </Text>

            <Text style={styles.episodeCode}>
              {formatEpisodeCode(item.seasonNumber, item.episodeNumber)}
            </Text>

            <Text style={styles.episodeTitle} numberOfLines={1}>
              {item.episodeTitle ?? `Episode ${item.episodeNumber}`}
            </Text>

            {showCountdown && displayText && (
              <Text style={[styles.countdown, !item.airDate && styles.dateTba]}>
                {displayText}
              </Text>
            )}
          </View>

          {!item.isUpcoming && (
            <TouchableOpacity
              style={styles.watchButton}
              onPress={() => handleMarkWatched(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      );
    },
    [navigation, handleMarkWatched]
  );

  const renderSection = useCallback(
    (title: string, episodes: UpNextEpisode[], showCountdown: boolean) => {
      if (episodes.length === 0) return null;

      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {episodes.map((item) => (
            <View key={item.id}>
              {renderEpisodeCard({ item, showCountdown })}
            </View>
          ))}
        </View>
      );
    },
    [renderEpisodeCard]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const isEmpty = readyToWatch.length === 0 && comingSoon.length === 0;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.emptyTitle}>Something Went Wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setLoading(true); loadUpNext(); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="tv-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Shows Being Watched</Text>
          <Text style={styles.emptyText}>Add shows and start tracking to see what's next</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {renderSection('Ready to Watch', readyToWatch, false)}
              {renderSection('Coming Soon', comingSoon, true)}
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          contentContainerStyle={styles.listContent}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 12,
  },
  episodeInfo: {
    flex: 1,
    gap: 2,
  },
  showTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  episodeCode: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  episodeTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  countdown: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.blue,
    marginTop: 2,
  },
  dateTba: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  watchButton: {
    padding: 4,
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
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
