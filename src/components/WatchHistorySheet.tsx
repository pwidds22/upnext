import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WatchHistorySummary } from '../types';
import { COLORS } from '../utils/constants';

interface WatchHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  title: string; // Episode title or movie title
  subtitle?: string; // e.g., "S1 E5" for episodes
  getWatchHistory: () => Promise<WatchHistorySummary>;
  onAddWatch: () => Promise<void>;
  onRemoveWatch: () => Promise<void>;
  onDeleteWatch: (watchId: string) => Promise<void>;
}

export default function WatchHistorySheet({
  visible,
  onClose,
  title,
  subtitle,
  getWatchHistory,
  onAddWatch,
  onRemoveWatch,
  onDeleteWatch,
}: WatchHistorySheetProps) {
  const [history, setHistory] = useState<WatchHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWatchHistory();
      setHistory(data);
    } catch (e) {
      console.error('Failed to load watch history:', e);
    } finally {
      setLoading(false);
    }
  }, [getWatchHistory]);

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible, loadHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleAddWatch = async () => {
    setActionLoading(true);
    try {
      await onAddWatch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadHistory();
    } catch (e) {
      console.error('Failed to add watch:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLatest = async () => {
    if (!history || history.totalWatches === 0) return;

    setActionLoading(true);
    try {
      await onRemoveWatch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadHistory();
    } catch (e) {
      console.error('Failed to remove watch:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWatch = async (watchId: string) => {
    setActionLoading(true);
    try {
      await onDeleteWatch(watchId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadHistory();
    } catch (e) {
      console.error('Failed to delete watch:', e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Watch Count Summary */}
        {history && (
          <View style={styles.summaryContainer}>
            <View style={styles.watchCountBadge}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.primary} />
              <Text style={styles.watchCountText}>
                {history.totalWatches} {history.totalWatches === 1 ? 'watch' : 'watches'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAddWatch}
            disabled={actionLoading}
          >
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.actionButtonText}>Watch Again</Text>
          </TouchableOpacity>

          {history && history.totalWatches > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleRemoveLatest}
              disabled={actionLoading}
            >
              <Ionicons name="remove-circle" size={24} color={COLORS.error} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Remove Latest
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Watch History List */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Watch History</Text>

          {loading ? (
            <ActivityIndicator style={styles.loading} color={COLORS.primary} />
          ) : history && history.watches.length > 0 ? (
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {history.watches.map((watch, index) => (
                <View key={watch.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Text style={styles.watchNumber}>#{history.watches.length - index}</Text>
                    <Text style={styles.watchDate}>{formatDate(watch.watchedAt)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteWatch(watch.id)}
                    disabled={actionLoading}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No watch history yet</Text>
              <Text style={styles.emptySubtext}>Tap "Watch Again" to add your first watch</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  watchCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  watchCountText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.primary}15`,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: `${COLORS.error}10`,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionButtonTextSecondary: {
    color: COLORS.error,
  },
  historySection: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loading: {
    paddingVertical: 40,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  watchNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 32,
  },
  watchDate: {
    fontSize: 15,
    color: COLORS.text,
  },
  deleteButton: {
    padding: 8,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
});
