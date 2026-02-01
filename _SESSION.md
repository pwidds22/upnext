# UpNext - Session State
Updated: 2026-02-01 | Branch: master

## Status: Rewatch Tracking Complete & Deployed

### Completed This Session
- **Supabase migration applied** - `014_add_watch_history_tables.sql` deployed via MCP
  - `user_episode_watch_history` table created with RLS
  - `user_movie_watch_history` table created with RLS
  - All indexes and friend activity policies in place

### Completed Previous Session
- **Deep research analysis** - Analyzed user research on rewatch tracking needs
- **Rewatch tracking implementation** - Full episode + movie rewatch support:
  - New `episode_watch_history` and `movie_watch_history` SQLite tables
  - New Supabase migration (`014_add_watch_history_tables.sql`)
  - Watch history service for Supabase sync
  - Updated `useWatchedEpisodes` hook with `addWatch`, `removeLatestWatch`, `getWatchHistory`
  - New `useMovieWatchHistory` hook
  - New `WatchHistorySheet` component (modal showing watch history)
  - Updated `EpisodeRow` with watch count badge and quick action menu
  - Updated `MovieDetailScreen` with watch history section
  - Activity feed updated to show rewatches from history tables

### Key UX Decisions (Based on Research)
- **No accidental taps**: Tapping watched episode shows quick action menu (Watch Again / Remove / History)
- **Watch count badges**: Episodes/movies with 2+ watches show count badge
- **Full history**: Users can view all watch dates and delete individual watches
- **Backward compatible**: Falls back to old tables if history tables empty

### Files Changed
- `src/types/index.ts` - Added watch history types
- `src/services/storage.ts` - Added watch history tables and methods
- `src/services/supabase/watchHistory.ts` - New file for sync
- `src/services/supabase/activity.ts` - Updated to use history tables
- `src/hooks/useShowData.ts` - Added rewatch functions
- `src/hooks/useMovieWatchHistory.ts` - New hook
- `src/components/WatchHistorySheet.tsx` - New component
- `src/components/EpisodeRow.tsx` - Added watch count badge and action menu
- `src/screens/ShowDetailScreen.tsx` - Integrated rewatch UI
- `src/screens/MovieDetailScreen.tsx` - Added watch history section
- `supabase/migrations/014_add_watch_history_tables.sql` - New migration

### Previous Session Completed
- **Movie tracking** - Full implementation complete
- **Dismiss movies** - X button on movie cards
- **Terminology consistency** - "Completed" → "Watched"
- **Collapsible sections** - Library sections expandable
- **Hide Watched toggle** - Compact eye icon
- **Filter persistence** - Library remembers preference
- **Database fixes** - ON CONFLICT errors resolved

### Completed Features
- **Core** - Search, tracking, episodes, sync engine
- **Auth** - Signup, signin (email or username)
- **Social** - Follow system, activity feed, friend ratings
- **Ratings** - 5-star system with half-star toggle, episode reactions
- **Recommendations** - Trending + personalized with dismiss feature
- **Profile** - Edit username, display name, bio
- **Movies** - Full tracking with search, status, ratings
- **Rewatch Tracking** - Full watch history for episodes and movies

## Pre-Launch Roadmap

### Before Launch (Priority Order)
| # | Feature | Complexity | Status |
|---|---------|------------|--------|
| 1 | ~~Movie tracking~~ | Medium-High | DONE |
| 2 | ~~Rewatch tracking~~ | Medium | DONE |
| 3 | **Share profile** | Low | Not started |
| 4 | **Data export** | Low | Not started |

### Fast Follow (v1.1)
| # | Feature | Complexity |
|---|---------|------------|
| 5 | **Widgets** | Medium |
| 6 | **Watch stats** | Medium |

### Later
| # | Feature | Notes |
|---|---------|-------|
| 7 | Native X posting | Twitter API OAuth required |

## Next Steps
1. **Test rewatch flow end-to-end** - Verify UI works correctly on device
2. **Share profile** - Next feature on roadmap
3. **Data export** - JSON/CSV export for user data portability

## Database Migrations (14 to apply)
`create_profiles`, `create_user_shows`, `create_watched_episodes`, `create_user_ratings`, `create_updated_at_triggers`, `fix_function_search_paths`, `create_episode_reactions`, `create_user_follows`, `fix_profile_username_from_email`, `create_user_dismissed_shows`, `add_activity_feed_policies`, `add_show_privacy`, `add_get_user_email_function`, **`add_watch_history_tables`** (NEW)

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly

## Known Issues
- API key hardcoded (move to env vars before production)
