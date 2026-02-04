import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TMDBEpisode, EpisodeReactionType } from '../types';
import { COLORS, getStillUrl, getCountdownText, hasAiredPacific, formatAirDate } from '../utils/constants';
import EpisodeReactionPicker from './EpisodeReactionPicker';

interface EpisodeRowProps {
  episode: TMDBEpisode;
  isWatched: boolean;
  watchCount?: number;
  onToggle: () => void;
  onAddWatch?: () => void;
  onRemoveWatch?: () => void;
  onViewHistory?: () => void;
  reaction?: EpisodeReactionType | null;
  onReactionChange?: (reaction: EpisodeReactionType) => void;
}

export default function EpisodeRow({
  episode,
  isWatched,
  watchCount = 0,
  onToggle,
  onAddWatch,
  onRemoveWatch,
  onViewHistory,
  reaction,
  onReactionChange,
}: EpisodeRowProps) {
  const [showActionMenu, setShowActionMenu] = useState(false);
  const stillUrl = getStillUrl(episode.still_path, 'small');
  const isUpcoming = episode.air_date ? !hasAiredPacific(episode.air_date) : false;
  const countdown = getCountdownText(episode.air_date);
  const hasRewatchSupport = onAddWatch && onRemoveWatch && onViewHistory;

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isWatched && hasRewatchSupport) {
      // Show action menu for watched episodes
      setShowActionMenu(true);
    } else {
      // First watch - use toggle
      onToggle();
    }
  };

  const handleWatchAgain = async () => {
    setShowActionMenu(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAddWatch?.();
  };

  const handleRemoveWatch = async () => {
    setShowActionMenu(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRemoveWatch?.();
  };

  const handleViewHistory = () => {
    setShowActionMenu(false);
    onViewHistory?.();
  };

  return (
    <>
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
            <Text style={styles.airDate}>{formatAirDate(episode.air_date)}</Text>
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

        {/* Watch Toggle Button */}
        <TouchableOpacity onPress={handlePress} style={styles.toggleButton}>
          <View style={styles.watchButtonContainer}>
            <Ionicons
              name={isWatched ? 'checkmark-circle' : 'ellipse-outline'}
              size={28}
              color={isWatched ? COLORS.primary : COLORS.textSecondary}
            />
            {/* Watch count badge for rewatches */}
            {watchCount > 1 && (
              <View style={styles.watchCountBadge}>
                <Text style={styles.watchCountText}>{watchCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Action Menu Modal */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionMenu(false)}>
          <View style={styles.actionMenu}>
            <Text style={styles.actionMenuTitle}>{episode.name}</Text>
            <Text style={styles.actionMenuSubtitle}>
              {watchCount} {watchCount === 1 ? 'watch' : 'watches'}
            </Text>

            <TouchableOpacity style={styles.actionMenuItem} onPress={handleWatchAgain}>
              <Ionicons name="add-circle" size={22} color={COLORS.primary} />
              <Text style={styles.actionMenuItemText}>Watch Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionMenuItem} onPress={handleRemoveWatch}>
              <Ionicons name="remove-circle" size={22} color={COLORS.error} />
              <Text style={[styles.actionMenuItemText, { color: COLORS.error }]}>Remove Watch</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionMenuItem} onPress={handleViewHistory}>
              <Ionicons name="time" size={22} color={COLORS.textSecondary} />
              <Text style={styles.actionMenuItemText}>View History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuItem, styles.actionMenuCancel]}
              onPress={() => setShowActionMenu(false)}
            >
              <Text style={styles.actionMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
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
  watchButtonContainer: {
    position: 'relative',
  },
  watchCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  watchCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  // Action Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionMenu: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  actionMenuTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionMenuSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionMenuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  actionMenuCancel: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
  actionMenuCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
