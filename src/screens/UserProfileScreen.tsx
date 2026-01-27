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
import { followsService } from '../services/supabase/follows';
import { ratingsService } from '../services/supabase/ratings';
import { storageService } from '../services/storage';
import { useFollowStatus, useFollowCounts } from '../hooks/useFollows';
import FollowButton from '../components/FollowButton';
import ShowPoster from '../components/ShowPoster';
import StarRating from '../components/StarRating';
import { COLORS } from '../utils/constants';
import type { RootStackParamList, UserWithFollowStatus, TrackedShow } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

interface RatingWithShowInfo {
  id: string;
  tmdb_id: number;
  rating: number;
  showTitle?: string;
  posterPath?: string | null;
}

export default function UserProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<UserWithFollowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingWithShowInfo[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const { isFollowing, loading: followLoading, toggleFollow } = useFollowStatus(userId);
  const { followers, following, loading: countsLoading, refresh: refreshCounts } = useFollowCounts(userId);

  const isCurrentUser = currentUser?.id === userId;

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await followsService.getUserProfile(userId, currentUser?.id);
        setProfile(data);
      } catch (e) {
        console.error('Failed to load profile:', e);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userId, currentUser?.id]);

  // Load user's public ratings
  useEffect(() => {
    async function loadRatings() {
      setRatingsLoading(true);
      try {
        const userRatings = await ratingsService.getUserShowRatings(userId);
        // Filter to public only for other users
        const publicRatings = isCurrentUser
          ? userRatings
          : userRatings.filter((r) => r.is_public);

        // Enrich with show info from local storage
        const enrichedRatings: RatingWithShowInfo[] = await Promise.all(
          publicRatings.slice(0, 6).map(async (rating) => {
            const show = await storageService.getShow(rating.tmdb_id);
            return {
              id: rating.id,
              tmdb_id: rating.tmdb_id,
              rating: rating.rating,
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
  }, [userId, isCurrentUser]);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.notFoundText}>User not found</Text>
      </View>
    );
  }

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
                userId,
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
                userId,
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

      {/* Ratings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isCurrentUser ? 'My Ratings' : 'Ratings'}
        </Text>

        {ratingsLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
        ) : ratings.length === 0 ? (
          <View style={styles.emptyRatings}>
            <Ionicons name="star-outline" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyRatingsText}>No ratings yet</Text>
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
                  <Text style={styles.ratingCardTitle} numberOfLines={2}>
                    {rating.showTitle || `Show #${rating.tmdb_id}`}
                  </Text>
                  <StarRating value={rating.rating} size={14} readonly />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  emptyRatings: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 8,
  },
  emptyRatingsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
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
});
