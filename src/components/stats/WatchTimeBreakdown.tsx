import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';
import { WatchTimeBreakdown as WatchTimeBreakdownType } from '../../types';
import StatCard from './StatCard';
import BarChart from './BarChart';

interface WatchTimeBreakdownProps {
  watchTime: WatchTimeBreakdownType;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function WatchTimeBreakdown({ watchTime }: WatchTimeBreakdownProps) {
  // Build day of week chart data with all 7 days
  const dayData = DAY_NAMES.map((label, i) => {
    const found = watchTime.busiestDayOfWeek.find(d => d.day === i);
    return { label, value: found?.count ?? 0 };
  });

  return (
    <StatCard title="Watch Time" icon="time-outline">
      <View style={styles.timeRow}>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>~{formatTime(watchTime.thisWeekMinutes)}</Text>
          <Text style={styles.timeLabel}>this week</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>~{formatTime(watchTime.thisMonthMinutes)}</Text>
          <Text style={styles.timeLabel}>this month</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeValue}>~{formatTime(watchTime.allTimeMinutes)}</Text>
          <Text style={styles.timeLabel}>all time</Text>
        </View>
      </View>

      {watchTime.averagePerDayMinutes > 0 && (
        <Text style={styles.average}>
          ~{watchTime.averagePerDayMinutes} min/day average
        </Text>
      )}

      {dayData.some(d => d.value > 0) && (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Busiest Days</Text>
          <BarChart data={dayData} height={80} showValues />
        </View>
      )}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeItem: {
    flex: 1,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  timeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  average: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: 16,
  },
  chartSection: {
    marginTop: 8,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
});
