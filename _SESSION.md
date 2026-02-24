# UpNext - Session State
Updated: 2026-02-24 | Branch: main

## Status: Caught-up detection refined, ready for App Store launch prep

### This Session
- **Fixed caught-up prompt showing mid-season** — The "All Caught Up!" prompt was firing whenever all aired episodes were watched, even for weekly shows with more episodes coming. Now suppressed unless the season is fully aired or the show is Ended/Canceled.
  - Three-layer check: (1) `show.totalEpisodes > airedEpisodes`, (2) unaired episodes in season data, (3) `episode_count` vs aired count
  - Search bar yellow tint was already fixed (user confirmed)

### Files Modified This Session
- `src/screens/ShowDetailScreen.tsx` — Refined caught-up detection: skip prompt when current season has unaired episodes remaining; only prompt when season is complete or show is Ended/Canceled

### Next Session Priority Order
1. **Ship to App Store** — Minimal launch prep (screenshots, app name resolution, test account, export compliance)
2. **Consider show status notifications** — When metadata refresh detects a show changed to "Ended"/"Cancelled", could prompt user

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
- **Auth Gating** — Onboarding → required auth → main app (no anonymous use)
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
- **Onboarding** — Welcome carousel → required auth, empty state CTAs
- **Auto Refresh** — TMDB metadata refresh on app foreground (6h staleness window)
- **Caught-Up Detection** — Prompt to mark as Waiting/Completed when all aired episodes watched

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (STALE — needs rebuild with all recent changes)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Research Files (Not Committed)
- `CLAUDE_DEEP_RESEARCH.md` — Market viability analysis
- `Monetization_Launch.md` — Original monetization strategy (obsolete)
- Other research docs — `OAUTH_TRAKT_SIMKL.md`, `Premium_Value_Proposition.md`, `WATCH_HISTORY_IMPORT.md`, `series_guide_reviews.md`, `trakt_reviews.md`, `tv_time_reviews.md`
