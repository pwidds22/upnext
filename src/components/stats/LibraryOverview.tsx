import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, STATUS_CONFIG } from '../../utils/constants';
import { LibraryBreakdownItem } from '../../types';
import StatCard from './StatCard';
import SegmentedBar from './SegmentedBar';

interface LibraryOverviewProps {
  breakdown: LibraryBreakdownItem[];
}

const STATUS_COLORS: Record<string, string> = {
  watching: STATUS_CONFIG.watching.color,
  waiting: STATUS_CONFIG.waiting.color,
  watchlist: STATUS_CONFIG.watchlist.color,
  completed: STATUS_CONFIG.completed.color,
  dropped: STATUS_CONFIG.dropped.color,
  watched: STATUS_CONFIG.completed.color,
};

const STATUS_LABELS: Record<string, string> = {
  watching: 'Watching',
  waiting: 'Waiting',
  watchlist: 'Watchlist',
  completed: 'Completed',
  dropped: 'Dropped',
  watched: 'Watched',
};

export default function LibraryOverview({ breakdown }: LibraryOverviewProps) {
  // Separate TV and movies
  const tvItems = breakdown.filter(b => b.mediaType === 'tv');
  const movieItems = breakdown.filter(b => b.mediaType === 'movie');
  const totalShows = tvItems.reduce((s, b) => s + b.count, 0);
  const totalMovies = movieItems.reduce((s, b) => s + b.count, 0);

  const tvSegments = tvItems
    .filter(b => b.count > 0)
    .map(b => ({
      value: b.count,
      color: STATUS_COLORS[b.status] ?? COLORS.textTertiary,
    }));

  const movieSegments = movieItems
    .filter(b => b.count > 0)
    .map(b => ({
      value: b.count,
      color: STATUS_COLORS[b.status] ?? COLORS.textTertiary,
    }));

  return (
    <StatCard title="Library" icon="albums-outline">
      {totalShows > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{totalShows} TV Shows</Text>
          <SegmentedBar segments={tvSegments} height={10} />
          <View style={styles.legend}>
            {tvItems.filter(b => b.count > 0).map(b => (
              <View key={b.status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[b.status] }]} />
                <Text style={styles.legendText}>{STATUS_LABELS[b.status] ?? b.status} ({b.count})</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {totalMovies > 0 && (
        <View style={[styles.section, totalShows > 0 && styles.sectionMargin]}>
          <Text style={styles.sectionLabel}>{totalMovies} Movies</Text>
          <SegmentedBar segments={movieSegments} height={10} />
          <View style={styles.legend}>
            {movieItems.filter(b => b.count > 0).map(b => (
              <View key={b.status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[b.status] }]} />
                <Text style={styles.legendText}>{STATUS_LABELS[b.status] ?? b.status} ({b.count})</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  section: {},
  sectionMargin: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
