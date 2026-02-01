-- UpNext Watch History Tables (for rewatch tracking)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- =============================================================================
-- 1. EPISODE WATCH HISTORY TABLE
-- Unlike user_watched_episodes, this table allows multiple entries per episode
-- to track rewatches with full timestamp history
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_episode_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_show_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL,
  episode_title TEXT,
  -- Sync metadata
  local_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
  -- NOTE: NO unique constraint - allows multiple watches per episode
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_episode_watch_history_user ON user_episode_watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_watch_history_episode ON user_episode_watch_history(user_id, tmdb_show_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_episode_watch_history_watched_at ON user_episode_watch_history(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_episode_watch_history_synced ON user_episode_watch_history(synced_at);

-- Enable RLS
ALTER TABLE user_episode_watch_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own episode watch history"
  ON user_episode_watch_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own episode watch history"
  ON user_episode_watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own episode watch history"
  ON user_episode_watch_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own episode watch history"
  ON user_episode_watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- Policy for activity feed: Friends can see episode watch history
CREATE POLICY "Users can view followed users episode watch history"
  ON user_episode_watch_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_follows
      WHERE follower_id = auth.uid()
      AND following_id = user_episode_watch_history.user_id
    )
  );

-- =============================================================================
-- 2. MOVIE WATCH HISTORY TABLE
-- Allows tracking multiple watches per movie
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_movie_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_movie_id INTEGER NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL,
  -- Sync metadata
  local_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
  -- NOTE: NO unique constraint - allows multiple watches per movie
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_movie_watch_history_user ON user_movie_watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_watch_history_movie ON user_movie_watch_history(user_id, tmdb_movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_watch_history_watched_at ON user_movie_watch_history(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_movie_watch_history_synced ON user_movie_watch_history(synced_at);

-- Enable RLS
ALTER TABLE user_movie_watch_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own movie watch history"
  ON user_movie_watch_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movie watch history"
  ON user_movie_watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movie watch history"
  ON user_movie_watch_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movie watch history"
  ON user_movie_watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- Policy for activity feed: Friends can see movie watch history
CREATE POLICY "Users can view followed users movie watch history"
  ON user_movie_watch_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_follows
      WHERE follower_id = auth.uid()
      AND following_id = user_movie_watch_history.user_id
    )
  );

-- =============================================================================
-- DONE! Watch history tables are ready for rewatch tracking.
-- =============================================================================
