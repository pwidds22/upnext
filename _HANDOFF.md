# UpNext - Project Handoff

## What This Is
A mobile app (iOS + Android) for tracking TV shows and episodes. Features:
- Search for TV shows via TMDB API
- Track watched episodes across multiple shows
- Organize shows by status (Watching, Waiting, Watchlist, Completed, Dropped)
- View upcoming episodes with air date countdowns
- Find streaming services where shows are available

## Current State
- [x] Project setup (Expo + TypeScript)
- [x] Core app structure
- [x] TMDB API integration
- [x] SQLite local storage
- [x] Basic UI with 3 tabs (UpNext, MyShows, Search)
- [x] Episode tracking functionality

## Tech Stack
- **Mobile:** React Native 0.81 + Expo 54
- **Language:** TypeScript
- **Database:** SQLite (expo-sqlite)
- **API:** TMDB (The Movie Database)
- **Navigation:** React Navigation (bottom tabs + native stack)

## Phase Plan
1. **Setup** - ✅ Complete
2. **Core Features** - ✅ Basic implementation done
3. **Polish** - UI/UX improvements, performance
4. **Production** - App store prep, testing

## Key Decisions Made
- [x] Mobile framework: React Native + Expo
- [x] Data source: TMDB API
- [x] Local storage: SQLite

## Known Issues
- API key is hardcoded in `src/utils/constants.ts` (should use env vars for production)
