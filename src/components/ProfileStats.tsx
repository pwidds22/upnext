import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStats as ProfileStatsType } from '../types';
import { COLORS } from '../utils/constants';

interface ProfileStatsProps {
  stats: ProfileStatsType | null;
  loading?: boolean;
}

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileStats({ stats, loading }: ProfileStatsProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatItem icon="tv-outline" value={stats.totalShows} label="Shows" />
      <View style={styles.divider} />
      <StatItem icon="film-outline" value={stats.totalMovies} label="Movies" />
      <View style={styles.divider} />
      <StatItem icon="play-circle-outline" value={stats.totalEpisodes} label="Episodes" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
});
