import {
  TMDBSearchResponse,
  TMDBShow,
  TMDBSeason,
  TMDBWatchProvidersResponse,
  TMDBCountryProviders,
} from '../types';
import { TMDB_API_KEY, TMDB_BASE_URL, DEFAULT_COUNTRY_CODE } from '../utils/constants';

class TMDBService {
  private headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${TMDB_API_KEY}`,
  };

  // Search for TV shows
  async searchShows(query: string, page: number = 1): Promise<TMDBShow[]> {
    if (!query.trim()) return [];

    const url = `${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  }

  // Get show details
  async getShowDetails(id: number): Promise<TMDBShow> {
    const url = `${TMDB_BASE_URL}/tv/${id}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get show details: ${response.status}`);
    }

    return response.json();
  }

  // Get season with episodes
  async getSeason(showId: number, seasonNumber: number): Promise<TMDBSeason> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/season/${seasonNumber}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get season: ${response.status}`);
    }

    return response.json();
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

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get watch providers: ${response.status}`);
    }

    const data: TMDBWatchProvidersResponse = await response.json();
    return data.results?.[countryCode] || null;
  }

  // Get trending TV shows
  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBShow[]> {
    const url = `${TMDB_BASE_URL}/trending/tv/${timeWindow}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get trending: ${response.status}`);
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  }

  // Get popular TV shows
  async getPopular(page: number = 1): Promise<TMDBShow[]> {
    const url = `${TMDB_BASE_URL}/tv/popular?page=${page}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get popular: ${response.status}`);
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  }

  // Discover TV shows by genre (OR logic - matches ANY of the genres)
  async discoverByGenres(genreIds: number[]): Promise<TMDBShow[]> {
    if (genreIds.length === 0) return [];

    const params = new URLSearchParams({
      with_genres: genreIds.join('|'), // Use pipe for OR logic (comma = AND)
      sort_by: 'popularity.desc',
      'vote_count.gte': '50',
      include_adult: 'false',
    });

    const url = `${TMDB_BASE_URL}/discover/tv?${params}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to discover shows: ${response.status}`);
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  }
}

export const tmdbService = new TMDBService();
