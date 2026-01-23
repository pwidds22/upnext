import React from 'react';
import { View, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getPosterUrl, COLORS } from '../utils/constants';

interface ShowPosterProps {
  path: string | null;
  size?: 'small' | 'medium' | 'large';
  width?: number;
  height?: number;
  style?: ViewStyle | ImageStyle;
}

export default function ShowPoster({
  path,
  size = 'medium',
  width,
  height,
  style,
}: ShowPosterProps) {
  const imageUrl = getPosterUrl(path, size);

  // Default dimensions based on 2:3 aspect ratio
  const defaultWidth = size === 'small' ? 60 : size === 'medium' ? 120 : 200;
  const finalWidth = width ?? defaultWidth;
  const finalHeight = height ?? finalWidth * 1.5;

  if (!imageUrl) {
    return (
      <View style={[styles.placeholder, { width: finalWidth, height: finalHeight }, style]}>
        <Ionicons name="tv-outline" size={finalWidth * 0.3} color={COLORS.textSecondary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[{ width: finalWidth, height: finalHeight, borderRadius: 8 }, style as ImageStyle]}
      contentFit="cover"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
