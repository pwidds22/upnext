import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedShow, TrackedMovie, TrackedMedia, RootStackParamList, ShowStatus, MovieStatus } from '../types';
import { storageService } from '../services/storage';
import ShowPoster from '../components/ShowPoster';
import { COLORS, STATUS_CONFIG } from '../utils/constants';

const LIBRARY_FILTER_KEY = '@upnext_library_filter';
const HIDE_COMPLETED_KEY = '@upnext_hide_completed';
const COLLAPSED_SECTIONS_KEY = '@upnext_collapsed_sections';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MediaFilter = 'all' | 'tv' | 'movie';

const MOVIE_STATUS_CONFIG: Record<MovieStatus, { label: string; color: string }> = {
  watchlist: { label: 'Watchlist', color: COLORS.blue },
  watched: { label: 'Watched', color: COLORS.primary },
  dropped: { label: 'Dropped', color: COLORS.textSecondary },
};

interface ShowWithProgress extends TrackedShow {
  watchedCount: number;
}

interface MovieItem extends TrackedMovie {
  watchedCount?: never; // Movies don't have episode progress
}

type LibraryItem = ShowWithProgress | MovieItem;

export default function MyShowsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [shows, setShows] = useState<ShowWithProgress[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Load saved preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const [savedFilter, savedHideCompleted, savedCollapsed] = await Promise.all([
          AsyncStorage.getItem(LIBRARY_FILTER_KEY),
          AsyncStorage.getItem(HIDE_COMPLETED_KEY),
          AsyncStorage.getItem(COLLAPSED_SECTIONS_KEY),
        ]);
        if (savedFilter && ['all', 'tv', 'movie'].includes(savedFilter)) {
          setMediaFilter(savedFilter as MediaFilter);
        }
        if (savedHideCompleted !== null) {
          setHideCompleted(savedHideCompleted === 'true');
        }
        if (savedCollapsed) {
          try {
            const parsed = JSON.parse(savedCollapsed);
            if (Array.isArray(parsed)) {
              setCollapsedSections(new Set(parsed));
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
    loadPreferences();
  }, []);

  // Save filter preference when it changes
  const handleFilterChange = useCallback(async (filter: MediaFilter) => {
    setMediaFilter(filter);
    try {
      await AsyncStorage.setItem(LIBRARY_FILTER_KEY, filter);
    } catch (e) {
      console.error('Failed to save filter preference:', e);
    }
  }, []);

  // Toggle hide completed/watched
  const toggleHideCompleted = useCallback(async () => {
    const newValue = !hideCompleted;
    setHideCompleted(newValue);
    try {
      await AsyncStorage.setItem(HIDE_COMPLETED_KEY, String(newValue));
    } catch (e) {
      console.error('Failed to save hide completed preference:', e);
    }
  }, [hideCompleted]);

  // Toggle section collapse
  const toggleSectionCollapse = useCallback(async (sectionTitle: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      // Save to storage
      AsyncStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(Array.from(newSet))).catch((e) =>
        console.error('Failed to save collapsed sections:', e)
      );
      return newSet;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allShows, allMovies] = await Promise.all([
        storageService.getAllShows(),
        storageService.getAllMovies(),
      ]);

      // Get watched counts for each show
      const showsWithProgress: ShowWithProgress[] = await Promise.all(
        allShows.map(async (show) => {
          const watchedCount = await storageService.getWatchedCount(show.tmdbId);
          return { ...show, watchedCount };
        })
      );

      setShows(showsWithProgress);
      setMovies(allMovies);
    } catch (e) {
      console.error('Failed to load library:', e);
      setError('Failed to load your library. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Build sections based on filter
  const getSections = () => {
    // Helper to create section with collapse support
    const makeSection = (title: string, data: LibraryItem[]) => ({
      title,
      data: collapsedSections.has(title) ? [] : data,
      fullCount: data.length,
    });

    if (mediaFilter === 'movie') {
      // Movie-only sections
      const watchlist = movies.filter((m) => m.status === 'watchlist');
      const watched = movies.filter((m) => m.status === 'watched');
      const dropped = movies.filter((m) => m.status === 'dropped');

      const sections = [
        makeSection('Watchlist', watchlist),
        makeSection('Dropped', dropped),
      ];
      // Only include Watched section if not hiding
      if (!hideCompleted) {
        sections.splice(1, 0, makeSection('Watched', watched));
      }
      return sections.filter((section) => section.fullCount > 0);
    }

    if (mediaFilter === 'tv') {
      // TV-only sections
      const watching = shows.filter((s) => s.status === 'watching');
      const waiting = shows.filter((s) => s.status === 'waiting');
      const watchlist = shows.filter((s) => s.status === 'watchlist');
      const completed = shows.filter((s) => s.status === 'completed');
      const dropped = shows.filter((s) => s.status === 'dropped');

      const sections = [
        makeSection('Watching', watching),
        makeSection('Waiting', waiting),
        makeSection('Watchlist', watchlist),
        makeSection('Dropped', dropped),
      ];
      // Only include Watched section if not hiding
      if (!hideCompleted) {
        sections.splice(3, 0, makeSection('Watched', completed));
      }
      return sections.filter((section) => section.fullCount > 0);
    }

    // All - combine shows and movies
    const allItems: LibraryItem[] = [...shows, ...movies];
    const watching = allItems.filter((i) => i.status === 'watching');
    const waiting = allItems.filter((i) => i.status === 'waiting');
    const watchlist = allItems.filter((i) => i.status === 'watchlist');
    const watched = allItems.filter((i) => i.status === 'watched' || i.status === 'completed');
    const dropped = allItems.filter((i) => i.status === 'dropped');

    const sections = [
      makeSection('Watching', watching),
      makeSection('Waiting', waiting),
      makeSection('Watchlist', watchlist),
      makeSection('Dropped', dropped),
    ];
    // Only include Watched section if not hiding (combines TV 'completed' and movie 'watched')
    if (!hideCompleted) {
      sections.splice(3, 0, makeSection('Watched', watched));
    }
    return sections.filter((section) => section.fullCount > 0);
  };

  const sections = getSections();

  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => {
      const isMovie = item.mediaType === 'movie';

      if (isMovie) {
        const movie = item as MovieItem;
        const statusConfig = MOVIE_STATUS_CONFIG[movie.status];

        return (
          <TouchableOpacity
            style={styles.showCard}
            onPress={() => navigation.navigate('MovieDetail', { movie })}
            activeOpacity={0.7}
          >
            <ShowPoster path={movie.posterPath} size="small" width={80} height={120} />

            <View style={styles.showInfo}>
              <View style={styles.titleRow}>
                <Text style={styles.showTitle} numberOfLines={2}>
                  {movie.title}
                </Text>
                <Ionicons name="film-outline" size={14} color={COLORS.textTertiary} />
              </View>

              <Text style={styles.progressText}>
                {movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'Movie'}
              </Text>

              {/* Status badge */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${statusConfig.color}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        );
      }

      // TV Show
      const show = item as ShowWithProgress;
      const displayTotal = show.airedEpisodes ?? show.totalEpisodes;
      const progress = displayTotal > 0 ? show.watchedCount / displayTotal : 0;
      const progressText =
        displayTotal > 0
          ? `${show.watchedCount}/${displayTotal} episodes`
          : `${show.watchedCount} watched`;

      return (
        <TouchableOpacity
          style={styles.showCard}
          onPress={() => navigation.navigate('ShowDetail', { show })}
          activeOpacity={0.7}
        >
          <ShowPoster path={show.posterPath} size="small" width={80} height={120} />

          <View style={styles.showInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.showTitle} numberOfLines={2}>
                {show.title}
              </Text>
              <Ionicons name="tv-outline" size={14} color={COLORS.textTertiary} />
            </View>

            <Text style={styles.progressText}>{progressText}</Text>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(progress * 100, 100)}%`,
                    backgroundColor: STATUS_CONFIG[show.status].color,
                  },
                ]}
              />
            </View>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${STATUS_CONFIG[show.status].color}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: STATUS_CONFIG[show.status].color }]}>
                {STATUS_CONFIG[show.status].label}
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
    ({ section }: { section: { title: string; data: LibraryItem[]; fullCount: number } }) => {
      const isCollapsed = collapsedSections.has(section.title);
      return (
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSectionCollapse(section.title)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
            size={20}
            color={COLORS.textSecondary}
          />
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.fullCount}</Text>
        </TouchableOpacity>
      );
    },
    [collapsedSections, toggleSectionCollapse]
  );

  const renderEmpty = () => {
    if (error) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.emptyTitle}>Something Went Wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setLoading(true); loadData(); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    const icon = mediaFilter === 'movie' ? 'film-outline' : 'tv-outline';
    const title = mediaFilter === 'movie' ? 'No Movies Yet' : mediaFilter === 'tv' ? 'No Shows Yet' : 'Library Empty';
    const text = mediaFilter === 'movie'
      ? 'Search for movies to add to your watchlist'
      : 'Search for shows to add to your watchlist';

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={icon} size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
      </View>
    );
  };

  const totalCount = shows.length + movies.length;

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, mediaFilter === 'all' && styles.filterChipActive]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterText, mediaFilter === 'all' && styles.filterTextActive]}>
            All ({totalCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, mediaFilter === 'tv' && styles.filterChipActive]}
          onPress={() => handleFilterChange('tv')}
        >
          <Ionicons
            name="tv-outline"
            size={14}
            color={mediaFilter === 'tv' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.filterText, mediaFilter === 'tv' && styles.filterTextActive]}>
            TV ({shows.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, mediaFilter === 'movie' && styles.filterChipActive]}
          onPress={() => handleFilterChange('movie')}
        >
          <Ionicons
            name="film-outline"
            size={14}
            color={mediaFilter === 'movie' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.filterText, mediaFilter === 'movie' && styles.filterTextActive]}>
            Movies ({movies.length})
          </Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Hide watched toggle - icon only when off, labeled when on */}
        <TouchableOpacity
          style={[styles.hideToggle, hideCompleted && styles.hideToggleActive]}
          onPress={toggleHideCompleted}
        >
          <Ionicons
            name={hideCompleted ? 'eye-off' : 'eye-outline'}
            size={16}
            color={hideCompleted ? COLORS.text : COLORS.textSecondary}
          />
          {hideCompleted && (
            <Text style={styles.hideToggleTextActive}>Hidden</Text>
          )}
        </TouchableOpacity>
      </View>

      {totalCount === 0 && !loading ? (
        renderEmpty()
      ) : sections.length === 0 ? (
        renderEmpty()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.text,
  },
  hideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    gap: 4,
  },
  hideToggleActive: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
  },
  hideToggleTextActive: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    gap: 6,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showTitle: {
    flex: 1,
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
