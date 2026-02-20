import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../utils/constants';
import { useSubscription } from '../contexts/SubscriptionContext';

const FEATURES = [
  { icon: 'stats-chart', label: 'Detailed viewing stats & trends' },
  { icon: 'calendar', label: 'Activity calendar heatmap' },
  { icon: 'trophy', label: 'Most watched shows leaderboard' },
  { icon: 'bulb', label: 'Fun facts about your viewing habits' },
];

export default function PaywallScreen() {
  const navigation = useNavigation();
  const { isPremium, restorePurchases } = useSubscription();

  const handleRestore = async () => {
    const { success, error } = await restorePurchases();
    if (success) {
      Alert.alert('Restored', 'Your purchases have been restored.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Restore Failed', error || 'Could not restore purchases. Please try again.');
    }
  };

  if (isPremium) {
    return (
      <View style={styles.container}>
        <Ionicons name="star" size={64} color={COLORS.primary} />
        <Text style={styles.title}>You're Premium!</Text>
        <Text style={styles.subtitle}>You have access to all premium features.</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="star" size={64} color={COLORS.warning} />
      <Text style={styles.title}>UpNext Premium</Text>
      <Text style={styles.subtitle}>
        Unlock the full power of your viewing data
      </Text>

      <View style={styles.featureList}>
        {FEATURES.map((feature) => (
          <View key={feature.label} style={styles.featureRow}>
            <Ionicons name={feature.icon as any} size={20} color={COLORS.primary} />
            <Text style={styles.featureText}>{feature.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.comingSoon}>Purchase options coming soon</Text>

      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  featureList: {
    marginTop: 24,
    gap: 14,
    alignSelf: 'stretch',
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: COLORS.text,
  },
  comingSoon: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 32,
  },
  restoreButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  restoreText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
  },
  doneButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
