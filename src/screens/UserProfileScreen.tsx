import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { followsService, UserPublicShow } from '../services/supabase/follows';
import { ratingsService } from '../services/supabase/ratings';
import { storageService } from '../services/storage';
import { STATUS_CONFIG } from '../utils/constants';
import { useFollowStatus, useFollowCounts } from '../hooks/useFollows';
import FollowButton from '../components/FollowButton';
import ShowPoster from '../components/ShowPoster';
import StarRating from '../components/StarRating';
import ProfileStats from '../components/ProfileStats';
import { COLORS } from '../utils/constants';
import type { RootStackParamList, UserWithFollowStatus, TrackedShow, ProfileStats as ProfileStatsType } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

type ProfileTab = 'shows' | 'ratings';

interface RatingWithShowInfo {
  id: string;
  tmdb_id: number;
  rating: number;
  ratingType: 'show' | 'season' | 'episode';
  seasonNumber?: number;
  episodeNumber?: number;
  showTitle?: string;
  posterPath?: string | null;
}

export default function UserProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { user: currentUser } = useAuth();

  // Support both userId and username params (for deep links)
  const params = route.params as { userId?: string; username?: string };
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(params.userId || null);
  const [notFound, setNotFound] = useState(false);

  const [profile, setProfile] = useState<UserWithFollowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('shows');
  const [publicShows, setPublicShows] = useState<UserPublicShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [ratings, setRatings] = useState<RatingWithShowInfo[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [stats, setStats] = useState<ProfileStatsType | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const { isFollowing, loading: followLoading, toggleFollow } = useFollowStatus(resolvedUserId || '');
  const { followers, following, loading: countsLoading, refresh: refreshCounts } = useFollowCounts(resolvedUserId || '');

  const isCurrentUser = currentUser?.id === resolvedUserId;

  // Resolve username to userId if needed (for deep links)
  useEffect(() => {
    async function resolveUsername() {
      if (params.userId) {
        setResolvedUserId(params.userId);
        return;
      }

      if (params.username) {
        try {
          const userProfile = await followsService.getProfileByUsername(params.username);
          if (userProfile) {
            setResolvedUserId(userProfile.id);
          } else {
            setNotFound(true);
            setLoading(false);
          }
        } catch (e) {
          console.error('Failed to resolve username:', e);
          setNotFound(true);
          setLoading(false);
        }
      }
    }
    resolveUsername();
  }, [params.userId, params.username]);

  // Load user profile
  useEffect(() => {
    if (!resolvedUserId) return;

    async function loadProfile() {
      try {
        const data = await followsService.getUserProfile(resolvedUserId!, currentUser?.id);
        if (data) {
          setProfile(data);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error('Failed to load profile:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [resolvedUserId, currentUser?.id]);

  // Load user's public shows (only if visibility allows)
  useEffect(() => {
    if (!resolvedUserId || (profile && profile.visibility?.shows === false)) {
      setShowsLoading(false);
      return;
    }

    async function loadShows() {
      setShowsLoading(true);
      try {
        const shows = await followsService.getUserPublicShows(resolvedUserId!);
        setPublicShows(shows);
      } catch (e) {
        console.error('Failed to load public shows:', e);
      } finally {
        setShowsLoading(false);
      }
    }
    loadShows();
  }, [resolvedUserId, profile?.visibility?.shows]);

  // Load user's public ratings
  useEffect(() => {
    if (!resolvedUserId) return;

    async function loadRatings() {
      setRatingsLoading(true);
      try {
        const allRatings = await followsService.getUserPublicRatings(resolvedUserId!);

        // Enrich with show info from local storage
        const enrichedRatings: RatingWithShowInfo[] = await Promise.all(
          allRatings.map(async (rating) => {
            const show = await storageService.getShow(rating.tmdbId);
            return {
              id: `${rating.tmdbId}-${rating.ratingType}-${rating.seasonNumber ?? 0}-${rating.episodeNumber ?? 0}`,
              tmdb_id: rating.tmdbId,
              rating: rating.rating,
              ratingType: rating.ratingType,
              seasonNumber: rating.seasonNumber,
              episodeNumber: rating.episodeNumber,
              showTitle: show?.title,
              posterPath: show?.posterPath,
            };
          })
        );

        setRatings(enrichedRatings);
      } catch (e) {
        console.error('Failed to load ratings:', e);
      } finally {
        setRatingsLoading(false);
      }
    }
    loadRatings();
  }, [resolvedUserId]);

  // Load user stats (only if visibility allows)
  useEffect(() => {
    if (!resolvedUserId || (profile && profile.visibility?.stats === false)) {
      setStatsLoading(false);
      return;
    }

    async function loadStats() {
      setStatsLoading(true);
      try {
        const userStats = await followsService.getUserStats(resolvedUserId!);
        setStats(userStats);
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, [resolvedUserId, profile?.visibility?.stats]);

  const handleFollowToggle = useCallback(async () => {
    await toggleFollow();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshCounts();
  }, [toggleFollow, refreshCounts]);

  const handleRatingPress = useCallback(
    async (tmdbId: number) => {
      const show = await storageService.getShow(tmdbId);
      if (show) {
        navigation.navigate('ShowDetail', { show });
      }
    },
    [navigation]
  );

  const handleShowPress = useCallback(
    (show: UserPublicShow) => {
      // Create a TrackedShow-compatible object for navigation
      const trackedShow: TrackedShow = {
        mediaType: 'tv',
        tmdbId: show.tmdbId,
        title: show.title,
        posterPath: show.posterPath,
        status: show.status,
        addedAt: show.addedAt,
        totalSeasons: 0,
        totalEpisodes: 0,
        streamingServices: [],
      };
      navigation.navigate('ShowDetail', { show: trackedShow });
    },
    [navigation]
  );

  const getRatingLabel = (rating: RatingWithShowInfo): string => {
    if (rating.ratingType === 'season' && rating.seasonNumber !== undefined) {
      return `Season ${rating.seasonNumber}`;
    }
    if (rating.ratingType === 'episode' && rating.seasonNumber !== undefined && rating.episodeNumber !== undefined) {
      return `S${rating.seasonNumber}E${rating.episodeNumber}`;
    }
    return '';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  // Require authentication to view profiles (per spec: "registered users only")
  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.notFoundText}>Sign in to view profiles</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.notFoundText}>Profile not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine what's visible based on profile visibility settings
  const showShowsSection = profile.visibility?.shows !== false;
  const showStatsSection = profile.visibility?.stats !== false;

  const displayName = profile.displayName || profile.username || 'User';
  const initial = displayName[0].toUpperCase();

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

        <Text style={styles.displayName}>{displayName}</Text>
        {profile.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}

        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {/* Follow Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              navigation.navigate('Followers', {
                userId: resolvedUserId!,
                username: profile.username ?? undefined,
              })
            }
          >
            <Text style={styles.statNumber}>{countsLoading ? '-' : followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              navigation.navigate('Following', {
                userId: resolvedUserId!,
                username: profile.username ?? undefined,
              })
            }
          >
            <Text style={styles.statNumber}>{countsLoading ? '-' : following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Follow Button */}
        {!isCurrentUser && currentUser && (
          <View style={styles.followButtonContainer}>
            <FollowButton
              isFollowing={isFollowing}
              loading={followLoading}
              onPress={handleFollowToggle}
            />
          </View>
        )}

        {/* Follows You Badge */}
        {profile.isFollowedBy && !isCurrentUser && (
          <View style={styles.followsYouBadge}>
            <Text style={styles.followsYouText}>Follows you</Text>
          </View>
        )}
      </View>

      {/* Profile Stats */}
      {showStatsSection && (
        <ProfileStats stats={stats} loading={statsLoading} />
      )}

      {/* Tabs - only show if shows section is visible */}
      {!showShowsSection ? (
        <View style={styles.hiddenSection}>
          <Ionicons name="eye-off-outline" size={24} color={COLORS.textTertiary} />
          <Text style={styles.hiddenText}>Content is hidden by user</Text>
        </View>
      ) : (
        <>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shows' && styles.tabActive]}
          onPress={() => setActiveTab('shows')}
        >
          <Text style={[styles.tabText, activeTab === 'shows' && styles.tabTextActive]}>
            Shows
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ratings' && styles.tabActive]}
          onPress={() => setActiveTab('ratings')}
        >
          <Text style={[styles.tabText, activeTab === 'ratings' && styles.tabTextActive]}>
            Ratings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'shows' ? (
        <View style={styles.section}>
          {showsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
          ) : publicShows.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="tv-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptySectionText}>No shows yet</Text>
            </View>
          ) : (
            <View style={styles.showsGrid}>
              {publicShows.map((show) => (
                <TouchableOpacity
                  key={show.tmdbId}
                  style={styles.showCard}
                  onPress={() => handleShowPress(show)}
                >
                  <ShowPoster
                    path={show.posterPath}
                    size="small"
                    width={90}
                    height={135}
                  />
                  <Text style={styles.showCardTitle} numberOfLines={2}>
                    {show.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${STATUS_CONFIG[show.status].color}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: STATUS_CONFIG[show.status].color },
                      ]}
                    >
                      {STATUS_CONFIG[show.status].label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          {ratingsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
          ) : ratings.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="star-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptySectionText}>No ratings yet</Text>
            </View>
          ) : (
            <View style={styles.ratingsGrid}>
              {ratings.map((rating) => (
                <TouchableOpacity
                  key={rating.id}
                  style={styles.ratingCard}
                  onPress={() => handleRatingPress(rating.tmdb_id)}
                >
                  <ShowPoster
                    path={rating.posterPath ?? null}
                    size="small"
                    width={50}
                    height={75}
                  />
                  <View style={styles.ratingCardInfo}>
                    <Text style={styles.ratingCardTitle} numberOfLines={1}>
                      {rating.showTitle || `Show #${rating.tmdb_id}`}
                    </Text>
                    {rating.ratingType !== 'show' && (
                      <Text style={styles.ratingCardSubtitle}>
                        {getRatingLabel(rating)}
                      </Text>
                    )}
                    <StarRating value={rating.rating} size={14} readonly />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  notFoundText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  backButton: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  hiddenSection: {
    alignItems: 'center',
    padding: 32,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 12,
  },
  hiddenText: {
    color: COLORS.textTertiary,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: COLORS.background,
    fontSize: 32,
    fontWeight: '600',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
  },
  username: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  followButtonContainer: {
    marginTop: 20,
  },
  followsYouBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  followsYouText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
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
  section: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptySection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 8,
  },
  emptySectionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  showsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  showCard: {
    width: 90,
    marginBottom: 8,
  },
  showCardTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ratingCard: {
    width: '47%',
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    overflow: 'hidden',
    gap: 10,
  },
  ratingCardInfo: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 8,
    justifyContent: 'center',
    gap: 4,
  },
  ratingCardTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  ratingCardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: -2,
  },
});
