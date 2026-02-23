# UpNext - Session State
Updated: 2026-02-23 | Branch: main

## Status: Strategic pivot — personal use app, strip complexity

### This Session
- **RevenueCat production key swapped** — `.env` now has `appl_<REDACTED>` (was test key)
- **Trakt + SIMKL OAuth flows built** (but will be removed next session)
  - `src/services/oauthTokens.ts` — New: SecureStore token storage with Trakt refresh logic
  - `src/screens/ImportScreen.tsx` — Replaced "Coming soon" placeholders with real OAuth flows using `expo-auth-session`
  - `src/services/import.ts` — Added ratings import support via `ratingsService`
  - `.env` — Added Trakt/SIMKL client ID/secret placeholders
- **Deep research on market viability** — Concluded TV tracker market is saturated (17+ competitors), unit economics are brutal for solo dev with no marketing budget. Decision: **ship as personal-use app** for self and friends, stop chasing features for a market we're not trying to win.

### Strategic Decision
**UpNext is now a personal-use app**, not a business. Key implications:
- Strip out import functionality (Trakt, SIMKL, TV Time, Letterboxd, UpNext JSON)
- Strip out other complex features that only matter for market competition
- Add **automatic data refresh** (cron job / background task) so the app stays up-to-date without manual management
- Keep it self-sustaining — minimize ongoing maintenance

### Files Modified This Session
- `.env` — RevenueCat production key + Trakt/SIMKL placeholders (placeholders to be removed)
- `src/screens/ImportScreen.tsx` — OAuth flows added (to be stripped next session)
- `src/services/import.ts` — Ratings import added (to be stripped next session)
- `src/services/oauthTokens.ts` — New file (to be stripped next session)

### Next Session Priority Order
1. **Strip import functionality** — Remove ImportScreen, import services, parsers, TMDB resolver, related types
2. **Strip other unnecessary complexity** — Audit features that only matter for market competition
3. **Add automatic data refresh** — Background task or Supabase Edge Function on schedule to keep shows/movies/episodes/air dates current without user intervention
4. **Test onboarding + paywall** — Needs fresh dev build
5. **Ship to App Store** — Minimal launch prep, don't over-polish

### What Needs Auto-Refresh (Next Session)
Currently the app fetches TMDB data **on-demand only** (search, open show). No background refresh for:
- New episodes added to tracked shows
- Air date changes
- Show status changes (ended, cancelled)
- New season announcements
Options: Supabase Edge Function on cron schedule, or in-app background task on app launch

### RevenueCat Status
- **Production API key**: `appl_<REDACTED>` — NOW IN `.env`
- **EAS secret still needs updating** before next build: `eas secret:create --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY --value appl_<REDACTED> --scope project`
- **Entitlement**: `premium` — 3 products attached
- **Offerings**: `default` — monthly/annual/lifetime packages
- **ASC Products**: Founding prices ($1.99/$14.99/$49.99)

### App Store Connect Status
- **Privacy Policy**: Notion page (published, URL set in ASC)
- **Support Page**: Notion page (published, URL set in ASC)
- **Description, Keywords, Promo Text**: Written and saved
- **Age Rating**: 4+ configured
- **Pricing**: Free, all territories
- **App Privacy**: 4 data types declared
- **Build**: Build 14 submitted to TestFlight (ASC App ID: 6758222275)
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
- **Data Export** — JSON export with profile, follows, ratings, warnings
- **Settings** — About, Sync Settings, Notifications screens
- **Import Data** — 5 sources (TO BE REMOVED next session)
- **Stats Dashboard** — 10-section analytics with custom charts, premium gating
- **Subscriptions** — RevenueCat SDK, SubscriptionContext, real PaywallScreen with purchase flow
- **Onboarding** — Welcome carousel, dual-mode paywall, first-launch detection

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (all 22 fixes)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **IAP Key ID**: A3VL7TXUCZ (uploaded to RevenueCat)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)
- **RevenueCat**: Production key now in `.env` (still needs EAS secret update before next build)

## Research Files (Not Committed)
- `CLAUDE_DEEP_RESEARCH.md` — Market viability analysis
- `OAUTH_TRAKT_SIMKL.md` — OAuth research for Trakt/SIMKL (no longer needed)
- `Monetization_Launch.md` — Original monetization strategy
- `Premium_Value_Proposition.md`, `WATCH_HISTORY_IMPORT.md`, `series_guide_reviews.md`, `trakt_reviews.md`, `tv_time_reviews.md` — Research docs
