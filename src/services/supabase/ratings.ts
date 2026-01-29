import { supabase } from './client';

// Rating type (matches database)
export type RatingType = 'show' | 'season' | 'episode' | 'movie';

// Database row type
export interface UserRatingRow {
  id: string;
  user_id: string;
  tmdb_id: number;
  rating_type: RatingType;
  season_number: number | null;
  episode_number: number | null;
  rating: number; // 0-10 scale
  review: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

// Rating with user info (for public ratings display)
export interface RatingWithUser extends UserRatingRow {
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Input for creating/updating a rating
export interface RatingInput {
  tmdbId: number;
  rating: number; // 0-10 scale (UI converts 1-5 stars to 0-10)
  isPublic?: boolean;
  review?: string;
}

export const ratingsService = {
  // Rate a show (create or update)
  async rateShow(
    userId: string,
    input: RatingInput
  ): Promise<UserRatingRow> {
    // Check if rating already exists
    const existing = await this.getUserShowRating(userId, input.tmdbId);

    if (existing) {
      // Update existing rating
      const { data, error } = await supabase
        .from('user_ratings')
        .update({
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('user_ratings')
        .insert({
          user_id: userId,
          tmdb_id: input.tmdbId,
          rating_type: 'show' as RatingType,
          season_number: null,
          episode_number: null,
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Rate a season
  async rateSeason(
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    input: Omit<RatingInput, 'tmdbId'>
  ): Promise<UserRatingRow> {
    // Check if rating already exists
    const existing = await this.getUserSeasonRating(userId, tmdbId, seasonNumber);

    if (existing) {
      // Update existing rating
      const { data, error } = await supabase
        .from('user_ratings')
        .update({
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('user_ratings')
        .insert({
          user_id: userId,
          tmdb_id: tmdbId,
          rating_type: 'season' as RatingType,
          season_number: seasonNumber,
          episode_number: null,
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Rate an episode
  async rateEpisode(
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    input: Omit<RatingInput, 'tmdbId'>
  ): Promise<UserRatingRow> {
    // Check if rating already exists
    const existing = await this.getUserEpisodeRating(userId, tmdbId, seasonNumber, episodeNumber);

    if (existing) {
      // Update existing rating
      const { data, error } = await supabase
        .from('user_ratings')
        .update({
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('user_ratings')
        .insert({
          user_id: userId,
          tmdb_id: tmdbId,
          rating_type: 'episode' as RatingType,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Get current user's rating for a show
  async getUserShowRating(userId: string, tmdbId: number): Promise<UserRatingRow | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'show')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  // Get current user's rating for a season
  async getUserSeasonRating(
    userId: string,
    tmdbId: number,
    seasonNumber: number
  ): Promise<UserRatingRow | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'season')
      .eq('season_number', seasonNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  // Get all season ratings for a show by user
  async getUserSeasonRatings(userId: string, tmdbId: number): Promise<UserRatingRow[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'season')
      .order('season_number', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  // Get current user's rating for an episode
  async getUserEpisodeRating(
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<UserRatingRow | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'episode')
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  // Get all ratings for a user (for profile page)
  async getUserRatings(userId: string): Promise<UserRatingRow[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  // Get all show ratings for a user (for "My Ratings" section)
  async getUserShowRatings(userId: string): Promise<UserRatingRow[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('rating_type', 'show')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  // Get all public ratings for a show (community ratings)
  async getPublicShowRatings(tmdbId: number): Promise<RatingWithUser[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select(`
        *,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'show')
      .eq('is_public', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as RatingWithUser[];
  },

  // Calculate average rating for a show
  async getShowAverageRating(tmdbId: number): Promise<{ average: number; count: number } | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'show')
      .eq('is_public', true);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const sum = data.reduce((acc, row) => acc + Number(row.rating), 0);
    return {
      average: sum / data.length,
      count: data.length,
    };
  },

  // Delete a rating
  async deleteRating(userId: string, ratingId: string): Promise<void> {
    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('id', ratingId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Delete show rating by tmdb_id
  async deleteShowRating(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'show');

    if (error) throw error;
  },

  // ==================== MOVIE RATING METHODS ====================

  // Rate a movie (create or update)
  async rateMovie(
    userId: string,
    input: RatingInput
  ): Promise<UserRatingRow> {
    // Check if rating already exists
    const existing = await this.getUserMovieRating(userId, input.tmdbId);

    if (existing) {
      // Update existing rating
      const { data, error } = await supabase
        .from('user_ratings')
        .update({
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('user_ratings')
        .insert({
          user_id: userId,
          tmdb_id: input.tmdbId,
          rating_type: 'movie' as RatingType,
          season_number: null,
          episode_number: null,
          rating: input.rating,
          review: input.review ?? null,
          is_public: input.isPublic ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Get current user's rating for a movie
  async getUserMovieRating(userId: string, tmdbId: number): Promise<UserRatingRow | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'movie')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  // Get all movie ratings for a user
  async getUserMovieRatings(userId: string): Promise<UserRatingRow[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('rating_type', 'movie')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  // Get all public ratings for a movie (community ratings)
  async getPublicMovieRatings(tmdbId: number): Promise<RatingWithUser[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select(`
        *,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'movie')
      .eq('is_public', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as RatingWithUser[];
  },

  // Calculate average rating for a movie
  async getMovieAverageRating(tmdbId: number): Promise<{ average: number; count: number } | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'movie')
      .eq('is_public', true);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const sum = data.reduce((acc, row) => acc + Number(row.rating), 0);
    return {
      average: sum / data.length,
      count: data.length,
    };
  },

  // Delete movie rating by tmdb_id
  async deleteMovieRating(userId: string, tmdbId: number): Promise<void> {
    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', tmdbId)
      .eq('rating_type', 'movie');

    if (error) throw error;
  },
};
