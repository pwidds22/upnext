import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

interface StarRatingProps {
  /** Rating value (0-10 scale, stored in database) */
  value: number;
  /** Callback when rating changes (receives 0-10 value) */
  onChange?: (value: number) => void;
  /** Size of stars in pixels */
  size?: number;
  /** Whether the rating is read-only */
  readonly?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Color for filled stars */
  color?: string;
  /** Color for empty stars */
  emptyColor?: string;
}

/**
 * Star rating component that displays 1-5 stars with half-star support
 * Internally works with 0-10 scale for database compatibility
 *
 * Interaction:
 * - Tap a star = set to that many full stars
 * - Tap the same star again = toggle to half star (e.g., 4 → 3.5)
 * - Tap again = back to full (e.g., 3.5 → 4)
 *
 * Visual mapping:
 * - 1 = 0.5 stars, 2 = 1 star, 3 = 1.5 stars, etc.
 */
export default function StarRating({
  value,
  onChange,
  size = 24,
  readonly = false,
  style,
  color = COLORS.warning,
  emptyColor = COLORS.textSecondary,
}: StarRatingProps) {
  // Convert 0-10 to 0-5 for display
  const displayValue = value / 2;

  const handlePress = (starIndex: number) => {
    if (readonly || !onChange) return;

    // Full value for this star (e.g., star 4 = value 8)
    const fullValue = (starIndex + 1) * 2;
    // Half value for this star (e.g., star 4 = value 7 = 3.5 stars)
    const halfValue = (starIndex * 2) + 1;

    // If already at full value for this star, toggle to half
    // Otherwise, set to full value
    if (value === fullValue) {
      onChange(halfValue);
    } else {
      onChange(fullValue);
    }
  };

  const renderStar = (index: number) => {
    // index is 0-4 (5 stars)
    // displayValue is 0-5
    const starNumber = index + 1;

    let iconName: 'star' | 'star-half' | 'star-outline';
    let iconColor: string;

    if (displayValue >= starNumber) {
      // Full star
      iconName = 'star';
      iconColor = color;
    } else if (displayValue >= starNumber - 0.5) {
      // Half star (for values like 0.5, 1.5, etc.)
      iconName = 'star-half';
      iconColor = color;
    } else {
      // Empty star
      iconName = 'star-outline';
      iconColor = emptyColor;
    }

    const starElement = (
      <Ionicons
        name={iconName}
        size={size}
        color={iconColor}
      />
    );

    if (readonly) {
      return (
        <View key={index} style={styles.star}>
          {starElement}
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        onPress={() => handlePress(index)}
        style={styles.star}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        {starElement}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {[0, 1, 2, 3, 4].map(renderStar)}
    </View>
  );
}

// Utility functions for converting between scales
export function starsToValue(stars: number): number {
  // Convert 1-5 stars to 0-10 value
  return Math.max(0, Math.min(10, stars * 2));
}

export function valueToStars(value: number): number {
  // Convert 0-10 value to 0-5 stars
  return Math.max(0, Math.min(5, value / 2));
}

export function formatRating(value: number): string {
  // Format 0-10 value as X.X/5 stars
  const stars = valueToStars(value);
  // Only show decimal if it's a half star
  if (stars % 1 === 0) {
    return `${stars}/5`;
  }
  return `${stars.toFixed(1)}/5`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginHorizontal: 2,
  },
});
