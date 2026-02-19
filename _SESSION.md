# UpNext - Session State
Updated: 2026-02-18 | Branch: main

## Status: Build 13 building — 2 bug fixes, App Store Connect setup in progress

### This Session
- **Fixed Bug #15: Find People text input** (`src/screens/UserSearchScreen.tsx`) — Added KeyboardAvoidingView, autoFocus, keyboardDismissMode. Reviewed by Claude Web: PASS.
- **Fixed Bug #21: Signup profile race condition** (`src/contexts/AuthContext.tsx`) — After signup, profile showed email prefix ("testing") instead of chosen username. Root cause: `onAuthStateChange` fired `refreshProfile()` before profile update completed. Fix: explicit `refreshProfile(newUser.id)` after `authService.signUp()` returns.
- **App Store Connect setup** (via Claude Web extension):
  - Privacy Policy + Support pages created on Notion
  - App Information, Pricing, Privacy, Version info all configured
  - Remaining: App name (taken), screenshots, test account credentials, export compliance, marketing URL cleanup

### Files Modified This Session
- `src/screens/UserSearchScreen.tsx` — KeyboardAvoidingView + autoFocus + keyboardDismissMode
- `src/contexts/AuthContext.tsx` — `refreshProfile(userId?)` param + post-signup refresh

### CRITICAL BUG: Episode Watch Count Multiplying (#22)
- **Problem**: Marking an episode as watched once causes the watch count to keep growing (e.g., shows 12 watches for an episode only watched once). Watch history shows the same date/time duplicated many times.
- **Severity**: HIGH — corrupts user data, makes rewatch tracking unreliable
- **Reproduction**: Add new shows to library, mark episodes as watched. Watch count keeps incrementing on its own.
- **Likely areas to investigate**:
  - `src/services/storage.ts` — SQLite watch history insert logic (check for duplicate inserts)
  - `src/services/supabase/` — Cloud sync may be re-inserting watch records on each sync cycle
  - Sync engine — bidirectional sync could be creating duplicates (local→cloud→local loop)
  - Check if `INSERT OR REPLACE` anti-pattern is involved (see CLAUDE.md anti-patterns)
  - Check unique constraints on watch_history table
- **Priority**: Must fix before App Store submission — this is user-facing data corruption

### Next Session Priority Order
1. **Fix episode watch count multiplying bug (#22)** — CRITICAL, blocks launch
2. **App Store Connect remaining items**:
   - Resolve app name ("UpNext" is taken — try "UpNext: TV Tracker" or alternatives)
   - Clear marketing URL (still shows fake upnext.app)
   - Add test account credentials (test@test.com / test1234)
   - Confirm export compliance (no encryption)
   - Screenshots
3. **Create test account** — test@test.com / test1234 for Apple reviewer
4. **Submit for review** once build 13 is verified

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
| 22 | Fix episode watch count multiplying | PENDING | CRITICAL — watch history duplicating |

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
- **Build**: Build 12 selected (Build 13 building with latest fixes)
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
- TypeScript compiles cleanly (zero errors)
- **Build 13** building (signup fix + Find People fix)
- **Build 12** on TestFlight (Google Sign-In + Apple Sign-In working)

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Known Issues
- **CRITICAL: Episode watch count multiplying** — see Bug #22 above
- See `TECH_DEBT.md` for full technical debt tracking
