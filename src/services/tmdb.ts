import {
  TMDBSearchResponse,
  TMDBShow,
  TMDBSeason,
  TMDBWatchProvidersResponse,
  TMDBCountryProviders,
  TMDBMovie,
  TMDBMovieSearchResponse,
} from '../types';
import { TMDB_API_KEY, TMDB_BASE_URL, DEFAULT_COUNTRY_CODE } from '../utils/constants';

// Check if TMDB API key is configured (not empty, not a placeholder)
export const isTmdbConfigured = (): boolean => {
  // Must be non-empty and not an unresolved EAS secret placeholder
  return Boolean(TMDB_API_KEY && TMDB_API_KEY.length > 10 && !TMDB_API_KEY.startsWith('@'));
};

class TMDBService {
  private headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${TMDB_API_KEY}`,
  };

  // Validate config and fetch with error handling
  private async fetchWithValidation<T>(url: string, context: string): Promise<T> {
    if (!isTmdbConfigured()) {
      throw new Error('TMDB API key not configured');
    }

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`${context}: ${response.status}`);
    }

    return response.json();
  }

  // Search for TV shows
  async searchShows(query: string, page: number = 1): Promise<TMDBShow[]> {
    if (!query.trim()) return [];

    const url = `${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;
    const data = await this.fetchWithValidation<TMDBSearchResponse>(url, 'Search failed');
    return data.results;
  }

  // Get show details
  async getShowDetails(id: number): Promise<TMDBShow> {
    const url = `${TMDB_BASE_URL}/tv/${id}`;
    return this.fetchWithValidation<TMDBShow>(url, 'Failed to get show details');
  }

  // Get season with episodes
  async getSeason(showId: number, seasonNumber: number): Promise<TMDBSeason> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/season/${seasonNumber}`;
    return this.fetchWithValidation<TMDBSeason>(url, 'Failed to get season');
  }

  // Get all seasons for a show
  async getAllSeasons(showId: number, numberOfSeasons: number): Promise<TMDBSeason[]> {
    const promises = [];
    for (let i = 1; i <= numberOfSeasons; i++) {
      promises.push(this.getSeason(showId, i));
    }

    const results = await Promise.allSettled(promises);
    return results
      .filter((r): r is PromiseFulfilledResult<TMDBSeason> => r.status === 'fulfilled')
      .map((r) => r.value)
      .sort((a, b) => a.season_number - b.season_number);
  }

  // Get watch providers (streaming services)
  async getWatchProviders(
    showId: number,
    countryCode: string = DEFAULT_COUNTRY_CODE
  ): Promise<TMDBCountryProviders | null> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/watch/providers`;
    const data = await this.fetchWithValidation<TMDBWatchProvidersResponse>(
      url,
      'Failed to get watch providers'
    );
    return data.results?.[countryCode] || null;
  }

  // Paginated fetch helper — returns [] on error (graceful degradation for browsing data)
  private async fetchPaginated<T>(
    endpoint: string,
    pages: number,
    context: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    if (!isTmdbConfigured()) return [];

    const results: T[] = [];
    for (let page = 1; page <= pages; page++) {
      try {
        const searchParams = new URLSearchParams({ ...params, page: page.toString() });
        const url = `${TMDB_BASE_URL}/${endpoint}?${searchParams}`;
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
          console.warn(`${context} page ${page}: ${response.status}`);
          break;
        }

        const data = await response.json();
        results.push(...data.results);
      } catch (error) {
        console.warn(`${context} page ${page}:`, error);
        break;
      }
    }
    return results;
  }

  async getTrending(timeWindow: 'day' | 'week' = 'week', pages: number = 1): Promise<TMDBShow[]> {
    return this.fetchPaginated(`trending/tv/${timeWindow}`, pages, 'Failed to get trending');
  }

  async getPopular(pages: number = 1): Promise<TMDBShow[]> {
    return this.fetchPaginated('tv/popular', pages, 'Failed to get popular');
  }

  async getTopRated(pages: number = 1): Promise<TMDBShow[]> {
    return this.fetchPaginated('tv/top_rated', pages, 'Failed to get top rated');
  }

  async discoverByGenres(genreIds: number[], pages: number = 1): Promise<TMDBShow[]> {
    if (genreIds.length === 0) return [];
    const fifteenYearsAgo = new Date();
    fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
    const minDate = fifteenYearsAgo.toISOString().split('T')[0];

    return this.fetchPaginated('discover/tv', pages, 'Failed to discover shows', {
      with_genres: genreIds.join('|'),
      sort_by: 'popularity.desc',
      'vote_count.gte': '50',
      include_adult: 'false',
      'first_air_date.gte': minDate,
    });
  }

  // ==================== MOVIE ENDPOINTS ====================

  async searchMovies(query: string, page: number = 1): Promise<TMDBMovie[]> {
    if (!query.trim()) return [];

    const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;
    const data = await this.fetchWithValidation<TMDBMovieSearchResponse>(url, 'Movie search failed');
    return data.results;
  }

  async getMovieDetails(id: number): Promise<TMDBMovie> {
    const url = `${TMDB_BASE_URL}/movie/${id}`;
    return this.fetchWithValidation<TMDBMovie>(url, 'Failed to get movie details');
  }

  async getMovieWatchProviders(
    movieId: number,
    countryCode: string = DEFAULT_COUNTRY_CODE
  ): Promise<TMDBCountryProviders | null> {
    const url = `${TMDB_BASE_URL}/movie/${movieId}/watch/providers`;
    const data = await this.fetchWithValidation<TMDBWatchProvidersResponse>(
      url,
      'Failed to get movie watch providers'
    );
    return data.results?.[countryCode] || null;
  }

  async getTrendingMovies(timeWindow: 'day' | 'week' = 'week', pages: number = 1): Promise<TMDBMovie[]> {
    return this.fetchPaginated(`trending/movie/${timeWindow}`, pages, 'Failed to get trending movies');
  }

  async getPopularMovies(pages: number = 1): Promise<TMDBMovie[]> {
    return this.fetchPaginated('movie/popular', pages, 'Failed to get popular movies');
  }

  async getTopRatedMovies(pages: number = 1): Promise<TMDBMovie[]> {
    return this.fetchPaginated('movie/top_rated', pages, 'Failed to get top rated movies');
  }

  async discoverMoviesByGenres(genreIds: number[], pages: number = 1): Promise<TMDBMovie[]> {
    if (genreIds.length === 0) return [];
    const fifteenYearsAgo = new Date();
    fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
    const minDate = fifteenYearsAgo.toISOString().split('T')[0];

    return this.fetchPaginated('discover/movie', pages, 'Failed to discover movies', {
      with_genres: genreIds.join('|'),
      sort_by: 'popularity.desc',
      'vote_count.gte': '50',
      include_adult: 'false',
      'primary_release_date.gte': minDate,
    });
  }
}

export const tmdbService = new TMDBService();
