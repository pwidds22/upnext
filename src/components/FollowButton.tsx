import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/constants';

interface FollowButtonProps {
  isFollowing: boolean;
  loading?: boolean;
  onPress: () => void;
  size?: 'small' | 'medium';
}

export default function FollowButton({
  isFollowing,
  loading = false,
  onPress,
  size = 'medium',
}: FollowButtonProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        isFollowing ? styles.following : styles.notFollowing,
      ]}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFollowing ? COLORS.text : COLORS.background}
        />
      ) : (
        <Text
          style={[
            styles.text,
            isSmall && styles.textSmall,
            isFollowing ? styles.followingText : styles.notFollowingText,
          ]}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 80,
  },
  notFollowing: {
    backgroundColor: COLORS.primary,
  },
  following: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 13,
  },
  notFollowingText: {
    color: COLORS.background,
  },
  followingText: {
    color: COLORS.textSecondary,
  },
});
