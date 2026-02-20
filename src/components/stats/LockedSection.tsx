import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

interface LockedSectionProps {
  isPremium: boolean;
  title: string;
  children: React.ReactNode;
  onUnlock?: () => void;
}

export default function LockedSection({ isPremium, title, children, onUnlock }: LockedSectionProps) {
  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.blurred} pointerEvents="none">
        {children}
      </View>
      <View style={styles.overlay}>
        <Ionicons name="lock-closed" size={28} color={COLORS.textSecondary} />
        <Text style={styles.lockTitle}>{title}</Text>
        <TouchableOpacity style={styles.unlockButton} onPress={onUnlock}>
          <Text style={styles.unlockText}>Unlock with Premium</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
  },
  blurred: {
    opacity: 0.25,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  unlockButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});
