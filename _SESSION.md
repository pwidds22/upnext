# UpNext - Session State
Updated: 2026-02-23 | Branch: main

## Status: Personal-use app — stripped complexity, preparing to ship

### This Session
- **Stripped import functionality** — Deleted 9 files: ImportScreen, import.ts, oauthTokens.ts, tmdbIdResolver.ts, 5 importSources parsers (trakt, simkl, letterboxd, tvtime, upnextJson)
- **Stripped subscription/paywall system** — Deleted 4 files: PaywallScreen, SubscriptionContext, subscription.ts, LockedSection. All features now free.
- **Unlocked all stats** — Removed LockedSection wrappers from StatsScreen, FunFacts shows all facts
- **Simplified onboarding** — Carousel now goes directly to Main app (skips paywall)
- **Removed premium gating on data export** — Export works without premium check
- **Removed Import Data menu** from Profile screen
- **Removed PremiumMenuItem** from Profile screen
- **Cleaned up dependencies** — Removed `jszip`, `expo-document-picker`, `react-native-purchases`
- **Cleaned up .env** — Removed RevenueCat, Trakt, SIMKL keys
- **Cleaned up constants.ts** — Removed RevenueCat env validation

### Files Deleted This Session
- `src/screens/ImportScreen.tsx`
- `src/screens/PaywallScreen.tsx`
- `src/services/import.ts`
- `src/services/oauthTokens.ts`
- `src/services/tmdbIdResolver.ts`
- `src/services/importSources/` (entire directory: trakt, simkl, letterboxd, tvtime, upnextJson)
- `src/contexts/SubscriptionContext.tsx`
- `src/services/subscription.ts`
- `src/components/stats/LockedSection.tsx`

### Files Modified This Session
- `App.tsx` — Removed SubscriptionProvider wrapper
- `src/navigation/AppNavigator.tsx` — Removed Import + Paywall routes and imports
- `src/types/index.ts` — Removed Import types, Subscription types, nav params
- `src/screens/OnboardingScreen.tsx` — Onboarding completes to Main, not Paywall
- `src/screens/StatsScreen.tsx` — Removed all premium gating, all sections visible
- `src/components/stats/FunFacts.tsx` — Removed isPremium prop, shows all facts
- `src/screens/ProfileScreen.tsx` — Removed PremiumMenuItem, Import menu, premium export gate
- `src/utils/constants.ts` — Removed RevenueCat env check
- `.env` — Removed RevenueCat + Trakt + SIMKL keys
- `package.json` — Removed jszip, expo-document-picker, react-native-purchases

### Next Session Priority Order
1. **Add automatic data refresh** — Background task or Supabase Edge Function on schedule to keep shows/movies/episodes/air dates current without user intervention
2. **Test onboarding flow** — Verify carousel → Main works on fresh install
3. **Ship to App Store** — Minimal launch prep, don't over-polish

### What Needs Auto-Refresh
Currently the app fetches TMDB data **on-demand only** (search, open show). No background refresh for:
- New episodes added to tracked shows
- Air date changes
- Show status changes (ended, cancelled)
- New season announcements
Options: Supabase Edge Function on cron schedule, or in-app background task on app launch

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

### Removed Features (This Session)
- **Import Data** — 5 sources (Trakt, SIMKL, TV Time, Letterboxd, UpNext JSON)
- **Subscriptions** — RevenueCat SDK, paywall, premium gating
- **Feature Gating** — All features now free

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (STALE — needs rebuild with stripped features)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Research Files (Not Committed)
- `CLAUDE_DEEP_RESEARCH.md` — Market viability analysis
- `Monetization_Launch.md` — Original monetization strategy (obsolete)
- Other research docs — `OAUTH_TRAKT_SIMKL.md`, `Premium_Value_Proposition.md`, `WATCH_HISTORY_IMPORT.md`, `series_guide_reviews.md`, `trakt_reviews.md`, `tv_time_reviews.md`
