import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TMDBShow, TMDBMovie, TrackedShow, TrackedMovie, ShowStatus, MovieStatus, TMDBCountryProviders } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { ratingsService } from '../services/supabase/ratings';
import { useAuth } from '../contexts/AuthContext';
import ShowPoster from '../components/ShowPoster';
import ShowCard from '../components/ShowCard';
import MovieCard from '../components/MovieCard';
import FriendsWatchingCard from '../components/FriendsWatchingCard';
import StarRating from '../components/StarRating';
import { useRecommendations } from '../hooks/useRecommendations';
import { useMovieRecommendations } from '../hooks/useMovieRecommendations';
import { useFriendsWatching } from '../hooks/useFriendsWatching';
import { useSearch } from '../hooks/useSearch';
import { COLORS, getYearFromDate, hasAiredPacific } from '../utils/constants';

export default function SearchScreen() {
  // Search state via hook
  const {
    searchType,
    setSearchType,
    query,
    setQuery,
    showResults,
    movieResults,
    loading,
    error,
    clearSearch,
  } = useSearch();

  const [trackedShowIds, setTrackedShowIds] = useState<Set<number>>(new Set());
  const [trackedMovieIds, setTrackedMovieIds] = useState<Set<number>>(new Set());

  // Auth
  const { user } = useAuth();

  // Modal state
  const [selectedShow, setSelectedShow] = useState<TMDBShow | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [addingShow, setAddingShow] = useState(false);
  const [addingMovie, setAddingMovie] = useState(false);
  const [selectedShowStatus, setSelectedShowStatus] = useState<ShowStatus>('watchlist');
  const [selectedMovieStatus, setSelectedMovieStatus] = useState<MovieStatus>('watchlist');
  const [modalRating, setModalRating] = useState<number>(0);
  const [showProviders, setShowProviders] = useState<TMDBCountryProviders | null>(null);
  const [movieProviders, setMovieProviders] = useState<TMDBCountryProviders | null>(null);

  // TV show recommendations (pass trackedIds to filter out shows user already has)
  const { trending, forYou, topRated, loading: recsLoading, dismissShow } = useRecommendations(trackedShowIds);

  // Movie recommendations
  const { trending: movieTrending, forYou: movieForYou, topRated: movieTopRated, loading: movieRecsLoading, dismissMovie } = useMovieRecommendations(trackedMovieIds);

  // Friends watching (shows from people you follow)
  const { shows: friendsWatching, loading: friendsLoading } = useFriendsWatching(trackedShowIds);

  // Stable callbacks for dismiss handlers (prevents re-renders that reset scroll)
  const handleDismissShow = useCallback((show: TMDBShow) => {
    dismissShow(show.id);
  }, [dismissShow]);

  const handleDismissMovie = useCallback((movie: TMDBMovie) => {
    dismissMovie(movie.id);
  }, [dismissMovie]);

  // Load tracked IDs for both shows and movies
  useEffect(() => {
    async function loadTracked() {
      const [shows, movies] = await Promise.all([
        storageService.getAllShows(),
        storageService.getAllMovies(),
      ]);
      setTrackedShowIds(new Set(shows.map((s) => s.tmdbId)));
      setTrackedMovieIds(new Set(movies.map((m) => m.tmdbId)));
    }
    loadTracked();
  }, []);

  // Fetch streaming providers when show/movie modal opens
  useEffect(() => {
    setShowProviders(null);
    if (!selectedShow || trackedShowIds.has(selectedShow.id)) return;
    let cancelled = false;
    tmdbService.getWatchProviders(selectedShow.id)
      .then((providers) => { if (!cancelled) setShowProviders(providers); })
      .catch((e) => console.warn('Failed to fetch show providers:', e));
    return () => { cancelled = true; };
  }, [selectedShow, trackedShowIds]);

  useEffect(() => {
    setMovieProviders(null);
    if (!selectedMovie || trackedMovieIds.has(selectedMovie.id)) return;
    let cancelled = false;
    tmdbService.getMovieWatchProviders(selectedMovie.id)
      .then((providers) => { if (!cancelled) setMovieProviders(providers); })
      .catch((e) => console.warn('Failed to fetch movie providers:', e));
    return () => { cancelled = true; };
  }, [selectedMovie, trackedMovieIds]);

  const handleAddShow = useCallback(async (show: TMDBShow, status: ShowStatus, rating: number) => {
    setAddingShow(true);

    try {
      // Get full show details
      const details = await tmdbService.getShowDetails(show.id);

      const trackedShow: TrackedShow = {
        mediaType: 'tv',
        tmdbId: show.id,
        title: show.name,
        posterPath: show.poster_path,
        status,
        addedAt: new Date().toISOString(),
        totalSeasons: details.number_of_seasons ?? 0,
        totalEpisodes: details.number_of_episodes ?? 0,
        streamingServices: [],
      };

      await storageService.addShow(trackedShow);
      setTrackedShowIds((prev) => new Set([...prev, show.id]));

      // Auto-mark all aired episodes when adding as 'completed'
      const numSeasons = details.number_of_seasons ?? 0;
      if (status === 'completed' && numSeasons > 0) {
        try {
          const seasons = await tmdbService.getAllSeasons(show.id, numSeasons);
          let totalAiredCount = 0;
          for (const season of seasons) {
            if (season.episodes) {
              const airedEpisodes = season.episodes.filter((ep) => hasAiredPacific(ep.air_date));
              totalAiredCount += airedEpisodes.length;
              if (airedEpisodes.length > 0) {
                await storageService.markSeasonWatched(
                  show.id,
                  season.season_number,
                  airedEpisodes.map((ep) => ({
                    episodeNumber: ep.episode_number,
                    name: ep.name,
                    stillPath: ep.still_path,
                  }))
                );
              }
            }
          }
          if (totalAiredCount > 0) {
            await storageService.updateAiredEpisodes(show.id, totalAiredCount);
          }
        } catch (markError) {
          console.error('Failed to auto-mark episodes:', markError);
          // Don't fail the whole add operation if marking fails
        }
      }

      // Save rating if provided and user is logged in
      if (rating > 0 && user) {
        await ratingsService.rateShow(user.id, {
          tmdbId: show.id,
          rating,
          isPublic: true,
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedShow(null);
      setSelectedShowStatus('watchlist');
      setModalRating(0);
      clearSearch();
    } catch (e) {
      console.error('Failed to add show:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingShow(false);
    }
  }, [user, clearSearch]);

  const handleAddMovie = useCallback(async (movie: TMDBMovie, status: MovieStatus, rating: number) => {
    setAddingMovie(true);

    try {
      // Get full movie details
      const details = await tmdbService.getMovieDetails(movie.id);

      const trackedMovie: TrackedMovie = {
        mediaType: 'movie',
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        status,
        addedAt: new Date().toISOString(),
        releaseDate: details.release_date,
        runtime: details.runtime,
        streamingServices: [],
      };

      await storageService.addMovie(trackedMovie);
      setTrackedMovieIds((prev) => new Set([...prev, movie.id]));

      // Save rating if provided and user is logged in
      if (rating > 0 && user) {
        await ratingsService.rateMovie(user.id, {
          tmdbId: movie.id,
          rating,
          isPublic: true,
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedMovie(null);
      setSelectedMovieStatus('watchlist');
      setModalRating(0);
      clearSearch();
    } catch (e) {
      console.error('Failed to add movie:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingMovie(false);
    }
  }, [user, clearSearch]);

  const renderShowItem = useCallback(
    ({ item }: { item: TMDBShow }) => {
      const isTracked = trackedShowIds.has(item.id);
      const year = getYearFromDate(item.first_air_date);

      return (
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => setSelectedShow(item)}
          activeOpacity={0.7}
        >
          <ShowPoster path={item.poster_path} size="small" />

          <View style={styles.resultInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {item.name}
              </Text>
              {isTracked && (
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
              )}
            </View>

            {year && <Text style={styles.resultYear}>{year}</Text>}

            {item.overview && (
              <Text style={styles.resultOverview} numberOfLines={2}>
                {item.overview}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      );
    },
    [trackedShowIds]
  );

  const renderMovieItem = useCallback(
    ({ item }: { item: TMDBMovie }) => {
      const isTracked = trackedMovieIds.has(item.id);
      const year = getYearFromDate(item.release_date);

      return (
        <TouchableOpacity
          style={styles.resultRow}
          onPress={() => setSelectedMovie(item)}
          activeOpacity={0.7}
        >
          <ShowPoster path={item.poster_path} size="small" />

          <View style={styles.resultInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {isTracked && (
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
              )}
            </View>

            {year && <Text style={styles.resultYear}>{year}</Text>}

            {item.overview && (
              <Text style={styles.resultOverview} numberOfLines={2}>
                {item.overview}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      );
    },
    [trackedMovieIds]
  );

  const renderRecommendations = () => {
    if (recsLoading && friendsLoading) {
      return (
        <View style={styles.recsLoadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      );
    }

    return (
      <ScrollView style={styles.recommendationsContainer}>
        {trending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending This Week</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {trending.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  onPress={setSelectedShow}
                  onDismiss={handleDismissShow}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {forYou.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>For You</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {forYou.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  onPress={setSelectedShow}
                  onDismiss={handleDismissShow}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {topRated.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Rated</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {topRated.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  onPress={setSelectedShow}
                  onDismiss={handleDismissShow}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {friendsWatching.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friends Are Watching</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {friendsWatching.map((show) => (
                <FriendsWatchingCard
                  key={show.tmdbId}
                  show={show}
                  onPress={setSelectedShow}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderMovieRecommendations = () => {
    if (movieRecsLoading) {
      return (
        <View style={styles.recsLoadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      );
    }

    if (movieTrending.length === 0 && movieForYou.length === 0 && movieTopRated.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Search Movies</Text>
          <Text style={styles.emptyText}>Find movies to add to your watchlist</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.recommendationsContainer}>
        {movieTrending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending This Week</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {movieTrending.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onPress={setSelectedMovie}
                  onDismiss={handleDismissMovie}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {movieForYou.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>For You</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {movieForYou.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onPress={setSelectedMovie}
                  onDismiss={handleDismissMovie}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {movieTopRated.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Rated</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {movieTopRated.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onPress={setSelectedMovie}
                  onDismiss={handleDismissMovie}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.emptyTitle}>Search Error</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    const results = searchType === 'tv' ? showResults : movieResults;
    const typeLabel = searchType === 'tv' ? 'shows' : 'movies';

    if (query && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyText}>No {typeLabel} found for "{query}"</Text>
        </View>
      );
    }

    // Show recommendations when no query
    if (searchType === 'tv') {
      return renderRecommendations();
    }

    return renderMovieRecommendations();
  };

  const results = searchType === 'tv' ? showResults : movieResults;

  return (
    <View style={styles.container}>
      {/* Search Type Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'tv' && styles.toggleButtonActive]}
          onPress={() => setSearchType('tv')}
        >
          <Text style={[styles.toggleText, searchType === 'tv' && styles.toggleTextActive]}>
            TV Shows
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'movie' && styles.toggleButtonActive]}
          onPress={() => setSearchType('movie')}
        >
          <Text style={[styles.toggleText, searchType === 'movie' && styles.toggleTextActive]}>
            Movies
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchType === 'tv' ? 'Search TV shows...' : 'Search movies...'}
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}

      {/* Results or Recommendations - avoid ListEmptyComponent to prevent scroll reset on dismiss */}
      {searchType === 'tv' ? (
        showResults.length > 0 ? (
          <FlatList
            data={showResults}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderShowItem}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          renderEmpty()
        )
      ) : (
        movieResults.length > 0 ? (
          <FlatList
            data={movieResults}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMovieItem}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          renderEmpty()
        )
      )}

      {/* Add Show Modal */}
      <Modal
        visible={!!selectedShow}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedShow(null)}
      >
        {selectedShow && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedShow(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Show</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <ShowPoster path={selectedShow.poster_path} size="large" style={styles.modalPoster} />

              <Text style={styles.modalShowTitle}>{selectedShow.name}</Text>

              {getYearFromDate(selectedShow.first_air_date) && (
                <Text style={styles.modalYear}>
                  {getYearFromDate(selectedShow.first_air_date)}
                </Text>
              )}

              {selectedShow.number_of_seasons && (
                <Text style={styles.modalSeasons}>
                  {selectedShow.number_of_seasons} season
                  {selectedShow.number_of_seasons === 1 ? '' : 's'}
                </Text>
              )}

              {selectedShow.overview && (
                <Text style={styles.modalOverview}>{selectedShow.overview}</Text>
              )}

              {showProviders?.flatrate && showProviders.flatrate.length > 0 && (
                <View style={styles.providersSection}>
                  <Text style={styles.providersTitle}>Where to Watch</Text>
                  <View style={styles.providersList}>
                    {showProviders.flatrate.map((provider) => (
                      <View key={provider.provider_id} style={styles.providerPill}>
                        <Text style={styles.providerName}>{provider.provider_name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {trackedShowIds.has(selectedShow.id) ? (
                <View style={styles.alreadyTracked}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  <Text style={styles.alreadyTrackedText}>Already in Library</Text>
                </View>
              ) : (
                <>
                  {/* Status Selection */}
                  <View style={styles.statusSelection}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <View style={styles.statusOptions}>
                      {(['watchlist', 'watching', 'completed'] as ShowStatus[]).map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            selectedShowStatus === status && styles.statusOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedShowStatus(status);
                            if (status !== 'completed') setModalRating(0);
                          }}
                        >
                          <Text
                            style={[
                              styles.statusOptionText,
                              selectedShowStatus === status && styles.statusOptionTextActive,
                            ]}
                          >
                            {status === 'watchlist' ? 'Watchlist' : status === 'watching' ? 'Watching' : 'Watched'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Rating - only show for completed */}
                  {selectedShowStatus === 'completed' && (
                    <View style={styles.ratingSelection}>
                      <Text style={styles.statusLabel}>Rating (optional)</Text>
                      <StarRating
                        value={modalRating}
                        onChange={setModalRating}
                        size={32}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddShow(selectedShow, selectedShowStatus, modalRating)}
                    disabled={addingShow}
                  >
                    {addingShow ? (
                      <ActivityIndicator color={COLORS.text} />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={24} color={COLORS.text} />
                        <Text style={styles.addButtonText}>Add to Library</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Add Movie Modal */}
      <Modal
        visible={!!selectedMovie}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMovie(null)}
      >
        {selectedMovie && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedMovie(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Movie</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <ShowPoster path={selectedMovie.poster_path} size="large" style={styles.modalPoster} />

              <Text style={styles.modalShowTitle}>{selectedMovie.title}</Text>

              {getYearFromDate(selectedMovie.release_date) && (
                <Text style={styles.modalYear}>
                  {getYearFromDate(selectedMovie.release_date)}
                </Text>
              )}

              {selectedMovie.runtime && (
                <Text style={styles.modalSeasons}>
                  {Math.floor(selectedMovie.runtime / 60)}h {selectedMovie.runtime % 60}m
                </Text>
              )}

              {selectedMovie.overview && (
                <Text style={styles.modalOverview}>{selectedMovie.overview}</Text>
              )}

              {movieProviders?.flatrate && movieProviders.flatrate.length > 0 && (
                <View style={styles.providersSection}>
                  <Text style={styles.providersTitle}>Where to Watch</Text>
                  <View style={styles.providersList}>
                    {movieProviders.flatrate.map((provider) => (
                      <View key={provider.provider_id} style={styles.providerPill}>
                        <Text style={styles.providerName}>{provider.provider_name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {trackedMovieIds.has(selectedMovie.id) ? (
                <View style={styles.alreadyTracked}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  <Text style={styles.alreadyTrackedText}>Already in Library</Text>
                </View>
              ) : (
                <>
                  {/* Status Selection */}
                  <View style={styles.statusSelection}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <View style={styles.statusOptions}>
                      {(['watchlist', 'watched'] as MovieStatus[]).map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            selectedMovieStatus === status && styles.statusOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedMovieStatus(status);
                            if (status !== 'watched') setModalRating(0);
                          }}
                        >
                          <Text
                            style={[
                              styles.statusOptionText,
                              selectedMovieStatus === status && styles.statusOptionTextActive,
                            ]}
                          >
                            {status === 'watchlist' ? 'Watchlist' : 'Watched'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Rating - only show for watched */}
                  {selectedMovieStatus === 'watched' && (
                    <View style={styles.ratingSelection}>
                      <Text style={styles.statusLabel}>Rating (optional)</Text>
                      <StarRating
                        value={modalRating}
                        onChange={setModalRating}
                        size={32}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddMovie(selectedMovie, selectedMovieStatus, modalRating)}
                    disabled={addingMovie}
                  >
                    {addingMovie ? (
                      <ActivityIndicator color={COLORS.text} />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={24} color={COLORS.text} />
                        <Text style={styles.addButtonText}>Add to Library</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  loadingContainer: {
    padding: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  resultYear: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  resultOverview: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyList: {
    flex: 1,
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
  // Recommendations styles
  recommendationsContainer: {
    flex: 1,
    paddingTop: 8,
  },
  recsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    color: COLORS.blue,
    fontSize: 16,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  modalPoster: {
    marginBottom: 8,
  },
  modalShowTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalYear: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  modalSeasons: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  modalOverview: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
    width: '100%',
  },
  addButtonText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  alreadyTracked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  alreadyTrackedText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  // Status selection styles
  statusSelection: {
    width: '100%',
    marginTop: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  statusOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  statusOptionTextActive: {
    color: COLORS.text,
  },
  ratingSelection: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  providersSection: {
    width: '100%',
    marginTop: 8,
    gap: 8,
  },
  providersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  providersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
});
