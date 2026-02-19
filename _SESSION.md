# UpNext - Session State
Updated: 2026-02-19 | Branch: main

## Status: Phase 1 (Import Infrastructure) COMPLETE — reviewed and fixes applied

### This Session
- **Phase 1: Import Infrastructure — COMPLETE**
  - Built full plugin-based import framework with NormalizedImportData common format
  - 5 import source parsers: UpNext JSON, Trakt, TV Time (CSV + JSON eras), SIMKL, Letterboxd
  - TMDB ID resolver with persistent SQLite cache + resolution chain (IMDB → TVDB → title search)
  - Import UI screen with progress bar, results view, unresolved items display
  - Navigation integration (ProfileScreen → Import Data menu item)
  - Installed expo-document-picker and jszip dependencies
- **Claude Web review completed — 10 fixes applied across 7 files:**
  - Fixed INSERT OR REPLACE anti-pattern in tmdbIdResolver.ts
  - Added fetchWithTimeout (15s) to all network calls
  - Added max retry limits (3) to prevent infinite loops
  - Fixed Season 0 being dropped (isNaN check instead of falsy check)
  - Fixed timezone bug in TV Time date parsing (Date.UTC)
  - Removed input mutation in import orchestrator
  - Added date format validation in Letterboxd parser
  - Honest ratings skip message (not yet implemented)
  - Array.isArray() guards in UpNext JSON parser
  - Simplified importEpisode to avoid TOCTOU race condition
- TypeScript compiles cleanly (pre-existing NotificationsScreen type error only)

### Files Created This Session
- `src/services/tmdbIdResolver.ts` — ID mapping cache + TMDB resolution chain
- `src/services/import.ts` — Main import orchestrator
- `src/services/importSources/upnextJson.ts` — UpNext JSON export parser
- `src/services/importSources/trakt.ts` — Trakt API import (OAuth)
- `src/services/importSources/tvtime.ts` — TV Time CSV + JSON parser
- `src/services/importSources/simkl.ts` — SIMKL API import (OAuth)
- `src/services/importSources/letterboxd.ts` — Letterboxd CSV parser
- `src/screens/ImportScreen.tsx` — Import UI screen

### Files Modified This Session
- `src/types/index.ts` — Added ~117 lines of import types + Import route
- `src/navigation/AppNavigator.tsx` — Added ImportScreen route
- `src/screens/ProfileScreen.tsx` — Added "Import Data" menu item
- `package.json` — Added expo-document-picker, jszip

### Next Session Priority Order
1. **Phase 2: Stats Dashboard** — Hero premium feature (#1 conversion driver)
2. **Phase 3: RevenueCat + Subscriptions** — Can be built in parallel with Phase 2
3. **Phase 4: Paywall + Reverse Trial** — Requires Phase 3
4. **Phase 5: Feature Gating** — Requires Phase 2 + 3
5. **Phase 6: Onboarding Revamp** — Requires Phase 1 + 4
6. **Phase 7: Launch Prep** — Requires all above

### Import-Specific Remaining Work
- Trakt OAuth flow (needs TRAKT_CLIENT_ID env var)
- SIMKL OAuth flow (needs SIMKL_CLIENT_ID env var)
- Manual resolution UI (tap unresolved items to search/pick TMDB match)
- Generic CSV import source (column mapping UI)
- Ratings import (currently skipped with user message)

## Pre-Launch Roadmap

### Before Launch (Priority Order)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Fix 4 critical bugs | DONE | |
| 2 | Test all fixes | DONE | |
| 3 | Fix review feedback (3 issues) | DONE | |
| 4 | Sync engine hardening (5 review rounds) | DONE | |
| 5 | Tech debt pass | DONE | |
| 6 | Fix review feedback (nested transactions + 6 more) | DONE | |
| 7 | Production prep (env var security + validation) | DONE | |
| 8 | Fix production black screen | DONE | |
| 9 | Verify TestFlight build | DONE | |
| 10 | Apple Sign-In (App Store requirement) | DONE | |
| 11 | Fix profile avatar letter for Apple Sign-In users | DONE | useFocusEffect + profile fetch |
| 12 | Show streaming availability on search page | DONE | Both modals, with race condition guard |
| 13 | Google Sign-In | DONE | Tested on dev build, TestFlight building |
| 14 | Fix remaining review feedback (6 issues) | DONE | Cached config, thenable, unknown props, fetchPaginated, profile in context |
| 15 | Fix Find People text input (KeyboardAvoidingView) | DONE | Defensive fix: KAV + autoFocus + keyboardDismissMode |
| 16 | My Ratings shows "Show #12345" instead of names on first load | DONE | TMDB fallback when show not in local SQLite |
| 17 | Library shows wrong episode count (e.g. 5/4) until tapped | DONE | Display clamp + background refresh + store at add time |
| 18 | Show air date alongside "in 4 days" / "tomorrow" countdown | DONE | Both EpisodeRow and UpNextScreen |
| 19 | Add a way to test notifications without waiting for a real episode | DONE | Test button on NotificationsScreen |
| 20 | Launch prep (app store assets) | IN PROGRESS | App Store Connect mostly configured |
| 21 | Fix signup profile showing email prefix | DONE | Race condition: refreshProfile after signUp |
| 22 | Fix episode watch count multiplying | DONE | Sync feedback loop, cleaned 1328 Supabase dupes |

### Post-Launch (v1.1+)
| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| 1 | **Widgets** | Medium | iOS home screen widget |
| 2 | **Watch stats** | Medium | Hours watched, streaks, genre breakdown |
| 3 | **Apple TV app** | High | Far down the road, after App Store launch |

### App Store Connect Status
- **Privacy Policy**: Notion page (published, URL set in ASC)
- **Support Page**: Notion page (published, URL set in ASC)
- **Description, Keywords, Promo Text**: Written and saved
- **Age Rating**: 4+ configured
- **Pricing**: Free, all territories
- **App Privacy**: 4 data types declared
- **Build**: Build 14 submitted to TestFlight (ASC App ID: 6758222275)
- **Still needs**: App name resolution, screenshots, test account, export compliance, marketing URL cleanup

### Google Cloud Console Status
- **Project**: UpNext (895548176925)
- **OAuth consent screen**: Published (production), External
- **Scopes**: openid, email, profile (non-sensitive, no verification needed)
- **Clients**: UpNext Web (web app), UpNext iOS (iOS app)
- **Redirect URIs on Web client**: `https://aqzbfqkimrndyuukkozn.supabase.co/auth/v1/callback`, `https://auth.expo.io/@pwidds/upnext`
- **Google Play Developer Account**: Created (personal)

### Open Questions
- **Email change for Apple Sign-In users**: Apple provides a private relay email. Allow users to change, or not necessary?

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- `deduplicateWatchHistory` runs on every init (cheap at current scale, add migration flag later)
- See `TECH_DEBT.md` for full medium/low priority debt

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

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (all 22 fixes)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
