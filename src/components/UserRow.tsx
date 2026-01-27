import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import FollowButton from './FollowButton';
import type { UserWithFollowStatus } from '../types';

interface UserRowProps {
  user: UserWithFollowStatus;
  onPress: () => void;
  onFollowPress?: () => void;
  showFollowButton?: boolean;
  isCurrentUser?: boolean;
  followLoading?: boolean;
}

export default function UserRow({
  user,
  onPress,
  onFollowPress,
  showFollowButton = true,
  isCurrentUser = false,
  followLoading = false,
}: UserRowProps) {
  const displayName = user.displayName || user.username || 'User';
  const initial = displayName[0].toUpperCase();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {/* Avatar */}
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      {/* User Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
          </Text>
          {user.isFollowedBy && !isCurrentUser && (
            <View style={styles.followsYouBadge}>
              <Text style={styles.followsYouText}>Follows you</Text>
            </View>
          )}
        </View>
        {user.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
      </View>

      {/* Follow Button */}
      {showFollowButton && !isCurrentUser && onFollowPress && (
        <FollowButton
          isFollowing={user.isFollowing}
          onPress={onFollowPress}
          size="small"
          loading={followLoading}
        />
      )}

      {/* Chevron for navigation (when no follow button) */}
      {!showFollowButton && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: COLORS.background,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },
  username: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  followsYouBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  followsYouText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
