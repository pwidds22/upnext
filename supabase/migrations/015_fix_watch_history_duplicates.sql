-- Bug #22 Fix: Clean up duplicate watch history records and prevent future duplicates
-- ALREADY RUN via MCP on 2026-02-18

-- =============================================================================
-- 1. CLEAN UP EPISODE WATCH HISTORY DUPLICATES (content-level dedup)
-- Cleaned 1328 duplicates (1807 → 479 rows)
-- =============================================================================
DELETE FROM user_episode_watch_history
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, tmdb_show_id, season_number, episode_number, watched_at) id
  FROM user_episode_watch_history
  WHERE deleted_at IS NULL
  ORDER BY user_id, tmdb_show_id, season_number, episode_number, watched_at, synced_at ASC
)
AND deleted_at IS NULL;

-- =============================================================================
-- 2. ADD UNIQUE CONSTRAINTS to prevent future duplicates
-- =============================================================================

-- Prevent same watch content from being duplicated
CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_watch_history_unique_watch
  ON user_episode_watch_history(user_id, tmdb_show_id, season_number, episode_number, watched_at)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_watch_history_unique_watch
  ON user_movie_watch_history(user_id, tmdb_movie_id, watched_at)
  WHERE deleted_at IS NULL;

-- Prevent same local_id from being pushed twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_watch_history_user_local_id
  ON user_episode_watch_history(user_id, local_id)
  WHERE local_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_watch_history_user_local_id
  ON user_movie_watch_history(user_id, local_id)
  WHERE local_id IS NOT NULL AND deleted_at IS NULL;
