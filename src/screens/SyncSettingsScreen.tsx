import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSyncContext } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';

export default function SyncSettingsScreen() {
  const { user } = useAuth();
  const {
    syncState,
    isOnline,
    pendingChangesCount,
    lastSyncedAt,
    syncError,
    triggerSync,
    triggerFullSync,
  } = useSyncContext();

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const isSyncing = syncState === 'syncing';

  const formatLastSynced = () => {
    if (!lastSyncedAt) return 'Never';

    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleSyncNow = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to sync your data.');
      return;
    }

    if (!isOnline) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await triggerSync();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFullSync = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to sync your data.');
      return;
    }

    if (!isOnline) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    Alert.alert(
      'Full Sync',
      'This will sync all your data with the cloud. This may take a moment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await triggerFullSync();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getSyncStatusIcon = () => {
    if (!user) return 'cloud-offline';
    if (!isOnline) return 'cloud-offline';
    if (isSyncing) return 'sync';
    if (syncState === 'error') return 'cloud-offline';
    if (pendingChangesCount > 0) return 'cloud-upload';
    return 'cloud-done';
  };

  const getSyncStatusColor = () => {
    if (!user || !isOnline) return COLORS.textSecondary;
    if (syncState === 'error') return COLORS.error;
    if (pendingChangesCount > 0) return COLORS.warning;
    return COLORS.primary;
  };

  const getSyncStatusText = () => {
    if (!user) return 'Sign in to sync';
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (syncState === 'error') return 'Sync failed';
    if (pendingChangesCount > 0) return `${pendingChangesCount} pending change${pendingChangesCount === 1 ? '' : 's'}`;
    return 'Synced';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sync Status Card */}
      <View style={styles.statusCard}>
        <View style={[styles.statusIconContainer, { backgroundColor: `${getSyncStatusColor()}15` }]}>
          <Ionicons
            name={getSyncStatusIcon() as any}
            size={32}
            color={getSyncStatusColor()}
          />
        </View>
        <Text style={styles.statusText}>{getSyncStatusText()}</Text>
        {lastSyncedAt && (
          <Text style={styles.lastSyncText}>Last synced: {formatLastSynced()}</Text>
        )}
        {syncError && (
          <Text style={styles.errorText}>{syncError}</Text>
        )}
      </View>

      {/* Sync Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={[styles.actionButton, isSyncing && styles.actionButtonDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing || !user}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="sync-outline" size={22} color={COLORS.primary} />
          )}
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Sync Now</Text>
            <Text style={styles.actionSubtitle}>Push local changes to the cloud</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, isSyncing && styles.actionButtonDisabled]}
          onPress={handleFullSync}
          disabled={isSyncing || !user}
        >
          <Ionicons name="cloud-download-outline" size={22} color={COLORS.primary} />
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Full Sync</Text>
            <Text style={styles.actionSubtitle}>Re-sync all data with the cloud</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sync Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Auto-sync</Text>
            <Text style={styles.settingSubtitle}>
              Automatically sync changes when online
            </Text>
          </View>
          <Switch
            value={autoSyncEnabled}
            onValueChange={setAutoSyncEnabled}
            trackColor={{ false: COLORS.border, true: `${COLORS.primary}60` }}
            thumbColor={autoSyncEnabled ? COLORS.primary : COLORS.textTertiary}
          />
        </View>
      </View>

      {/* Sync Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Connection Status</Text>
          <View style={styles.infoValueContainer}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.primary : COLORS.error }]} />
            <Text style={styles.infoValue}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Pending Changes</Text>
          <Text style={styles.infoValue}>{pendingChangesCount}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Sync Status</Text>
          <Text style={[styles.infoValue, { color: getSyncStatusColor() }]}>
            {syncState.charAt(0).toUpperCase() + syncState.slice(1)}
          </Text>
        </View>
      </View>

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Your data is stored locally on your device and synced to the cloud when you're online.
          Changes made while offline will be synced automatically when you reconnect.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  statusCard: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  lastSyncText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  helpContainer: {
    padding: 20,
  },
  helpText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
