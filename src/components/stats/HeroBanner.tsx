import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { HeroStats } from '../../types';

interface HeroBannerProps {
  stats: HeroStats;
}

function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default function HeroBanner({ stats }: HeroBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Viewing Life</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={24} color={COLORS.primary} />
          <Text style={styles.statNumber}>~{formatWatchTime(stats.totalWatchTimeMinutes)}</Text>
          <Text style={styles.statLabel}>watched</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Ionicons name="tv-outline" size={24} color={COLORS.primary} />
          <Text style={styles.statNumber}>{stats.totalEpisodesWatched.toLocaleString()}</Text>
          <Text style={styles.statLabel}>episodes</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Ionicons name="film-outline" size={24} color={COLORS.primary} />
          <Text style={styles.statNumber}>{stats.totalMoviesWatched.toLocaleString()}</Text>
          <Text style={styles.statLabel}>movies</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
  },
});
