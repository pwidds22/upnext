# UpNext - Session State
Updated: 2026-01-29 | Branch: master

## Status: Movies Implemented, UX Polish Complete

### Completed This Session
- **Movie tracking** - Full implementation complete
  - Search movies with trending/for you/top rated sections
  - Add movies with status selection (Watchlist/Watched) and rating from search modal
  - Movie detail screen with streaming providers
  - Library shows movies with TV/Movies filter
- **Dismiss movies** - X button on movie cards in search (like TV shows)
- **Terminology consistency** - Changed "Completed" to "Watched" for TV shows
- **Collapsible sections** - Library sections can be collapsed/expanded with chevron arrows
- **Hide Watched toggle** - Compact eye icon (shows "Hidden" when active)
- **Filter persistence** - Library remembers All/TV/Movies preference
- **Database fixes** - Fixed ON CONFLICT errors with check-then-insert pattern

### Key Files Modified
- `src/screens/SearchScreen.tsx` - Status selection + rating in add modals
- `src/screens/MyShowsScreen.tsx` - Collapsible sections, hide toggle, terminology
- `src/hooks/useMovieRecommendations.ts` - Added dismiss functionality
- `src/components/MovieCard.tsx` - Added onDismiss prop
- `src/services/storage.ts` - Added dismissed_movies table & methods
- `src/utils/constants.ts` - Changed "Completed" label to "Watched"

### Completed Features
- **Core** - Search, tracking, episodes, sync engine
- **Auth** - Signup, signin (email or username)
- **Social** - Follow system, activity feed, friend ratings
- **Ratings** - 5-star system with half-star toggle, episode reactions
- **Recommendations** - Trending + personalized with dismiss feature
- **Profile** - Edit username, display name, bio
- **Movies** - Full tracking with search, status, ratings

## Pre-Launch Roadmap

### Before Launch (Priority Order)
| # | Feature | Complexity | Status |
|---|---------|------------|--------|
| 1 | ~~Movie tracking~~ | Medium-High | DONE |
| 2 | **Rewatch tracking** | Medium | Not started |
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

## Technical Notes for Next Features

### Rewatch Tracking
- Current: `upsertEpisode` with `onConflict` overwrites existing watch
- Need: Remove unique constraint, change to INSERT for rewatches
- Add UI to show watch history per episode
- Update ID generation to include timestamp

### Share Profile
- Generate public URL: `upnext.app/user/{username}`
- Profile page already shows data, just need public route
- Web version or deep link handling

## Launch Strategy
- **First 500 users:** Lifetime premium free
- **Track by:** Signup date in Supabase `profiles.created_at`
- **Marketing:** Reddit (r/television, r/TVSuggestions, r/streaming)
- **Message:** "Fast, free TV & movie tracker. First 500 users get premium forever."

## Database Migrations (13 applied)
`create_profiles`, `create_user_shows`, `create_watched_episodes`, `create_user_ratings`, `create_updated_at_triggers`, `fix_function_search_paths`, `create_episode_reactions`, `create_user_follows`, `fix_profile_username_from_email`, `create_user_dismissed_shows`, `add_activity_feed_policies`, `add_show_privacy`, `add_get_user_email_function`

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly

## Known Issues
- API key hardcoded (move to env vars before production)
