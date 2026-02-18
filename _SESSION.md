# UpNext - Session State
Updated: 2026-02-18 | Branch: main

## Status: Build 12 on TestFlight — Fixed 2 bugs, 2 UX improvements (#16-19)

### This Session
- **Fixed Bug #16: Ratings "Show #12345"** — Added TMDB fallback in ProfileScreen when show not in local SQLite
- **Fixed Bug #17: Library wrong episode count (5/4)** — Three-part fix:
  - Display clamp: `Math.max(rawTotal, watchedCount)` prevents N/M where N>M
  - Background refresh: stale shows auto-refresh aired episodes from TMDB
  - Prevention: store `airedEpisodes` when adding completed shows
- **Task #18: Air dates alongside countdown** — Upcoming episodes now show "Tomorrow · Wed, Feb 19" instead of just "Tomorrow". Applied to both EpisodeRow and UpNextScreen.
- **Task #19: Test notification button** — Added "Send Test Notification" button to NotificationsScreen. Sends a sample notification immediately with haptic feedback.

### Files Modified This Session
- `src/screens/ProfileScreen.tsx` — TMDB fallback for rating enrichment
- `src/screens/MyShowsScreen.tsx` — Display clamp + background refresh for stale aired episodes
- `src/screens/SearchScreen.tsx` — Store airedEpisodes at add time for completed shows
- `src/components/EpisodeRow.tsx` — Show air date alongside countdown for upcoming episodes
- `src/screens/UpNextScreen.tsx` — Show air date alongside countdown in Coming Soon section
- `src/screens/NotificationsScreen.tsx` — Send Test Notification button with permission checks

### What Was Completed
1. **Cached `isSupabaseConfigured()`** (`src/services/supabase/client.ts:23-33`) — IIFE computes result once at module init.

2. **Fixed no-op builder thenable** (`src/services/supabase/client.ts:41-54`) — Backed by `Promise.resolve()` with `.then/.catch/.finally` forwarding.

3. **Unknown Supabase properties return chainable no-op** (`src/services/supabase/client.ts:92,104`) — `supabase.storage`, `.functions`, `.realtime` now return chainable no-op proxy.

4. **Extracted `fetchPaginated<T>()` helper** (`src/services/tmdb.ts:88-116`) — 8 pagination methods reduced to one-liners.

5. **Profile in AuthContext** (`src/contexts/AuthContext.tsx:29,33-50`) — `profile` and `refreshProfile()` on context.

6. **ProfileButton simplified** (`src/navigation/AppNavigator.tsx:69`) — Just `const { user, profile } = useAuth()`.

7. **ProfileScreen wired up** (`src/screens/ProfileScreen.tsx:309,696`) — Calls `refreshAuthProfile()` after edit.

8. **Google Sign-In button on SignUpScreen** (`src/screens/auth/SignUpScreen.tsx:59-94,219-234`) — Full OAuth flow matching SignInScreen pattern.

9. **Stale refresh token handling** (`src/contexts/AuthContext.tsx:62-69`) — Catches invalid refresh token errors on startup, clears session gracefully.

10. **Google env vars added** (`.env:9-11`) — Web + iOS client IDs configured, Android empty.

### Google Sign-In — COMPLETE
- **Tested and working** on dev build — both Sign In and Sign Up screens
- **Apple Sign-In also re-verified** on dev build
- **EAS secrets set** for development + production environments
- **`expo-dev-client` installed** (required for dev builds)

### Files Modified This Session
- `src/services/supabase/client.ts` — Cached config check, thenable fix, unknown property handling
- `src/services/tmdb.ts` — `fetchPaginated` helper, 8 methods refactored
- `src/contexts/AuthContext.tsx` — Profile state + refreshProfile + stale token handling
- `src/navigation/AppNavigator.tsx` — Simplified ProfileButton
- `src/screens/ProfileScreen.tsx` — Context refresh after profile edit
- `src/screens/auth/SignInScreen.tsx` — Google OAuth (already had it, no changes needed)
- `src/screens/auth/SignUpScreen.tsx` — Added Google Sign-In button + OAuth flow
- `.env` — Google Sign-In client IDs added
- `_SESSION.md` — Session notes

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
| 15 | Investigate: Find People text input not working | PENDING | Beta tester report, not reproducible yet |
| 16 | My Ratings shows "Show #12345" instead of names on first load | DONE | TMDB fallback when show not in local SQLite |
| 17 | Library shows wrong episode count (e.g. 5/4) until tapped | DONE | Display clamp + background refresh + store at add time |
| 18 | Show air date alongside "in 4 days" / "tomorrow" countdown | DONE | Both EpisodeRow and UpNextScreen |
| 19 | Add a way to test notifications without waiting for a real episode | DONE | Test button on NotificationsScreen |
| 20 | Launch prep (app store assets) | PENDING | | |

### Post-Launch (v1.1+)
| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| 1 | **Widgets** | Medium | iOS home screen widget |
| 2 | **Watch stats** | Medium | Hours watched, streaks, genre breakdown |
| 3 | **Apple TV app** | High | Far down the road, after App Store launch |

### Next Up
1. **Run /review** — Claude Web review was down this session; run review next session before committing further
2. **Investigate Find People text input bug** — beta tester report, not yet reproduced
3. **Launch prep** — App Store screenshots, description, metadata
4. **Android Google credential** (optional) — needs SHA-1 from `eas credentials -p android`, then create Android OAuth client in Google Cloud Console

### Google Cloud Console Status
- **Project**: UpNext (895548176925)
- **OAuth consent screen**: Published (production), External
- **Scopes**: openid, email, profile (non-sensitive, no verification needed)
- **Clients**: UpNext Web (web app), UpNext iOS (iOS app)
- **Redirect URIs on Web client**: `https://aqzbfqkimrndyuukkozn.supabase.co/auth/v1/callback`, `https://auth.expo.io/@pwidds/upnext`
- **Google Play Developer Account**: Created (personal)

### Open Questions
- **Email change for Apple Sign-In users**: Apple provides a private relay email (e.g. z8ry6...@privaterelay.appleid.com). Should we allow users to change their email, or is this not possible/necessary since Apple manages it?

### Bug: Find People Text Input (Unconfirmed)
- **Problem**: Beta tester reports they can't enter text on the Find People page
- **Status**: Not reproducible by developer — needs investigation
- **Possible causes**: Keyboard avoidance issue, input focus issue, platform-specific bug

### Review Feedback (Resolved)
All 6 deferred issues from Claude Web reviews have been fixed:

| # | Priority | Issue | Status |
|---|----------|-------|--------|
| 2 | Medium | `isSupabaseConfigured()` re-parses URL on every property access | DONE — cached via IIFE |
| 3 | Medium | No-op builder `.then` doesn't fully conform to thenable protocol | DONE — backed by Promise.resolve() |
| 4 | Medium | Returns `undefined` for unknown Supabase properties | DONE — returns chainable no-op proxy |
| 5 | Low | Inconsistent error behavior — some TMDB methods throw, others return `[]` | DONE — documented split, extracted helper |
| 6 | Low | TMDB pagination methods duplicate fetch+error handling 8 times | DONE — extracted fetchPaginated<T>() |
| 7 | Medium | Move user profile to AuthContext (stale avatar after profile edit) | DONE — profile in context |

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

### Completed Features
- **Core** — Search, tracking, episodes, sync engine
- **Auth** — Signup, signin (email or username), Apple Sign-In, Google Sign-In (code done)
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
- **Build 12** on TestFlight (Google Sign-In + Apple Sign-In working)

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
- See Review Feedback section above for deferred fixes
