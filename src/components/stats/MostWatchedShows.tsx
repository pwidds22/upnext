import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS, getPosterUrl } from '../../utils/constants';
import { MostWatchedShow } from '../../types';
import StatCard from './StatCard';

interface MostWatchedShowsProps {
  shows: MostWatchedShow[];
}

export default function MostWatchedShows({ shows }: MostWatchedShowsProps) {
  return (
    <StatCard title="Most Watched" icon="trophy-outline">
      {shows.map((show, i) => {
        const posterUri = getPosterUrl(show.posterPath, 'small');
        const completion = show.totalEpisodes > 0
          ? Math.min(show.watchedCount / show.totalEpisodes, 1)
          : 0;

        return (
          <View key={show.tmdbId} style={styles.row}>
            <Text style={styles.rank}>#{i + 1}</Text>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{show.title}</Text>
              <Text style={styles.count}>
                {show.watchedCount} episode{show.watchedCount !== 1 ? 's' : ''}
              </Text>
              {show.totalEpisodes > 0 && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${completion * 100}%` },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  rank: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textTertiary,
    width: 24,
  },
  poster: {
    width: 36,
    height: 54,
    borderRadius: 4,
  },
  posterPlaceholder: {
    backgroundColor: COLORS.surfaceLight,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  count: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});
