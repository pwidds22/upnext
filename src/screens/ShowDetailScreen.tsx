import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { RootStackParamList, TMDBSeason, TMDBCountryProviders, ShowStatus, FriendRating, RatingType, TMDBShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { ratingsService, UserRatingRow } from '../services/supabase/ratings';
import { followsService } from '../services/supabase/follows';
import { showsCloudService } from '../services/supabase/shows';
import { useWatchedEpisodes } from '../hooks/useShowData';
import { useEpisodeReactions } from '../hooks/useEpisodeReactions';
import { useAuth } from '../contexts/AuthContext';
import ShowPoster from '../components/ShowPoster';
import EpisodeRow from '../components/EpisodeRow';
import WatchHistorySheet from '../components/WatchHistorySheet';
import StarRating, { formatRating } from '../components/StarRating';
import { COLORS, STATUS_CONFIG, getLogoUrl, hasAiredPacific } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ShowDetailRouteProp = RouteProp<RootStackParamList, 'ShowDetail'>;

export default function ShowDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ShowDetailRouteProp>();
  const { show } = route.params;
  const { user } = useAuth();

  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [providers, setProviders] = useState<TMDBCountryProviders | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [hasSetInitialSeason, setHasSetInitialSeason] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'about'>('episodes');
  const [currentStatus, setCurrentStatus] = useState<ShowStatus>(show.status);
  const [airedEpisodes, setAiredEpisodes] = useState<number>(show.airedEpisodes ?? show.totalEpisodes);

  // Rating state
  const [userRating, setUserRating] = useState<number>(0);
  const [tmdbRating, setTmdbRating] = useState<number | null>(null);
  const [friendRatings, setFriendRatings] = useState<FriendRating[]>([]);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Season rating state
  const [seasonRatings, setSeasonRatings] = useState<Map<number, number>>(new Map());
  const [ratingSeasonNumber, setRatingSeasonNumber] = useState<number | null>(null);

  // Privacy state
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Show details for About section
  const [showDetails, setShowDetails] = useState<TMDBShow | null>(null);

  const {
    isWatched,
    getWatchCount,
    toggleWatched,
    addWatch,
    removeLatestWatch,
    getWatchHistory,
    deleteWatch,
    updateWatchDate,
    watchedCount,
    watchedCountForSeason,
    markSeasonWatched,
    markSeasonUnwatched,
  } = useWatchedEpisodes(show.tmdbId);

  // Watch history sheet state
  const [historySheetEpisode, setHistorySheetEpisode] = useState<{
    season: number;
    episode: number;
    title: string;
  } | null>(null);

  const { getReaction, toggleReaction } = useEpisodeReactions(show.tmdbId);

  // Track if auto-mark has been performed for this show (fixes race condition)
  const hasAutoMarkedRef = useRef(false);
  const pendingAutoMarkRef = useRef(false);

  // Reset auto-mark ref when show changes
  useEffect(() => {
    hasAutoMarkedRef.current = false;
    pendingAutoMarkRef.current = false;
  }, [show.tmdbId]);

  // Auto-mark effect - runs when:
  // 1. Status was changed to 'completed' (pendingAutoMarkRef is true), OR
  // 2. Show was added as 'completed' (status is completed AND no episodes watched yet)
  useEffect(() => {
    const performAutoMark = async () => {
      // Check if we should auto-mark:
      // - pendingAutoMarkRef: status was just changed to completed
      // - OR: show is completed with 0 watched episodes (newly added as completed)
      const shouldAutoMark =
        pendingAutoMarkRef.current ||
        (currentStatus === 'completed' && watchedCount === 0);

      if (
        shouldAutoMark &&
        seasons.length > 0 &&
        !hasAutoMarkedRef.current
      ) {
        hasAutoMarkedRef.current = true;
        pendingAutoMarkRef.current = false;

        // Skip if already caught up — all aired episodes are already watched
        if (airedEpisodes > 0 && watchedCount >= airedEpisodes) {
          return;
        }

        try {
          for (const season of seasons) {
            if (season.episodes) {
              const aired = season.episodes.filter((ep) => hasAiredPacific(ep.air_date));
              if (aired.length > 0) {
                const episodeList = aired.map((ep) => ({
                  episodeNumber: ep.episode_number,
                  name: ep.name,
                  stillPath: ep.still_path,
                }));
                await markSeasonWatched(season.season_number, episodeList);
              }
            }
          }
        } catch (error) {
          console.error('Failed to auto-mark episodes:', error);
          Alert.alert(
            'Auto-mark Failed',
            'Some episodes could not be marked as watched. You can mark them manually.'
          );
        }
      }
    };

    performAutoMark();
  }, [seasons, markSeasonWatched, currentStatus, watchedCount]);

  // Calculate which season to expand by default (newest with unwatched aired episodes)
  const getDefaultExpandedSeason = useCallback((): number => {
    if (seasons.length === 0) return 1;

    // Find newest season with unwatched aired episodes (iterate highest to lowest)
    for (let i = seasons.length - 1; i >= 0; i--) {
      const season = seasons[i];
      if (!season.episodes) continue;

      const airedEpisodes = season.episodes.filter((ep) => hasAiredPacific(ep.air_date));

      if (airedEpisodes.length === 0) continue;

      const watchedInSeason = watchedCountForSeason(season.season_number);
      if (watchedInSeason < airedEpisodes.length) {
        return season.season_number;
      }
    }

    // Fallback: latest season that has aired episodes (not a future season)
    for (let i = seasons.length - 1; i >= 0; i--) {
      const season = seasons[i];
      if (!season.episodes) continue;

      const hasAiredEpisodes = season.episodes.some((ep) => hasAiredPacific(ep.air_date));

      if (hasAiredEpisodes) {
        return season.season_number;
      }
    }

    return 1;
  }, [seasons, watchedCountForSeason]);

  useEffect(() => {
    async function loadData() {
      try {
        const [seasonsData, providersData, showDetails] = await Promise.all([
          show.totalSeasons > 0
            ? tmdbService.getAllSeasons(show.tmdbId, show.totalSeasons)
            : Promise.resolve([]),
          tmdbService.getWatchProviders(show.tmdbId),
          tmdbService.getShowDetails(show.tmdbId),
        ]);

        setSeasons(seasonsData);
        setProviders(providersData);
        setShowDetails(showDetails);

        // Set TMDB rating if available
        if (showDetails.vote_average !== undefined && showDetails.vote_average > 0) {
          setTmdbRating(showDetails.vote_average);
        }

        // Calculate aired episodes (episodes with air date in the past, Pacific Time)
        let airedCount = 0;
        for (const season of seasonsData) {
          if (season.episodes) {
            for (const episode of season.episodes) {
              if (hasAiredPacific(episode.air_date)) {
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

  // Set default expanded season after seasons and watched data load
  useEffect(() => {
    if (!hasSetInitialSeason && seasons.length > 0 && !loading) {
      const defaultSeason = getDefaultExpandedSeason();
      setExpandedSeasons(new Set([defaultSeason]));
      setHasSetInitialSeason(true);
    }
  }, [seasons, loading, hasSetInitialSeason, getDefaultExpandedSeason]);

  // Load user rating, friend ratings, and season ratings
  useEffect(() => {
    async function loadRatings() {
      if (!user) return;

      try {
        const [rating, friends, seasonRatingData] = await Promise.all([
          ratingsService.getUserShowRating(user.id, show.tmdbId),
          followsService.getFriendRatings(user.id, show.tmdbId),
          ratingsService.getUserSeasonRatings(user.id, show.tmdbId),
        ]);
        if (rating) {
          setUserRating(rating.rating);
        }
        setFriendRatings(friends);

        // Build map of season ratings
        const ratingsMap = new Map<number, number>();
        seasonRatingData.forEach((sr) => {
          if (sr.season_number !== null) {
            ratingsMap.set(sr.season_number, sr.rating);
          }
        });
        setSeasonRatings(ratingsMap);
      } catch (e) {
        console.error('Failed to load ratings:', e);
      }
    }

    loadRatings();
  }, [show.tmdbId, user]);

  // Load show privacy setting
  useEffect(() => {
    async function loadPrivacy() {
      if (!user) return;
      try {
        const privacy = await showsCloudService.getShowPrivacy(user.id, show.tmdbId);
        setIsPublic(privacy);
      } catch (e) {
        console.error('Failed to load privacy setting:', e);
      }
    }
    loadPrivacy();
  }, [show.tmdbId, user]);

  const handleRatingChange = useCallback(
    async (newRating: number) => {
      if (!user) return;

      setRatingLoading(true);
      try {
        await ratingsService.rateShow(user.id, {
          tmdbId: show.tmdbId,
          rating: newRating,
          isPublic: true, // Default to public for now
        });
        setUserRating(newRating);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.error('Failed to save rating:', e);
        Alert.alert('Error', 'Failed to save rating');
      } finally {
        setRatingLoading(false);
      }
    },
    [user, show.tmdbId]
  );

  const handleSeasonRatingChange = useCallback(
    async (seasonNumber: number, newRating: number) => {
      if (!user) return;

      try {
        await ratingsService.rateSeason(user.id, show.tmdbId, seasonNumber, {
          rating: newRating,
          isPublic: true,
        });
        setSeasonRatings((prev) => new Map(prev).set(seasonNumber, newRating));
        setRatingSeasonNumber(null);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.error('Failed to save season rating:', e);
        Alert.alert('Error', 'Failed to save rating');
      }
    },
    [user, show.tmdbId]
  );

  const handlePrivacyToggle = useCallback(async () => {
    if (!user || privacyLoading) return;

    setPrivacyLoading(true);
    try {
      const newValue = !isPublic;
      await showsCloudService.updateShowPrivacy(user.id, show.tmdbId, newValue);
      setIsPublic(newValue);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Show brief feedback about what changed
      Alert.alert(
        newValue ? 'Visible on Profile' : 'Hidden from Profile',
        newValue
          ? 'This show will appear on your profile for followers to see.'
          : 'This show is now hidden from your profile.',
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (e) {
      console.error('Failed to update privacy setting:', e);
      Alert.alert('Error', 'Failed to update privacy setting');
    } finally {
      setPrivacyLoading(false);
    }
  }, [user, show.tmdbId, isPublic, privacyLoading]);

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

      // Trigger auto-mark via effect when completing a show
      // This handles the race condition where seasons may not be loaded yet
      if (newStatus === 'completed') {
        pendingAutoMarkRef.current = true;
        // If seasons are already loaded, the effect will run immediately
        // If not, it will run when seasons load
      } else {
        // Clear pending auto-mark if user changes to different status
        pendingAutoMarkRef.current = false;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [show.tmdbId]
  );

  // Prompt user when caught up with all aired episodes
  const hasPromptedCaughtUpRef = useRef(false);
  useEffect(() => {
    if (
      currentStatus === 'watching' &&
      watchedCount > 0 &&
      airedEpisodes > 0 &&
      watchedCount >= airedEpisodes &&
      seasons.length > 0 &&
      !hasPromptedCaughtUpRef.current
    ) {
      hasPromptedCaughtUpRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'All Caught Up!',
        `You've watched all aired episodes of ${show.title}.`,
        [
          {
            text: 'Mark as Waiting',
            onPress: () => handleStatusChange('waiting'),
          },
          {
            text: 'Mark as Completed',
            onPress: () => handleStatusChange('completed'),
          },
          { text: 'Keep Watching', style: 'cancel' },
        ]
      );
    }
  }, [watchedCount, airedEpisodes, currentStatus, seasons.length, show.tmdbId, show.title, handleStatusChange]);

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
          <View style={styles.titleRow}>
            <Text style={styles.title}>{show.title}</Text>
            {/* Privacy toggle icon */}
            {user && (
              <TouchableOpacity
                style={styles.privacyIconButton}
                onPress={handlePrivacyToggle}
                disabled={privacyLoading}
              >
                <Ionicons
                  name={isPublic ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={isPublic ? COLORS.textSecondary : COLORS.primary}
                />
              </TouchableOpacity>
            )}
          </View>

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
                  loading && styles.statusOptionDisabled,
                ]}
                onPress={() => handleStatusChange(status)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    currentStatus === status && { color: STATUS_CONFIG[status].color },
                    loading && styles.statusOptionTextDisabled,
                  ]}
                >
                  {STATUS_CONFIG[status].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Rating Section */}
      <View style={styles.ratingSection}>
        {/* Your Rating */}
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>Your Rating</Text>
          {user ? (
            <View style={styles.ratingStars}>
              <StarRating
                value={userRating}
                onChange={handleRatingChange}
                size={28}
                readonly={ratingLoading}
              />
              {userRating > 0 && (
                <Text style={styles.ratingValue}>{formatRating(userRating)}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.ratingHint}>Sign in to rate</Text>
          )}
        </View>

        {/* Friends Rating */}
        {user && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Friends</Text>
            {friendRatings.length > 0 ? (
              <View style={styles.friendRatingsContainer}>
                {friendRatings.slice(0, 3).map((fr) => (
                  <View key={fr.user.id} style={styles.friendRatingItem}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>
                        {(fr.user.displayName || fr.user.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <StarRating value={fr.rating} size={14} readonly />
                  </View>
                ))}
                {friendRatings.length > 3 && (
                  <Text style={styles.friendRatingsMore}>
                    +{friendRatings.length - 3} more
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.ratingHint}>No friend ratings yet</Text>
            )}
          </View>
        )}

        {/* TMDB Rating */}
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>TMDB</Text>
          {tmdbRating !== null ? (
            <View style={styles.ratingStars}>
              <StarRating value={tmdbRating} size={20} readonly />
              <Text style={styles.ratingValue}>{formatRating(tmdbRating)}</Text>
            </View>
          ) : (
            <Text style={styles.ratingHint}>No rating</Text>
          )}
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

              // Calculate aired episodes in this season (Pacific Time)
              const airedInSeason = season.episodes?.filter((ep) => hasAiredPacific(ep.air_date)).length ?? 0;
              const isUpcoming = airedInSeason === 0;
              const isComplete = !isUpcoming && seasonWatchedCount >= airedInSeason;

              return (
                <View key={season.season_number} style={styles.seasonSection}>
                  <View style={styles.seasonHeader}>
                    <TouchableOpacity
                      style={styles.seasonHeaderLeft}
                      onPress={() => !isUpcoming && toggleSeason(season.season_number)}
                      disabled={isUpcoming}
                    >
                      {!isUpcoming && (
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={COLORS.textSecondary}
                        />
                      )}
                      <Text style={[styles.seasonTitle, isUpcoming && styles.seasonTitleUpcoming]}>
                        Season {season.season_number}
                      </Text>
                      <Text style={[styles.seasonProgress, isUpcoming && styles.seasonProgressUpcoming]}>
                        {isUpcoming ? 'Upcoming' : `${seasonWatchedCount}/${airedInSeason}`}
                      </Text>
                    </TouchableOpacity>

                    {/* Season action buttons */}
                    {!isUpcoming && (
                      <View style={styles.seasonActions}>
                        {/* Season rating button */}
                        {user && (
                          <TouchableOpacity
                            style={[
                              styles.seasonRatingButton,
                              seasonRatings.has(season.season_number) && styles.seasonRatingButtonActive,
                            ]}
                            onPress={() => setRatingSeasonNumber(
                              ratingSeasonNumber === season.season_number ? null : season.season_number
                            )}
                          >
                            <Ionicons
                              name={seasonRatings.has(season.season_number) ? 'star' : 'star-outline'}
                              size={18}
                              color={seasonRatings.has(season.season_number) ? COLORS.warning : COLORS.textSecondary}
                            />
                            {seasonRatings.has(season.season_number) && (
                              <Text style={styles.seasonRatingValue}>
                                {formatRating(seasonRatings.get(season.season_number)!)}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}

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
                    )}
                  </View>

                  {/* Inline season rating picker */}
                  {ratingSeasonNumber === season.season_number && (
                    <View style={styles.seasonRatingPicker}>
                      <Text style={styles.seasonRatingPickerLabel}>
                        Rate Season {season.season_number}
                      </Text>
                      <StarRating
                        value={seasonRatings.get(season.season_number) ?? 0}
                        onChange={(rating) => handleSeasonRatingChange(season.season_number, rating)}
                        size={32}
                      />
                    </View>
                  )}

                  {isExpanded && season.episodes && (
                    <View style={styles.episodesList}>
                      {season.episodes.map((episode) => (
                        <EpisodeRow
                          key={episode.id}
                          episode={episode}
                          isWatched={isWatched(season.season_number, episode.episode_number)}
                          watchCount={getWatchCount(season.season_number, episode.episode_number)}
                          onToggle={() =>
                            handleToggleEpisode(
                              season.season_number,
                              episode.episode_number,
                              episode.name,
                              episode.still_path
                            )
                          }
                          onAddWatch={() =>
                            addWatch(
                              season.season_number,
                              episode.episode_number,
                              episode.name,
                              episode.still_path ?? undefined
                            )
                          }
                          onRemoveWatch={() =>
                            removeLatestWatch(season.season_number, episode.episode_number)
                          }
                          onViewHistory={() =>
                            setHistorySheetEpisode({
                              season: season.season_number,
                              episode: episode.episode_number,
                              title: episode.name,
                            })
                          }
                          reaction={getReaction(season.season_number, episode.episode_number)}
                          onReactionChange={(reaction) =>
                            toggleReaction(season.season_number, episode.episode_number, reaction)
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
          {/* Overview */}
          {showDetails?.overview && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Overview</Text>
              <Text style={styles.overview}>{showDetails.overview}</Text>
            </View>
          )}

          {/* Genres */}
          {showDetails?.genres && showDetails.genres.length > 0 && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Genres</Text>
              <View style={styles.genreContainer}>
                {showDetails.genres.map((genre) => (
                  <View key={genre.id} style={styles.genreTag}>
                    <Text style={styles.genreText}>{genre.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Network */}
          {showDetails?.networks && showDetails.networks.length > 0 && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Network</Text>
              <View style={styles.networkContainer}>
                {showDetails.networks.map((network) => (
                  <Text key={network.id} style={styles.networkName}>{network.name}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Status */}
          {showDetails?.status && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Status</Text>
              <Text style={styles.statusText}>{showDetails.status}</Text>
            </View>
          )}

          {/* Stats */}
          <Text style={styles.aboutText}>
            {show.totalSeasons} seasons • {show.totalEpisodes} episodes
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.deleteText}>Remove from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Watch History Sheet */}
      {historySheetEpisode && (
        <WatchHistorySheet
          visible={!!historySheetEpisode}
          onClose={() => setHistorySheetEpisode(null)}
          title={historySheetEpisode.title}
          subtitle={`S${historySheetEpisode.season} E${historySheetEpisode.episode}`}
          getWatchHistory={() =>
            getWatchHistory(historySheetEpisode.season, historySheetEpisode.episode)
          }
          onAddWatch={async (watchedAt) => {
            await addWatch(
              historySheetEpisode.season,
              historySheetEpisode.episode,
              historySheetEpisode.title,
              undefined,
              watchedAt
            );
          }}
          onRemoveWatch={() =>
            removeLatestWatch(historySheetEpisode.season, historySheetEpisode.episode)
          }
          onDeleteWatch={(watchId) =>
            deleteWatch(watchId, historySheetEpisode.season, historySheetEpisode.episode)
          }
          onUpdateWatch={updateWatchDate}
        />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  privacyIconButton: {
    padding: 4,
    marginTop: 2,
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
  statusOptionDisabled: {
    opacity: 0.5,
  },
  statusOptionTextDisabled: {
    color: COLORS.textTertiary,
  },
  ratingSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
    gap: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  ratingHint: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  friendRatingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendRatingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '600',
  },
  friendRatingsMore: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
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
  seasonTitleUpcoming: {
    color: COLORS.textTertiary,
  },
  seasonProgressUpcoming: {
    fontStyle: 'italic',
    color: COLORS.textTertiary,
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
  seasonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonRatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    gap: 4,
  },
  seasonRatingButtonActive: {
    backgroundColor: `${COLORS.warning}20`,
  },
  seasonRatingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.warning,
  },
  seasonRatingPicker: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    gap: 8,
  },
  seasonRatingPickerLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
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
  aboutSection: {
    gap: 8,
  },
  aboutSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overview: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    fontSize: 13,
    color: COLORS.text,
  },
  networkContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  networkName: {
    fontSize: 14,
    color: COLORS.text,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.text,
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
