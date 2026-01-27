import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { EpisodeReactionType, REACTION_CONFIG } from '../types';
import { COLORS } from '../utils/constants';

interface EpisodeReactionPickerProps {
  currentReaction: EpisodeReactionType | null;
  onSelect: (reaction: EpisodeReactionType) => void;
  size?: 'small' | 'normal';
}

const REACTION_TYPES: EpisodeReactionType[] = ['good', 'meh', 'bad'];

export default function EpisodeReactionPicker({
  currentReaction,
  onSelect,
  size = 'normal',
}: EpisodeReactionPickerProps) {
  const handleSelect = async (reaction: EpisodeReactionType) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(reaction);
  };

  const emojiSize = size === 'small' ? 16 : 20;

  return (
    <View style={styles.container}>
      {REACTION_TYPES.map((type) => {
        const config = REACTION_CONFIG[type];
        const isSelected = currentReaction === type;

        return (
          <TouchableOpacity
            key={type}
            onPress={() => handleSelect(type)}
            style={[
              styles.option,
              size === 'small' && styles.optionSmall,
              isSelected && styles.optionSelected,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.emoji, { fontSize: emojiSize }]}>{config.emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  option: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  optionSmall: {
    padding: 4,
  },
  optionSelected: {
    backgroundColor: COLORS.surfaceLight,
  },
  emoji: {
    fontSize: 20,
  },
});
