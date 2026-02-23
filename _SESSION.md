# UpNext - Session State
Updated: 2026-02-23 | Branch: main

## Status: Personal-use app — automatic data refresh implemented, preparing to ship

### This Session
- **Implemented automatic TMDB metadata refresh** — Shows/movies now auto-refresh when app comes to foreground (if >6 hours stale)
  - Refreshes `total_seasons`, `total_episodes`, `aired_episodes`, `poster_path` for TV shows in watching/waiting status
  - Refreshes `release_date`, `runtime` for movies in watchlist status
  - Throttled at 400ms between TMDB API calls (safely under rate limit)
  - Handles 429 rate limiting with 10s pause + retry
  - Abort support and concurrent-run guard
  - Screens auto-reload via `refreshKey` context broadcast

### Files Created This Session
- `src/services/metadataRefresh.ts` — Core refresh service (staleness check, TMDB batching, throttling)
- `src/contexts/MetadataRefreshContext.tsx` — React context (AppState foreground detection, refreshKey broadcast)

### Files Modified This Session
- `src/services/storage.ts` — Added `metadata_refreshed_at` column migration + `getShowsNeedingRefresh()`, `updateShowMetadata()`, `updateMovieMetadata()` methods
- `src/types/index.ts` — Added `seasons` summary array to `TMDBShow` interface (TMDB returns this from `/tv/{id}`)
- `App.tsx` — Wrapped with `MetadataRefreshProvider` inside SyncProvider
- `src/screens/UpNextScreen.tsx` — Watches `refreshKey` to reload when metadata refresh completes
- `src/screens/MyShowsScreen.tsx` — Same `refreshKey` pattern

### Next Session Priority Order
1. **Test onboarding flow** — Verify carousel → Main works on fresh install
2. **Ship to App Store** — Minimal launch prep, don't over-polish
3. **Consider show status notifications** — When refresh detects a show changed to "Ended"/"Cancelled", could prompt user

### App Store Connect Status
- **Privacy Policy**: Notion page (published, URL set in ASC)
- **Support Page**: Notion page (published, URL set in ASC)
- **Description, Keywords, Promo Text**: Written and saved
- **Age Rating**: 4+ configured
- **Pricing**: Free, all territories
- **App Privacy**: 4 data types declared (may need update now that subscriptions are removed)
- **Build**: Build 14 submitted to TestFlight (ASC App ID: 6758222275) — **STALE, needs rebuild**
- **Still needs**: App name resolution, screenshots, test account, export compliance

### Completed Features
- **Core** — Search, tracking, episodes, sync engine
- **Auth** — Signup, signin (email or username), Apple Sign-In, Google Sign-In
- **Social** — Follow system, activity feed, friend ratings
- **Ratings** — 5-star system with half-star toggle, episode reactions
- **Recommendations** — Trending + personalized with dismiss feature
- **Profile** — Edit username, display name, bio
- **Movies** — Full tracking with search, status, ratings
- **Rewatch Tracking** — Full watch history with editable timestamps
- **Share Profile** — Deep links, privacy controls, profile stats
- **Data Export** — JSON export with profile, follows, ratings, warnings (free for all)
- **Settings** — About, Sync Settings, Notifications screens
- **Stats Dashboard** — 10-section analytics with custom charts (all free)
- **Onboarding** — Welcome carousel, first-launch detection
- **Auto Refresh** — TMDB metadata refresh on app foreground (6h staleness window)

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (STALE — needs rebuild with auto-refresh + stripped features)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Research Files (Not Committed)
- `CLAUDE_DEEP_RESEARCH.md` — Market viability analysis
- `Monetization_Launch.md` — Original monetization strategy (obsolete)
- Other research docs — `OAUTH_TRAKT_SIMKL.md`, `Premium_Value_Proposition.md`, `WATCH_HISTORY_IMPORT.md`, `series_guide_reviews.md`, `trakt_reviews.md`, `tv_time_reviews.md`
