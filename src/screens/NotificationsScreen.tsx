import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../utils/constants';

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

interface NotificationSettings {
  episodeReminders: boolean;
  movieReminders: boolean;
  reminderTime: 'morning' | 'afternoon' | 'evening';
}

const defaultSettings: NotificationSettings = {
  episodeReminders: true,
  movieReminders: true,
  reminderTime: 'evening',
};

const reminderTimeOptions = [
  { value: 'morning', label: 'Morning', time: '9:00 AM' },
  { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
  { value: 'evening', label: 'Evening', time: '7:00 PM' },
];

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const checkPermissions = async () => {
    if (!Device.isDevice) {
      setHasPermission(false);
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestPermissions = async () => {
    if (!Device.isDevice) {
      Alert.alert(
        'Not Available',
        'Push notifications are not available on simulators. Please test on a physical device.'
      );
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                // iOS: Link to app settings
                Notifications.getPermissionsAsync();
              }
            },
          },
        ]
      );
      return;
    }

    setHasPermission(true);
    Alert.alert('Success', 'Notifications enabled successfully!');
  };

  const toggleSetting = (key: keyof Pick<NotificationSettings, 'episodeReminders' | 'movieReminders'>) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const setReminderTime = (time: NotificationSettings['reminderTime']) => {
    const newSettings = { ...settings, reminderTime: time };
    saveSettings(newSettings);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Permission Status */}
      {hasPermission === false && (
        <TouchableOpacity style={styles.permissionBanner} onPress={requestPermissions}>
          <Ionicons name="notifications-off" size={24} color={COLORS.warning} />
          <View style={styles.permissionTextContainer}>
            <Text style={styles.permissionTitle}>Notifications Disabled</Text>
            <Text style={styles.permissionSubtitle}>Tap to enable push notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.warning} />
        </TouchableOpacity>
      )}

      {hasPermission === true && (
        <View style={styles.permissionBannerSuccess}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
          <Text style={styles.permissionSuccessText}>Notifications are enabled</Text>
        </View>
      )}

      {/* Reminder Types */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminders</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="tv-outline" size={22} color={COLORS.text} />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>New Episode Alerts</Text>
            <Text style={styles.settingSubtitle}>
              Get notified when new episodes of your shows air
            </Text>
          </View>
          <Switch
            value={settings.episodeReminders}
            onValueChange={() => toggleSetting('episodeReminders')}
            trackColor={{ false: COLORS.border, true: `${COLORS.primary}60` }}
            thumbColor={settings.episodeReminders ? COLORS.primary : COLORS.textTertiary}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="film-outline" size={22} color={COLORS.text} />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Movie Releases</Text>
            <Text style={styles.settingSubtitle}>
              Get notified when movies on your watchlist are released
            </Text>
          </View>
          <Switch
            value={settings.movieReminders}
            onValueChange={() => toggleSetting('movieReminders')}
            trackColor={{ false: COLORS.border, true: `${COLORS.primary}60` }}
            thumbColor={settings.movieReminders ? COLORS.primary : COLORS.textTertiary}
          />
        </View>
      </View>

      {/* Reminder Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminder Time</Text>
        <Text style={styles.sectionSubtitle}>
          When would you like to receive daily reminders?
        </Text>

        {reminderTimeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.timeOption,
              settings.reminderTime === option.value && styles.timeOptionSelected,
            ]}
            onPress={() => setReminderTime(option.value as NotificationSettings['reminderTime'])}
          >
            <View style={styles.timeOptionContent}>
              <Text
                style={[
                  styles.timeOptionLabel,
                  settings.reminderTime === option.value && styles.timeOptionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.timeOptionTime}>{option.time}</Text>
            </View>
            {settings.reminderTime === option.value && (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Reminders are sent on the day of air/release. You'll receive a single notification
          summarizing all new content for the day.
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}15`,
    padding: 16,
    gap: 12,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: 13,
    color: COLORS.warning,
    opacity: 0.8,
  },
  permissionBannerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    padding: 16,
    gap: 12,
  },
  permissionSuccessText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  timeOptionSelected: {
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  timeOptionContent: {
    flex: 1,
  },
  timeOptionLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  timeOptionLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  timeOptionTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
