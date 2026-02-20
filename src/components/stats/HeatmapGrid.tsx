import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';

interface HeatmapGridProps {
  data: Map<string, number>;
  weeks?: number;
}

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];
const CELL_SIZE = 14;
const CELL_GAP = 3;

function getColorForCount(count: number, maxCount: number): string {
  if (count === 0) return COLORS.surfaceLight;
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity <= 0.25) return '#064E3B';
  if (intensity <= 0.5) return '#047857';
  if (intensity <= 0.75) return '#10B981';
  return '#34D399';
}

export default function HeatmapGrid({ data, weeks = 13 }: HeatmapGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the max count for color scaling
  let maxCount = 1;
  for (const count of data.values()) {
    if (count > maxCount) maxCount = count;
  }

  // Build grid: 7 rows (days) x N columns (weeks)
  // Start from the most recent Sunday that encompasses `weeks` ago
  const todayDow = today.getDay(); // 0=Sun
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7) - todayDow);

  const columns: { date: Date; count: number }[][] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const week: { date: Date; count: number }[] = [];
    for (let day = 0; day < 7; day++) {
      const dateStr = cursor.toISOString().split('T')[0];
      const count = data.get(dateStr) ?? 0;
      week.push({ date: new Date(cursor), count });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(week);
  }

  // Month labels
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const firstDayOfWeek = columns[colIdx][0].date;
    const month = firstDayOfWeek.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        label: firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' }),
        colIndex: colIdx,
      });
      lastMonth = month;
    }
  }

  return (
    <View>
      {/* Month labels */}
      <View style={styles.monthRow}>
        <View style={styles.dayLabelSpace} />
        {columns.map((_, colIdx) => {
          const ml = monthLabels.find(m => m.colIndex === colIdx);
          return (
            <View key={colIdx} style={styles.cell}>
              {ml && <Text style={styles.monthLabel}>{ml.label}</Text>}
            </View>
          );
        })}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {/* Day labels column */}
        <View style={styles.dayLabelsCol}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={styles.cell}>
              <Text style={styles.dayLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Heatmap columns */}
        {columns.map((week, colIdx) => (
          <View key={colIdx} style={styles.column}>
            {week.map((day, rowIdx) => {
              const isFuture = day.date > today;
              return (
                <View
                  key={rowIdx}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isFuture
                        ? 'transparent'
                        : getColorForCount(day.count, maxCount),
                      borderRadius: 3,
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayLabelSpace: {
    width: 20,
  },
  grid: {
    flexDirection: 'row',
  },
  dayLabelsCol: {
    width: 20,
    gap: CELL_GAP,
  },
  column: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginRight: CELL_GAP,
  },
  monthLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  dayLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: CELL_SIZE,
  },
});
