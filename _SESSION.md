# UpNext - Session State
Updated: 2026-02-16 | Branch: main

## Status: AVATAR FIX + STREAMING IN SEARCH — 2 review rounds passed

### This Session
- **Fixed profile avatar letter** — Apple Sign-In users now see display name initial instead of relay email initial
- **Added streaming availability to search** — "Where to Watch" provider pills in both show and movie add modals
- **Two Claude Web review rounds** — Fixed race conditions, stale state, added useFocusEffect

### What Was Completed
1. **Fixed avatar initial** (`src/navigation/AppNavigator.tsx:68-95`) — ProfileButton fetches user profile via `followsService.getUserProfile()`, uses `displayName > username > email > 'U'` fallback chain. Uses `useFocusEffect` to re-fetch on tab focus (updates after profile edit).

2. **Added streaming providers to search modals** (`src/screens/SearchScreen.tsx:59-60,92-110,610-621,717-728,1033-1063`) — Fetches from existing `tmdbService.getWatchProviders()` / `getMovieWatchProviders()` when modal opens. Shows flatrate providers as pills. Includes cancelled flag for race condition guard, skips fetch for already-tracked items.

### Files Modified This Session
- `src/navigation/AppNavigator.tsx` — ProfileButton profile fetch + useFocusEffect
- `src/screens/SearchScreen.tsx` — Provider state, fetch effects, "Where to Watch" UI in both modals
- `_SESSION.md` — Session notes

### Commits This Session
- `04f3897` — Fix profile avatar showing Apple relay email initial instead of display name
- `12cc134` — Show streaming availability in search modals for shows and movies
- `d2fb6ec` — Fix review feedback: clear stale providers, skip fetch for tracked items
- `64c5c90` — Update session notes: avatar fix and streaming in search done
- `c62ae1d` — Fix review feedback: race condition guard, useFocusEffect for avatar, console.warn

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
| 13 | Google Sign-In (external setup needed) | PENDING | Needs Google Cloud Console setup |
| 14 | Fix remaining review feedback (7 issues) | PENDING | See deferred review section below |
| 15 | Investigate: Find People text input not working | PENDING | Beta tester report, not reproducible yet |
| 16 | Launch prep (app store assets) | PENDING | |

### Post-Launch (v1.1+)
| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| 1 | **Widgets** | Medium | iOS home screen widget |
| 2 | **Watch stats** | Medium | Hours watched, streaks, genre breakdown |
| 3 | **Apple TV app** | High | Far down the road, after App Store launch |

### Open Questions
- **Email change for Apple Sign-In users**: Apple provides a private relay email (e.g. z8ry6...@privaterelay.appleid.com). Should we allow users to change their email, or is this not possible/necessary since Apple manages it?

### Bug: Find People Text Input (Unconfirmed)
- **Problem**: Beta tester reports they can't enter text on the Find People page
- **Status**: Not reproducible by developer — needs investigation
- **Possible causes**: Keyboard avoidance issue, input focus issue, platform-specific bug

### Review Feedback (Deferred)
7 remaining issues from Claude Web reviews:

| # | Priority | Issue | File |
|---|----------|-------|------|
| 2 | Medium | `isSupabaseConfigured()` re-parses URL on every property access — should cache | `client.ts:84` |
| 3 | Medium | No-op builder `.then` doesn't fully conform to thenable protocol | `client.ts:43` |
| 4 | Medium | Returns `undefined` for unknown Supabase properties (storage, functions, etc.) | `client.ts:87` |
| 5 | Low | Inconsistent error behavior — some TMDB methods throw, others return `[]` | `tmdb.ts` |
| 6 | Low | TMDB pagination methods duplicate fetch+error handling 8 times | `tmdb.ts:88-166` |
| 7 | Medium | Move user profile to AuthContext (stale avatar after profile edit) | `AuthContext.tsx`, `AppNavigator.tsx` |

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync — needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`
- See `TECH_DEBT.md` for full medium/low priority debt

### Completed Features
- **Core** — Search, tracking, episodes, sync engine
- **Auth** — Signup, signin (email or username), Apple Sign-In
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
- **Build 11** on TestFlight (Apple Sign-In working)

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Needs Google Cloud Console setup + env vars: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
- See Review Feedback section above for deferred fixes
