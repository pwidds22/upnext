# UpNext - Session State
Updated: 2026-01-29 | Branch: master

## Status: Pre-Rewatch Research Phase

### Completed This Session
- **Session review** - Reviewed project state, uncommitted changes, roadmap
- **Deep research prep** - Created prompt for Claude deep research to investigate:
  - Why users want rewatch tracking and how it should work
  - Most requested features from TV Time, Trakt, etc. refugees
  - Deal breakers and pain points from Reddit communities

### In Progress
- **Rewatch tracking research** - Awaiting deep research results from user
  - User will provide findings in next session
  - Need to understand user expectations before implementation

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

## Next Steps
1. **Receive deep research results** - User running Claude deep research on rewatch tracking + feature requests
2. **Analyze findings** - Understand what users actually want from rewatch tracking
3. **Design rewatch implementation** - Based on research, not assumptions
4. **Implement rewatch tracking** - After research validates approach

## Technical Notes for Next Features

### Rewatch Tracking (pending research)
- Current: `upsertEpisode` with `onConflict` overwrites existing watch
- Need: Remove unique constraint, change to INSERT for rewatches
- Add UI to show watch history per episode
- Update ID generation to include timestamp
- **Waiting for:** Deep research on user expectations

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
