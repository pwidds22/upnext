import React from 'react';
import { TMDBMovie } from '../types';
import { getYearFromDate } from '../utils/constants';
import MediaCard from './MediaCard';

interface MovieCardProps {
  movie: TMDBMovie;
  onPress: (movie: TMDBMovie) => void;
  onDismiss?: (movie: TMDBMovie) => void;
}

export default function MovieCard({ movie, onPress, onDismiss }: MovieCardProps) {
  return (
    <MediaCard
      media={movie}
      title={movie.title}
      posterPath={movie.poster_path}
      year={getYearFromDate(movie.release_date)}
      rating={movie.vote_average}
      onPress={onPress}
      onDismiss={onDismiss}
    />
  );
}
