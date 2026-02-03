import { useState, useEffect, useCallback } from 'react';
import { TMDBShow, TMDBMovie } from '../types';
import { tmdbService } from '../services/tmdb';
import { SEARCH_DEBOUNCE_MS, MAX_SEARCH_RESULTS } from '../utils/constants';

type SearchType = 'tv' | 'movie';

export function useSearch() {
  const [searchType, setSearchType] = useState<SearchType>('tv');
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState<TMDBShow[]>([]);
  const [movieResults, setMovieResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setShowResults([]);
      setMovieResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        if (searchType === 'tv') {
          const searchResults = await tmdbService.searchShows(query);
          setShowResults(searchResults.slice(0, MAX_SEARCH_RESULTS));
        } else {
          const searchResults = await tmdbService.searchMovies(query);
          setMovieResults(searchResults.slice(0, MAX_SEARCH_RESULTS));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setShowResults([]);
        setMovieResults([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, searchType]);

  // Clear results when switching search type
  useEffect(() => {
    setShowResults([]);
    setMovieResults([]);
  }, [searchType]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setShowResults([]);
    setMovieResults([]);
    setError(null);
  }, []);

  return {
    searchType,
    setSearchType,
    query,
    setQuery,
    showResults,
    movieResults,
    loading,
    error,
    clearSearch,
  };
}
