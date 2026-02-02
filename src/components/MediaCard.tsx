import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ShowPoster from './ShowPoster';
import { COLORS } from '../utils/constants';
import { formatRating } from './StarRating';

interface MediaCardProps<T> {
  media: T;
  title: string;
  posterPath: string | null | undefined;
  year: string | null;
  rating: number | undefined;
  onPress: (media: T) => void;
  onDismiss?: (media: T) => void;
}

/**
 * Generic media card component used for both shows and movies.
 * ShowCard and MovieCard are thin wrappers around this component.
 */
export default function MediaCard<T>({
  media,
  title,
  posterPath,
  year,
  rating,
  onPress,
  onDismiss,
}: MediaCardProps<T>) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(media)} activeOpacity={0.7}>
      <View style={styles.posterContainer}>
        <ShowPoster path={posterPath ?? null} size="small" width={100} height={150} />
        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => onDismiss(media)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={22} color="rgba(0,0,0,0.6)" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {rating !== undefined && rating > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.rating}>{formatRating(rating)}</Text>
        </View>
      )}
      {year && <Text style={styles.year}>{year}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
  },
  posterContainer: {
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  rating: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  year: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
