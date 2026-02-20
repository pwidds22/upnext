import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../utils/constants';
import StatCard from './StatCard';
import HeatmapGrid from './HeatmapGrid';

interface ActivityCalendarProps {
  data: Map<string, number>;
}

export default function ActivityCalendar({ data }: ActivityCalendarProps) {
  // Total in period
  let totalInPeriod = 0;
  for (const count of data.values()) {
    totalInPeriod += count;
  }

  return (
    <StatCard title="Activity" icon="calendar-outline">
      <Text style={styles.subtitle}>
        {totalInPeriod} episodes in the last 3 months
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HeatmapGrid data={data} weeks={13} />
      </ScrollView>
    </StatCard>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
});
