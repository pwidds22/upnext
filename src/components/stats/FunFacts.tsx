import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { FunFact } from '../../types';
import StatCard from './StatCard';

interface FunFactsProps {
  facts: FunFact[];
}

export default function FunFacts({ facts }: FunFactsProps) {
  return (
    <StatCard title="Fun Facts" icon="sparkles-outline">
      {facts.map((fact, i) => (
        <View key={i} style={styles.factRow}>
          <Ionicons
            name={fact.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.factText}>{fact.text}</Text>
        </View>
      ))}
    </StatCard>
  );
}

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
});
