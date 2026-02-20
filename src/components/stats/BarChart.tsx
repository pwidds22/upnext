import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';

interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  barColor?: string;
  height?: number;
  showValues?: boolean;
}

export default function BarChart({ data, barColor = COLORS.primary, height = 120, showValues = false }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.barsContainer, { height }]}>
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * height;
          return (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.barSpace, { height }]}>
                {showValues && item.value > 0 && (
                  <Text style={styles.valueLabel}>{item.value}</Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, 2),
                      backgroundColor: item.color ?? barColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.label}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barSpace: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
    minWidth: 8,
  },
  valueLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
