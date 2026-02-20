import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Segment {
  value: number;
  color: string;
}

interface SegmentedBarProps {
  segments: Segment[];
  height?: number;
  borderRadius?: number;
}

export default function SegmentedBar({ segments, height = 8, borderRadius = 4 }: SegmentedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <View style={[styles.container, { height, borderRadius }]}>
      {segments.map((segment, i) => {
        const pct = (segment.value / total) * 100;
        if (pct === 0) return null;
        return (
          <View
            key={i}
            style={[
              styles.segment,
              { width: `${pct}%`, backgroundColor: segment.color },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
});
