-- UpNext Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- =============================================================================
-- 1. PROFILES TABLE (extends auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. USER SHOWS TABLE (synced tracked shows)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  status TEXT NOT NULL DEFAULT 'watching'
    CHECK (status IN ('watching', 'waiting', 'watchlist', 'completed', 'dropped')),
  added_at TIMESTAMPTZ NOT NULL,
  total_seasons INTEGER DEFAULT 0,
  total_episodes INTEGER DEFAULT 0,
  aired_episodes INTEGER,
  streaming_services JSONB DEFAULT '[]',
  -- Sync metadata
  local_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, tmdb_id)
);

-- Indexes
CREATE INDEX idx_user_shows_user ON user_shows(user_id);
CREATE INDEX idx_user_shows_tmdb ON user_shows(tmdb_id);
CREATE INDEX idx_user_shows_status ON user_shows(user_id, status);
CREATE INDEX idx_user_shows_synced ON user_shows(synced_at);

-- Enable RLS
ALTER TABLE user_shows ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own shows"
  ON user_shows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shows"
  ON user_shows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shows"
  ON user_shows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shows"
  ON user_shows FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. USER WATCHED EPISODES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_watched_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_show_id UUID REFERENCES user_shows(id) ON DELETE CASCADE,
  tmdb_show_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL,
  episode_title TEXT,
  still_path TEXT,
  -- Sync metadata
  local_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, tmdb_show_id, season_number, episode_number)
);

-- Indexes
CREATE INDEX idx_watched_user ON user_watched_episodes(user_id);
CREATE INDEX idx_watched_show ON user_watched_episodes(user_show_id);
CREATE INDEX idx_watched_tmdb ON user_watched_episodes(tmdb_show_id);
CREATE INDEX idx_watched_synced ON user_watched_episodes(synced_at);

-- Enable RLS
ALTER TABLE user_watched_episodes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own watched episodes"
  ON user_watched_episodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched episodes"
  ON user_watched_episodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched episodes"
  ON user_watched_episodes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watched episodes"
  ON user_watched_episodes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 4. USER RATINGS TABLE (for Phase 2)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('show', 'season', 'episode')),
  season_number INTEGER,
  episode_number INTEGER,
  rating DECIMAL(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN DEFAULT false,

  UNIQUE(user_id, tmdb_id, rating_type, COALESCE(season_number, 0), COALESCE(episode_number, 0))
);

-- Indexes
CREATE INDEX idx_ratings_user ON user_ratings(user_id);
CREATE INDEX idx_ratings_tmdb ON user_ratings(tmdb_id);
CREATE INDEX idx_ratings_public ON user_ratings(is_public) WHERE is_public = true;

-- Enable RLS
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own ratings"
  ON user_ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public ratings"
  ON user_ratings FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can insert own ratings"
  ON user_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON user_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON user_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 5. UPDATED_AT TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_shows_updated_at
  BEFORE UPDATE ON user_shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ratings_updated_at
  BEFORE UPDATE ON user_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DONE! Your database is ready.
-- =============================================================================
