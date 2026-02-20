import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { StreakStats } from '../../types';
import StatCard from './StatCard';

interface WatchingStreakProps {
  streak: StreakStats;
}

export default function WatchingStreak({ streak }: WatchingStreakProps) {
  return (
    <StatCard title="Watching Streak" icon="flame-outline">
      <View style={styles.countsRow}>
        <View style={styles.countItem}>
          <Text style={styles.countNumber}>{streak.currentStreak}</Text>
          <Text style={styles.countLabel}>current</Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countNumber}>{streak.longestStreak}</Text>
          <Text style={styles.countLabel}>longest</Text>
        </View>
      </View>

      <View style={styles.dotsRow}>
        {[...streak.recentDays].reverse().map((active, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              active ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.dotsLabel}>Last 14 days</Text>
    </StatCard>
  );
}

const styles = StyleSheet.create({
  countsRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 16,
  },
  countItem: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  countLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    backgroundColor: COLORS.surfaceLight,
  },
  dotsLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
});
