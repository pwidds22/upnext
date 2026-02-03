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
import { RootStackParamList, TMDBMovie, TMDBCountryProviders, MovieStatus, FriendRating } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { ratingsService } from '../services/supabase/ratings';
import { followsService } from '../services/supabase/follows';
import { useAuth } from '../contexts/AuthContext';
import { useMovieWatchHistory } from '../hooks/useMovieWatchHistory';
import ShowPoster from '../components/ShowPoster';
import StarRating, { formatRating } from '../components/StarRating';
import WatchHistorySheet from '../components/WatchHistorySheet';
import { COLORS, getYearFromDate } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MovieDetailRouteProp = RouteProp<RootStackParamList, 'MovieDetail'>;

const MOVIE_STATUS_CONFIG: Record<MovieStatus, { label: string; color: string; icon: string }> = {
  watchlist: { label: 'Watchlist', color: COLORS.blue, icon: 'list' },
  watched: { label: 'Watched', color: COLORS.primary, icon: 'checkmark-circle' },
  dropped: { label: 'Dropped', color: COLORS.textSecondary, icon: 'close-circle' },
};

export default function MovieDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MovieDetailRouteProp>();
  const { movie } = route.params;
  const { user } = useAuth();

  const [movieDetails, setMovieDetails] = useState<TMDBMovie | null>(null);
  const [providers, setProviders] = useState<TMDBCountryProviders | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<MovieStatus>(movie.status);

  // Rating state
  const [userRating, setUserRating] = useState<number>(0);
  const [tmdbRating, setTmdbRating] = useState<number | null>(null);
  const [friendRatings, setFriendRatings] = useState<FriendRating[]>([]);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Watch history
  const {
    watchCount,
    addWatch,
    removeLatestWatch,
    getWatchHistory,
    deleteWatch,
    updateWatchDate,
  } = useMovieWatchHistory(movie.tmdbId);
  const [showWatchHistory, setShowWatchHistory] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [details, providersData] = await Promise.all([
          tmdbService.getMovieDetails(movie.tmdbId),
          tmdbService.getMovieWatchProviders(movie.tmdbId),
        ]);

        setMovieDetails(details);
        setProviders(providersData);

        if (details.vote_average !== undefined && details.vote_average > 0) {
          setTmdbRating(details.vote_average);
        }
      } catch (e) {
        console.error('Failed to load movie details:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [movie.tmdbId]);

  // Load user rating and friend ratings
  useEffect(() => {
    async function loadRatings() {
      if (!user) return;

      try {
        const [rating, friends] = await Promise.all([
          ratingsService.getUserMovieRating(user.id, movie.tmdbId),
          followsService.getFriendRatings(user.id, movie.tmdbId, 'movie'),
        ]);
        if (rating) {
          setUserRating(rating.rating);
        }
        setFriendRatings(friends);
      } catch (e) {
        console.error('Failed to load ratings:', e);
      }
    }

    loadRatings();
  }, [movie.tmdbId, user]);

  const handleRatingChange = useCallback(
    async (newRating: number) => {
      if (!user) return;

      setRatingLoading(true);
      try {
        await ratingsService.rateMovie(user.id, {
          tmdbId: movie.tmdbId,
          rating: newRating,
          isPublic: true,
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
    [user, movie.tmdbId]
  );

  const handleStatusChange = useCallback(
    async (newStatus: MovieStatus) => {
      const wasWatched = currentStatus === 'watched';
      await storageService.updateMovieStatus(movie.tmdbId, newStatus);
      setCurrentStatus(newStatus);

      // If changing TO watched for the first time, add initial watch to history
      if (newStatus === 'watched' && !wasWatched && watchCount === 0) {
        await addWatch();
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [movie.tmdbId, currentStatus, watchCount, addWatch]
  );

  const handleWatchAgain = useCallback(async () => {
    await addWatch();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addWatch]);

  const handleDelete = useCallback(() => {
    Alert.alert('Remove Movie', `Remove "${movie.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await storageService.deleteMovie(movie.tmdbId);
          navigation.goBack();
        },
      },
    ]);
  }, [movie, navigation]);

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShowPoster path={movie.posterPath} size="medium" />

        <View style={styles.headerInfo}>
          <Text style={styles.title}>{movie.title}</Text>

          <View style={styles.metaRow}>
            {movie.releaseDate && (
              <Text style={styles.metaText}>{getYearFromDate(movie.releaseDate)}</Text>
            )}
            {movie.runtime && (
              <>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={styles.metaText}>{formatRuntime(movie.runtime)}</Text>
              </>
            )}
          </View>

          {/* Status selector */}
          <View style={styles.statusSelector}>
            {(Object.keys(MOVIE_STATUS_CONFIG) as MovieStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  currentStatus === status && {
                    backgroundColor: `${MOVIE_STATUS_CONFIG[status].color}20`,
                    borderColor: MOVIE_STATUS_CONFIG[status].color,
                  },
                ]}
                onPress={() => handleStatusChange(status)}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    currentStatus === status && { color: MOVIE_STATUS_CONFIG[status].color },
                  ]}
                >
                  {MOVIE_STATUS_CONFIG[status].label}
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

      {/* Watch History Section - only show for watched movies */}
      {currentStatus === 'watched' && (
        <View style={styles.watchHistorySection}>
          <View style={styles.watchHistoryHeader}>
            <View style={styles.watchCountContainer}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              <Text style={styles.watchCountText}>
                {watchCount} {watchCount === 1 ? 'watch' : 'watches'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewHistoryButton}
              onPress={() => setShowWatchHistory(true)}
            >
              <Text style={styles.viewHistoryText}>View History</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.watchAgainButton} onPress={handleWatchAgain}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.watchAgainText}>Watch Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Streaming Providers */}
      {providers?.flatrate && providers.flatrate.length > 0 && (
        <View style={styles.providersSection}>
          <Text style={styles.sectionTitle}>Where to Watch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.providersList}>
              {providers.flatrate.map((provider) => (
                <View key={provider.provider_id} style={styles.providerPill}>
                  <Text style={styles.providerName}>{provider.provider_name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* About Section */}
      {loading ? (
        <ActivityIndicator style={styles.loading} color={COLORS.primary} />
      ) : (
        <View style={styles.aboutContainer}>
          {/* Overview */}
          {movieDetails?.overview && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Overview</Text>
              <Text style={styles.overview}>{movieDetails.overview}</Text>
            </View>
          )}

          {/* Tagline */}
          {movieDetails?.tagline && (
            <View style={styles.aboutSection}>
              <Text style={styles.tagline}>"{movieDetails.tagline}"</Text>
            </View>
          )}

          {/* Genres */}
          {movieDetails?.genres && movieDetails.genres.length > 0 && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Genres</Text>
              <View style={styles.genreContainer}>
                {movieDetails.genres.map((genre) => (
                  <View key={genre.id} style={styles.genreTag}>
                    <Text style={styles.genreText}>{genre.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Production Companies */}
          {movieDetails?.production_companies && movieDetails.production_companies.length > 0 && (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Studios</Text>
              <Text style={styles.studioText}>
                {movieDetails.production_companies.map((c) => c.name).join(', ')}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.deleteText}>Remove from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Watch History Sheet */}
      <WatchHistorySheet
        visible={showWatchHistory}
        onClose={() => setShowWatchHistory(false)}
        title={movie.title}
        getWatchHistory={getWatchHistory}
        onAddWatch={addWatch}
        onRemoveWatch={removeLatestWatch}
        onDeleteWatch={deleteWatch}
        onUpdateWatch={updateWatchDate}
      />
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaDivider: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusOptionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
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
  providerName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  loading: {
    padding: 40,
  },
  aboutContainer: {
    padding: 16,
    gap: 20,
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
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
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
  studioText: {
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
  // Watch History Section
  watchHistorySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
    gap: 12,
  },
  watchHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watchCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewHistoryText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  watchAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.primary}15`,
    paddingVertical: 12,
    borderRadius: 10,
  },
  watchAgainText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
