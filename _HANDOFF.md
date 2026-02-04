# UpNext - Project Handoff

## What This Is
A mobile app (iOS + Android) for tracking TV shows, movies, and episodes. Features:
- Search for TV shows and movies via TMDB API
- Track watched episodes across multiple shows
- Organize shows by status (Watching, Waiting, Watchlist, Completed, Dropped)
- View upcoming episodes with air date countdowns
- Find streaming services where shows are available
- Social features: follow friends, activity feed, friend ratings

## Current State: Feature-Complete (TV Shows)
- [x] Project setup (Expo + TypeScript)
- [x] Core app structure
- [x] TMDB API integration
- [x] SQLite local storage + Supabase cloud sync
- [x] UI with tabs (UpNext, MyShows, Search, Activity, Profile)
- [x] Episode tracking functionality
- [x] Rating system (5-star with half-star toggle)
- [x] Social: Follow system, activity feed, friend ratings
- [x] Recommendations: Trending + personalized
- [x] Auth: Email/username signin, profile editing

## Tech Stack
- **Mobile:** React Native 0.81 + Expo 54
- **Language:** TypeScript
- **Local Database:** SQLite (expo-sqlite)
- **Cloud Database:** Supabase (PostgreSQL)
- **API:** TMDB (The Movie Database)
- **Navigation:** React Navigation (bottom tabs + native stack)

## Pre-Launch Roadmap

### Before Launch (Priority Order)
1. **Movie tracking** - Add movie search, watchlist, ratings (TMDB API supports this)
2. **Rewatch tracking** - Track multiple watches per episode with timestamps
3. **Share profile** - Public profile URLs users can share
4. **Data export** - Let users download their data (JSON/CSV)

### Fast Follow (v1.1)
5. **Widgets** - iOS home screen widget showing next episode
6. **Watch stats** - Hours watched, streaks, genre breakdown

### Later
7. **Native X/Twitter posting** - Auto-post when watching (requires Twitter API)

## Launch Strategy
- **Target:** Trakt refugees (Jan 2026 update disaster drove users away)
- **First 500 users:** Lifetime premium free (grandfather clause)
- **Marketing:** Reddit posts in r/television, r/TVSuggestions, r/streaming
- **Differentiators:** Fast, clean UI, free tier with generous limits, privacy-focused

## Competitor Pain Points (Our Advantages)
| Competitor | Their Problem | Our Solution |
|------------|---------------|--------------|
| TV Time | Slow, crashes, network errors | Fast (local SQLite + cloud sync) |
| Trakt | $60/year, 100 item limit, awful Jan 2026 redesign | Generous free tier, clean UI |
| Trakt | No rewatch history, removed calendar | Rewatch tracking, Up Next calendar |
| Both | Privacy concerns, data selling | No tracking, user owns data |

## Key Files
- `src/services/supabase/` - Cloud sync services
- `src/screens/` - All app screens
- `src/utils/constants.ts` - API keys, config
- `src/types/index.ts` - TypeScript interfaces
