import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TMDBEpisode, EpisodeReactionType } from '../types';
import { COLORS, getStillUrl, formatEpisodeCode, getCountdownText } from '../utils/constants';
import EpisodeReactionPicker from './EpisodeReactionPicker';

interface EpisodeRowProps {
  episode: TMDBEpisode;
  isWatched: boolean;
  onToggle: () => void;
  reaction?: EpisodeReactionType | null;
  onReactionChange?: (reaction: EpisodeReactionType) => void;
}

export default function EpisodeRow({
  episode,
  isWatched,
  onToggle,
  reaction,
  onReactionChange,
}: EpisodeRowProps) {
  const stillUrl = getStillUrl(episode.still_path, 'small');
  const isUpcoming = episode.air_date ? new Date(episode.air_date) > new Date() : false;
  const countdown = getCountdownText(episode.air_date);

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <View style={[styles.container, isWatched && styles.watched]}>
      {/* Episode Still */}
      <View style={styles.stillContainer}>
        {stillUrl ? (
          <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
        ) : (
          <View style={styles.stillPlaceholder}>
            <Ionicons name="play" size={20} color={COLORS.textSecondary} />
          </View>
        )}
      </View>

      {/* Episode Info */}
      <View style={styles.info}>
        <View style={styles.codeRow}>
          <Text style={styles.code}>E{String(episode.episode_number).padStart(2, '0')}</Text>
          {episode.runtime && (
            <Text style={styles.runtime}>• {episode.runtime}m</Text>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {episode.name}
        </Text>

        {isUpcoming && countdown && (
          <Text style={styles.countdown}>{countdown}</Text>
        )}
        {!isUpcoming && episode.air_date && (
          <Text style={styles.airDate}>{episode.air_date}</Text>
        )}
      </View>

      {/* Reaction Picker - only show when watched */}
      {isWatched && onReactionChange && (
        <EpisodeReactionPicker
          currentReaction={reaction ?? null}
          onSelect={onReactionChange}
          size="small"
        />
      )}

      {/* Watch Toggle */}
      <TouchableOpacity onPress={handleToggle} style={styles.toggleButton}>
        <Ionicons
          name={isWatched ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={isWatched ? COLORS.primary : COLORS.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  watched: {
    opacity: 0.6,
  },
  stillContainer: {
    width: 100,
    height: 56,
    borderRadius: 6,
    overflow: 'hidden',
  },
  still: {
    width: '100%',
    height: '100%',
  },
  stillPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  code: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  runtime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  countdown: {
    fontSize: 12,
    color: COLORS.blue,
    fontWeight: '500',
  },
  airDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  toggleButton: {
    padding: 4,
  },
});
