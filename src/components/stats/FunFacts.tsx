import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { FunFact } from '../../types';
import StatCard from './StatCard';

interface FunFactsProps {
  facts: FunFact[];
  isPremium: boolean;
}

export default function FunFacts({ facts, isPremium }: FunFactsProps) {
  // Show first fact free, rest require premium
  const visibleFacts = isPremium ? facts : facts.slice(0, 1);

  return (
    <StatCard title="Fun Facts" icon="sparkles-outline">
      {visibleFacts.map((fact, i) => (
        <View key={i} style={styles.factRow}>
          <Ionicons
            name={fact.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.factText}>{fact.text}</Text>
        </View>
      ))}
      {!isPremium && facts.length > 1 && (
        <View style={styles.lockedRow}>
          <Ionicons name="lock-closed" size={16} color={COLORS.textTertiary} />
          <Text style={styles.lockedText}>
            +{facts.length - 1} more with Premium
          </Text>
        </View>
      )}
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
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lockedText: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
});
