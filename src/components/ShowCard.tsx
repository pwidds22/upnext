import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBShow } from '../types';
import ShowPoster from './ShowPoster';
import { COLORS, getYearFromDate } from '../utils/constants';

interface ShowCardProps {
  show: TMDBShow;
  onPress: (show: TMDBShow) => void;
  onDismiss?: (show: TMDBShow) => void;
}

export default function ShowCard({ show, onPress, onDismiss }: ShowCardProps) {
  const year = getYearFromDate(show.first_air_date);
  const rating = show.vote_average;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(show)} activeOpacity={0.7}>
      <View style={styles.posterContainer}>
        <ShowPoster path={show.poster_path} size="small" width={100} height={150} />
        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => onDismiss(show)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={22} color="rgba(0,0,0,0.6)" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {show.name}
      </Text>
      {rating !== undefined && rating > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.rating}>{rating.toFixed(1)}</Text>
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
