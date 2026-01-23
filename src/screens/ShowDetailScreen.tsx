import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, TMDBSeason, TMDBCountryProviders, ShowStatus } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { useWatchedEpisodes } from '../hooks/useShowData';
import ShowPoster from '../components/ShowPoster';
import EpisodeRow from '../components/EpisodeRow';
import { COLORS, STATUS_CONFIG, getLogoUrl } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ShowDetailRouteProp = RouteProp<RootStackParamList, 'ShowDetail'>;

export default function ShowDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ShowDetailRouteProp>();
  const { show } = route.params;

  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [providers, setProviders] = useState<TMDBCountryProviders | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));
  const [activeTab, setActiveTab] = useState<'episodes' | 'about'>('episodes');
  const [currentStatus, setCurrentStatus] = useState<ShowStatus>(show.status);
  const [airedEpisodes, setAiredEpisodes] = useState<number>(show.airedEpisodes ?? show.totalEpisodes);

  const { isWatched, toggleWatched, watchedCount, watchedCountForSeason, markSeasonWatched, markSeasonUnwatched } =
    useWatchedEpisodes(show.tmdbId);

  useEffect(() => {
    async function loadData() {
      try {
        const [seasonsData, providersData] = await Promise.all([
          show.totalSeasons > 0
            ? tmdbService.getAllSeasons(show.tmdbId, show.totalSeasons)
            : Promise.resolve([]),
          tmdbService.getWatchProviders(show.tmdbId),
        ]);

        setSeasons(seasonsData);
        setProviders(providersData);

        // Calculate aired episodes (episodes with air date in the past)
        const now = new Date();
        let airedCount = 0;
        for (const season of seasonsData) {
          if (season.episodes) {
            for (const episode of season.episodes) {
              if (episode.air_date && new Date(episode.air_date) <= now) {
                airedCount++;
              }
            }
          }
        }

        // Update the displayed count and stored aired episode count
        if (airedCount > 0) {
          setAiredEpisodes(airedCount);
          await storageService.updateAiredEpisodes(show.tmdbId, airedCount);
        }
      } catch (e) {
        console.error('Failed to load show details:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [show.tmdbId, show.totalSeasons]);

  const toggleSeason = useCallback((seasonNumber: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber);
      } else {
        next.add(seasonNumber);
      }
      return next;
    });
  }, []);

  const handleToggleEpisode = useCallback(
    async (seasonNumber: number, episodeNumber: number, name: string | null, stillPath: string | null) => {
      await toggleWatched(seasonNumber, episodeNumber, name ?? undefined, stillPath ?? undefined);
    },
    [toggleWatched]
  );

  const handleMarkSeasonWatched = useCallback(
    async (season: TMDBSeason) => {
      if (!season.episodes) return;

      const episodes = season.episodes.map((ep) => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        stillPath: ep.still_path,
      }));

      await markSeasonWatched(season.season_number, episodes);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [markSeasonWatched]
  );

  const handleMarkSeasonUnwatched = useCallback(
    async (seasonNumber: number) => {
      await markSeasonUnwatched(seasonNumber);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [markSeasonUnwatched]
  );

  const handleStatusChange = useCallback(
    async (newStatus: ShowStatus) => {
      await storageService.updateShowStatus(show.tmdbId, newStatus);
      setCurrentStatus(newStatus);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [show.tmdbId]
  );

  const handleDelete = useCallback(() => {
    Alert.alert('Remove Show', `Remove "${show.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await storageService.deleteShow(show.tmdbId);
          navigation.goBack();
        },
      },
    ]);
  }, [show, navigation]);

  const progress = airedEpisodes > 0 ? watchedCount / airedEpisodes : 0;
  const progressText =
    airedEpisodes > 0
      ? `${watchedCount}/${airedEpisodes} episodes`
      : `${watchedCount} watched`;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShowPoster path={show.posterPath} size="medium" />

        <View style={styles.headerInfo}>
          <Text style={styles.title}>{show.title}</Text>

          <Text style={styles.progressText}>{progressText}</Text>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${Math.min(progress * 100, 100)}%` },
              ]}
            />
          </View>

          {/* Status selector */}
          <View style={styles.statusSelector}>
            {(Object.keys(STATUS_CONFIG) as ShowStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  currentStatus === status && {
                    backgroundColor: `${STATUS_CONFIG[status].color}20`,
                    borderColor: STATUS_CONFIG[status].color,
                  },
                ]}
                onPress={() => handleStatusChange(status)}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    currentStatus === status && { color: STATUS_CONFIG[status].color },
                  ]}
                >
                  {STATUS_CONFIG[status].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Streaming Providers */}
      {providers?.flatrate && providers.flatrate.length > 0 && (
        <View style={styles.providersSection}>
          <Text style={styles.sectionTitle}>Where to Watch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.providersList}>
              {providers.flatrate.map((provider) => (
                <View key={provider.provider_id} style={styles.providerPill}>
                  {provider.logo_path && (
                    <View style={styles.providerLogo}>
                      {/* Logo would go here */}
                    </View>
                  )}
                  <Text style={styles.providerName}>{provider.provider_name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Tab Picker */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'episodes' && styles.tabActive]}
          onPress={() => setActiveTab('episodes')}
        >
          <Text style={[styles.tabText, activeTab === 'episodes' && styles.tabTextActive]}>
            Episodes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'about' && styles.tabActive]}
          onPress={() => setActiveTab('about')}
        >
          <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
            About
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'episodes' ? (
        loading ? (
          <ActivityIndicator style={styles.loading} color={COLORS.primary} />
        ) : (
          <View style={styles.episodesContainer}>
            {seasons.map((season) => {
              const isExpanded = expandedSeasons.has(season.season_number);
              const seasonWatchedCount = watchedCountForSeason(season.season_number);
              const episodeCount = season.episodes?.length ?? season.episode_count ?? 0;
              const isComplete = seasonWatchedCount >= episodeCount;

              return (
                <View key={season.season_number} style={styles.seasonSection}>
                  <View style={styles.seasonHeader}>
                    <TouchableOpacity
                      style={styles.seasonHeaderLeft}
                      onPress={() => toggleSeason(season.season_number)}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.seasonTitle}>Season {season.season_number}</Text>
                      <Text style={styles.seasonProgress}>
                        {seasonWatchedCount}/{episodeCount}
                      </Text>
                    </TouchableOpacity>

                    {/* Mark all watched/unwatched button */}
                    <TouchableOpacity
                      style={[
                        styles.markAllButton,
                        isComplete && styles.markAllButtonComplete,
                      ]}
                      onPress={() => {
                        if (isComplete) {
                          handleMarkSeasonUnwatched(season.season_number);
                        } else {
                          handleMarkSeasonWatched(season);
                        }
                      }}
                    >
                      <Ionicons
                        name={isComplete ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={20}
                        color={isComplete ? COLORS.primary : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.markAllText,
                          isComplete && styles.markAllTextComplete,
                        ]}
                      >
                        {isComplete ? 'Done' : 'Mark All'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isExpanded && season.episodes && (
                    <View style={styles.episodesList}>
                      {season.episodes.map((episode) => (
                        <EpisodeRow
                          key={episode.id}
                          episode={episode}
                          isWatched={isWatched(season.season_number, episode.episode_number)}
                          onToggle={() =>
                            handleToggleEpisode(
                              season.season_number,
                              episode.episode_number,
                              episode.name,
                              episode.still_path
                            )
                          }
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )
      ) : (
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutText}>
            {show.totalSeasons} seasons • {show.totalEpisodes} episodes
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.deleteText}>Remove from Library</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  headerInfo: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressText: {
    fontSize: 14,
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
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  providersSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  providersList: {
    flexDirection: 'row',
    gap: 8,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  providerLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  providerName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: COLORS.surface,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  loading: {
    padding: 40,
  },
  episodesContainer: {
    paddingBottom: 40,
  },
  seasonSection: {
    marginBottom: 8,
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  seasonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  seasonProgress: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    gap: 4,
  },
  markAllButtonComplete: {
    backgroundColor: `${COLORS.primary}20`,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  markAllTextComplete: {
    color: COLORS.primary,
  },
  episodesList: {
    backgroundColor: COLORS.background,
  },
  aboutContainer: {
    padding: 16,
    gap: 20,
  },
  aboutText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 16,
    color: COLORS.error,
  },
});
