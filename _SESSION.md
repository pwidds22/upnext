# UpNext - Session State
Updated: 2026-02-16 | Branch: main

## Status: APPLE & GOOGLE SIGN-IN IMPLEMENTED — Build 11 on TestFlight

### This Session
- **Implemented Apple Sign-In** — Full native iOS flow using expo-apple-authentication + Supabase signInWithIdToken
- **Implemented Google Sign-In scaffolding** — Token exchange ready, needs Google Cloud Console setup
- **Fixed noOpAuth crash risk** — Added signInWithOAuth + signInWithIdToken to no-op auth object
- **Added social login buttons** — Both SignInScreen and SignUpScreen now show Apple button
- **Apple Developer Console configured** — Key ID: 3D34TRP685, Sign in with Apple enabled
- **Supabase Apple provider enabled** — Client ID set, native flow doesn't need secret key

### What Was Completed
1. **Installed OAuth dependencies** — `expo-apple-authentication`, `expo-auth-session`, `expo-crypto`, `expo-web-browser`

2. **Updated app.json** (`app.json:20,42`) — Added `usesAppleSignIn: true` and `expo-apple-authentication` plugin

3. **Fixed noOpAuth** (`src/services/supabase/client.ts:60-61`) — Added `signInWithOAuth` and `signInWithIdToken` to prevent crashes when Supabase is not configured

4. **Implemented Apple Sign-In** (`src/services/supabase/auth.ts:78-168`) — Full native flow: availability check → nonce generation → Apple credential request → Supabase token exchange → profile update with display name

5. **Implemented Google token exchange** (`src/services/supabase/auth.ts:170-191`) — `signInWithGoogleToken()` method exchanges Google ID token with Supabase

6. **Updated AuthContext** (`src/contexts/AuthContext.tsx:14-15,63-71`) — Added `signInWithApple` and `signInWithGoogleToken` to auth context

7. **Updated SignInScreen** (`src/screens/auth/SignInScreen.tsx`) — Added Apple button (iOS), Google button (when configured), "or" divider between social and email login

8. **Updated SignUpScreen** (`src/screens/auth/SignUpScreen.tsx`) — Added Apple "Sign up with Apple" button with "or sign up with email" divider

### Files Modified This Session
- `package.json` / `package-lock.json` — Added 4 OAuth packages
- `app.json` — `usesAppleSignIn: true` + plugin
- `src/services/supabase/client.ts` — noOpAuth OAuth methods
- `src/services/supabase/auth.ts` — Apple Sign-In flow + Google token exchange + Google client ID exports
- `src/contexts/AuthContext.tsx` — OAuth context methods
- `src/screens/auth/SignInScreen.tsx` — Apple + Google buttons
- `src/screens/auth/SignUpScreen.tsx` — Apple button

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
| 11 | Fix profile avatar letter for Apple Sign-In users | **NEXT** | Shows email initial (e.g. "Z" from relay email) instead of username/display name |
| 12 | Show streaming availability on search page | **NEXT** | Currently only shown when show is in library; also missing for movies entirely |
| 13 | Google Sign-In (external setup needed) | PENDING | Needs Google Cloud Console setup |
| 14 | Fix remaining review feedback (5 issues) | PENDING | See deferred review section below |
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

### Bug: Profile Avatar Letter (Apple Sign-In)
- **Problem**: Profile avatar shows first letter of Apple relay email (e.g. "Z") instead of username or display name
- **Fix**: Avatar component should derive its letter from `display_name` first, then `username`, then fall back to email
- **Where to look**: Wherever the profile avatar/initial is rendered (likely in a header or profile component)

### Bug: Streaming Availability Not Shown in Search
- **Problem**: When users tap a show/movie on the search page, they can't see where to stream it
- **Current behavior**: Streaming info only shows when the show is already in the user's library
- **Missing entirely**: Movies don't show streaming availability at all
- **Fix**: Show streaming/watch providers on the detail screen regardless of whether it's in the library

### Bug: Find People Text Input (Unconfirmed)
- **Problem**: Beta tester reports they can't enter text on the Find People page
- **Status**: Not reproducible by developer — needs investigation
- **Possible causes**: Keyboard avoidance issue, input focus issue, platform-specific bug

### Review Feedback (Deferred)
5 remaining issues from previous Claude Web review (issue #1 fixed this session):

| # | Priority | Issue | File |
|---|----------|-------|------|
| 2 | Medium | `isSupabaseConfigured()` re-parses URL on every property access — should cache | `client.ts:84` |
| 3 | Medium | No-op builder `.then` doesn't fully conform to thenable protocol | `client.ts:43` |
| 4 | Medium | Returns `undefined` for unknown Supabase properties (storage, functions, etc.) | `client.ts:87` |
| 5 | Low | Inconsistent error behavior — some TMDB methods throw, others return `[]` | `tmdb.ts` |
| 6 | Low | TMDB pagination methods duplicate fetch+error handling 8 times | `tmdb.ts:88-166` |

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
