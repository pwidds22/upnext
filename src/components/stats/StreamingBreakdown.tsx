import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';
import { StreamingBreakdownItem } from '../../types';
import StatCard from './StatCard';

interface StreamingBreakdownProps {
  services: StreamingBreakdownItem[];
}

const SERVICE_COLORS = [
  COLORS.primary,
  COLORS.blue,
  COLORS.warning,
  '#9B59B6',
  COLORS.error,
  '#3498DB',
  '#1ABC9C',
  '#F39C12',
];

export default function StreamingBreakdown({ services }: StreamingBreakdownProps) {
  const maxCount = Math.max(...services.map(s => s.count), 1);
  const topServices = services.slice(0, 8);

  return (
    <StatCard title="Where You Watch" icon="tv-outline">
      {topServices.map((item, i) => (
        <View key={item.service} style={styles.row}>
          <Text style={styles.serviceName} numberOfLines={1}>
            {item.service}
          </Text>
          <View style={styles.barContainer}>
            <View
              style={[
                styles.bar,
                {
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: SERVICE_COLORS[i % SERVICE_COLORS.length],
                },
              ]}
            />
          </View>
          <Text style={styles.count}>{item.count}</Text>
        </View>
      ))}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  serviceName: {
    fontSize: 13,
    color: COLORS.text,
    width: 90,
  },
  barContainer: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 5,
    minWidth: 6,
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 28,
    textAlign: 'right',
  },
});
