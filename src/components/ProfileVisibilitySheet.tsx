import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ProfileVisibility } from '../types';
import { COLORS } from '../utils/constants';

interface ProfileVisibilitySheetProps {
  visible: boolean;
  onClose: () => void;
  visibility: ProfileVisibility;
  onSave: (visibility: ProfileVisibility) => Promise<void>;
}

interface VisibilityOption {
  key: keyof ProfileVisibility;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    key: 'shows',
    title: 'Tracked Shows & Movies',
    description: 'Show your tracked content to profile visitors',
    icon: 'tv-outline',
  },
  {
    key: 'activity',
    title: 'Activity Feed',
    description: 'Show your recent watch activity on your profile',
    icon: 'time-outline',
  },
  {
    key: 'stats',
    title: 'Profile Stats',
    description: 'Show total shows, movies, and episodes watched',
    icon: 'stats-chart-outline',
  },
];

export default function ProfileVisibilitySheet({
  visible,
  onClose,
  visibility,
  onSave,
}: ProfileVisibilitySheetProps) {
  const [localVisibility, setLocalVisibility] = useState<ProfileVisibility>(visibility);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local state when visibility prop changes
  useEffect(() => {
    setLocalVisibility(visibility);
    setHasChanges(false);
  }, [visibility]);

  const handleToggle = (key: keyof ProfileVisibility) => {
    setLocalVisibility((prev) => {
      const newVisibility = { ...prev, [key]: !prev[key] };
      setHasChanges(
        newVisibility.shows !== visibility.shows ||
        newVisibility.activity !== visibility.activity ||
        newVisibility.stats !== visibility.stats
      );
      return newVisibility;
    });
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onSave(localVisibility);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      console.error('Failed to save visibility settings:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset to original if not saved
    setLocalVisibility(visibility);
    setHasChanges(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            Control what others can see when they visit your profile.
          </Text>
        </View>

        {/* Toggle Options */}
        <View style={styles.optionsContainer}>
          {VISIBILITY_OPTIONS.map((option) => (
            <View key={option.key} style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Switch
                value={localVisibility[option.key]}
                onValueChange={() => handleToggle(option.key)}
                trackColor={{ false: COLORS.border, true: `${COLORS.primary}80` }}
                thumbColor={localVisibility[option.key] ? COLORS.primary : COLORS.textTertiary}
              />
            </View>
          ))}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>
            These settings apply to everyone who views your profile, including people who follow you.
          </Text>
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !hasChanges && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.saveButtonText}>
                {hasChanges ? 'Save Changes' : 'Done'}
              </Text>
            )}
          </TouchableOpacity>
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
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  optionsContainer: {
    paddingHorizontal: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 14,
    backgroundColor: `${COLORS.textSecondary}10`,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    padding: 16,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textTertiary,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
});
