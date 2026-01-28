# UpNext - Session State
Updated: 2026-01-28 | Branch: master

## Status: TV Features Complete, Pre-Launch Work Remaining

### Completed Features
- **Core** - Search, tracking, episodes, sync engine
- **Auth** - Signup, signin (email or username)
- **Social** - Follow system, activity feed, friend ratings
- **Ratings** - 5-star system with half-star toggle, episode reactions
- **Recommendations** - Trending + personalized with dismiss feature
- **Profile** - Edit username, display name, bio

## Pre-Launch Roadmap

### Before Launch (Priority Order)
| # | Feature | Complexity | Why |
|---|---------|------------|-----|
| 1 | **Movie tracking** | Medium-High | Table stakes - competitors have it |
| 2 | **Rewatch tracking** | Medium | Trakt removed this, users furious |
| 3 | **Share profile** | Low | Public URLs for social sharing |
| 4 | **Data export** | Low | Trust builder - "you own your data" |

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

### Movie Tracking
- TMDB API already supports movies (same API key)
- Need new table or modify `user_shows` for media_type
- Add movie search tab or toggle
- Movie ratings in `user_ratings` (already supports it)

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
