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
import { TMDBShow, TrackedShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import ShowPoster from '../components/ShowPoster';
import {
  COLORS,
  SEARCH_DEBOUNCE_MS,
  MAX_SEARCH_RESULTS,
  getYearFromDate,
} from '../utils/constants';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBShow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set());

  // Modal state
  const [selectedShow, setSelectedShow] = useState<TMDBShow | null>(null);
  const [addingShow, setAddingShow] = useState(false);

  // Load tracked show IDs
  useEffect(() => {
    async function loadTracked() {
      const shows = await storageService.getAllShows();
      setTrackedIds(new Set(shows.map((s) => s.tmdbId)));
    }
    loadTracked();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const searchResults = await tmdbService.searchShows(query);
        setResults(searchResults.slice(0, MAX_SEARCH_RESULTS));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const handleAddShow = useCallback(async (show: TMDBShow) => {
    setAddingShow(true);

    try {
      // Get full show details
      const details = await tmdbService.getShowDetails(show.id);

      const trackedShow: TrackedShow = {
        tmdbId: show.id,
        title: show.name,
        posterPath: show.poster_path,
        status: 'watching',
        addedAt: new Date().toISOString(),
        totalSeasons: details.number_of_seasons ?? 0,
        totalEpisodes: details.number_of_episodes ?? 0,
        streamingServices: [],
      };

      await storageService.addShow(trackedShow);
      setTrackedIds((prev) => new Set([...prev, show.id]));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedShow(null);
      setQuery('');
      setResults([]);
    } catch (e) {
      console.error('Failed to add show:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingShow(false);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TMDBShow }) => {
      const isTracked = trackedIds.has(item.id);
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
    [trackedIds]
  );

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

    if (query && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyText}>No shows found for "{query}"</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>Search for Shows</Text>
        <Text style={styles.emptyText}>Find TV shows to add to your watchlist</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search TV shows..."
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

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
        keyboardShouldPersistTaps="handled"
      />

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

              {trackedIds.has(selectedShow.id) ? (
                <View style={styles.alreadyTracked}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  <Text style={styles.alreadyTrackedText}>Already in Watchlist</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddShow(selectedShow)}
                  disabled={addingShow}
                >
                  {addingShow ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={24} color={COLORS.text} />
                      <Text style={styles.addButtonText}>Add to Watchlist</Text>
                    </>
                  )}
                </TouchableOpacity>
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
});
