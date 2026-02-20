import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';
import { MonthlyTrendItem } from '../../types';
import StatCard from './StatCard';
import BarChart from './BarChart';

interface MonthlyTrendProps {
  data: MonthlyTrendItem[];
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyTrend({ data }: MonthlyTrendProps) {
  const totalEps = data.reduce((s, d) => s + d.count, 0);
  const peakMonth = data.reduce((max, d) => d.count > max.count ? d : max, data[0]);

  const chartData = data.map(d => {
    const monthIdx = parseInt(d.month.split('-')[1], 10) - 1;
    return {
      label: MONTH_SHORT[monthIdx] ?? d.month,
      value: d.count,
      color: d === peakMonth ? COLORS.primary : `${COLORS.primary}99`,
    };
  });

  let peakLabel = '';
  if (peakMonth) {
    const monthIdx = parseInt(peakMonth.month.split('-')[1], 10) - 1;
    peakLabel = MONTH_SHORT[monthIdx] ?? peakMonth.month;
  }

  return (
    <StatCard title="Monthly Activity" icon="trending-up-outline">
      <Text style={styles.summary}>
        {totalEps} episodes over {data.length} month{data.length !== 1 ? 's' : ''}
      </Text>
      {peakMonth && peakMonth.count > 0 && (
        <Text style={styles.peak}>
          Peak: {peakLabel} ({peakMonth.count} episodes)
        </Text>
      )}
      <View style={styles.chart}>
        <BarChart data={chartData} height={100} showValues />
      </View>
    </StatCard>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  peak: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    marginTop: 4,
  },
});
