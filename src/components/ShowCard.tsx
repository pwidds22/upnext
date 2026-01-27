import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TMDBShow } from '../types';
import ShowPoster from './ShowPoster';
import { COLORS, getYearFromDate } from '../utils/constants';

interface ShowCardProps {
  show: TMDBShow;
  onPress: (show: TMDBShow) => void;
}

export default function ShowCard({ show, onPress }: ShowCardProps) {
  const year = getYearFromDate(show.first_air_date);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(show)} activeOpacity={0.7}>
      <ShowPoster path={show.poster_path} size="small" width={100} height={150} />
      <Text style={styles.title} numberOfLines={2}>
        {show.name}
      </Text>
      {year && <Text style={styles.year}>{year}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 8,
  },
  year: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
