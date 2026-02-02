import React from 'react';
import { TMDBShow } from '../types';
import { getYearFromDate } from '../utils/constants';
import MediaCard from './MediaCard';

interface ShowCardProps {
  show: TMDBShow;
  onPress: (show: TMDBShow) => void;
  onDismiss?: (show: TMDBShow) => void;
}

export default function ShowCard({ show, onPress, onDismiss }: ShowCardProps) {
  return (
    <MediaCard
      media={show}
      title={show.name}
      posterPath={show.poster_path}
      year={getYearFromDate(show.first_air_date)}
      rating={show.vote_average}
      onPress={onPress}
      onDismiss={onDismiss}
    />
  );
}
