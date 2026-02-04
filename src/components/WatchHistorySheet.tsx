import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { WatchHistorySummary } from '../types';
import { COLORS } from '../utils/constants';

interface WatchHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  title: string; // Episode title or movie title
  subtitle?: string; // e.g., "S1 E5" for episodes
  getWatchHistory: () => Promise<WatchHistorySummary>;
  onAddWatch: (watchedAt?: string) => Promise<void>;
  onRemoveWatch: () => Promise<void>;
  onDeleteWatch: (watchId: string) => Promise<void>;
  onUpdateWatch?: (watchId: string, watchedAt: string) => Promise<void>;
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
  onUpdateWatch,
}: WatchHistorySheetProps) {
  const [history, setHistory] = useState<WatchHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingWatchId, setEditingWatchId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWatchHistory();
      setHistory(data);
    } catch (e) {
      console.error('Failed to load watch history:', e);
      Alert.alert('Error', 'Failed to load watch history. Please try again.');
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

  const openAddWatchPicker = () => {
    setSelectedDate(new Date());
    setEditingWatchId(null);
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const openEditWatchPicker = (watchId: string, currentDate: string) => {
    setSelectedDate(new Date(currentDate));
    setEditingWatchId(watchId);
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        if (pickerMode === 'date') {
          setSelectedDate(date);
          setPickerMode('time');
          setShowDatePicker(true);
        } else {
          confirmDateSelection(date);
        }
      }
    } else {
      // iOS - date picker stays open
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const confirmDateSelection = async (date: Date = selectedDate) => {
    setShowDatePicker(false);
    setActionLoading(true);
    try {
      const isoDate = date.toISOString();
      if (editingWatchId && onUpdateWatch) {
        await onUpdateWatch(editingWatchId, isoDate);
      } else {
        await onAddWatch(isoDate);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadHistory();
    } catch (e) {
      console.error('Failed to save watch:', e);
      Alert.alert('Error', 'Failed to save watch entry. Please try again.');
    } finally {
      setActionLoading(false);
      setEditingWatchId(null);
    }
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
    setEditingWatchId(null);
  };

  const handleAddWatch = async () => {
    openAddWatchPicker();
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
      Alert.alert('Error', 'Failed to remove watch entry. Please try again.');
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
      Alert.alert('Error', 'Failed to delete watch entry. Please try again.');
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
                  <View style={styles.historyItemActions}>
                    {onUpdateWatch && (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditWatchPicker(watch.id, watch.watchedAt)}
                        disabled={actionLoading}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteWatch(watch.id)}
                      disabled={actionLoading}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
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

        {/* Date Picker Modal */}
        {showDatePicker && (
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={cancelDateSelection}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {editingWatchId ? 'Edit Watch Date' : 'When did you watch?'}
                </Text>
                <TouchableOpacity onPress={() => confirmDateSelection()}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                themeVariant="dark"
              />
            </View>
          </View>
        )}
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
  historyItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  datePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  datePickerCancel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
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
