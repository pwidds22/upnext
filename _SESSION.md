# UpNext - Session State
Updated: 2026-02-17 | Branch: main

## Status: Review feedback done + Google Sign-In IN PROGRESS (blocked on Expo Go)

### This Session
- **Fixed 6 deferred review feedback issues** from previous Claude Web reviews
- Supabase client proxy improvements (caching, thenable, unknown properties)
- TMDB service refactor (extracted `fetchPaginated` helper, ~160 lines removed)
- Profile lifted to AuthContext (fixes stale avatar properly)
- **Google Sign-In code complete** — buttons on both screens, OAuth flow wired up
- **Google Cloud Console configured** — OAuth consent screen published, iOS + Web clients created
- **Stale refresh token fix** — AuthContext clears invalid sessions on startup
- **BLOCKED**: Google Sign-In can't be tested in Expo Go (bundle ID mismatch)

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

### What's In Progress — Google Sign-In
- **Code is done** — Both SignInScreen and SignUpScreen have Google buttons with full OAuth flow
- **Google Cloud Console is done** — OAuth consent screen published (production), scopes added (openid, email, profile)
- **Supabase Google provider configured** — Web client ID + secret set in Supabase dashboard
- **BLOCKER**: `expo-auth-session/providers/google` requires `iosClientId` on iOS, but Expo Go's bundle ID (`host.exp.Exponent`) doesn't match the configured iOS OAuth client bundle ID (`com.pwidd.upnext`). Error: `Client Id property 'iosClientId' must be defined to use Google auth on this platform.`
- **Fix needed**: Build a **development build** (`npx expo run:ios` or `eas build --profile development`) instead of using Expo Go. The iOS client ID is correctly configured — it just needs to run in an app with the right bundle ID.

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
| 13 | Google Sign-In | IN PROGRESS | Code done, needs dev build to test |
| 14 | Fix remaining review feedback (6 issues) | DONE | Cached config, thenable, unknown props, fetchPaginated, profile in context |
| 15 | Investigate: Find People text input not working | PENDING | Beta tester report, not reproducible yet |
| 16 | Launch prep (app store assets) | PENDING | |

### Post-Launch (v1.1+)
| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| 1 | **Widgets** | Medium | iOS home screen widget |
| 2 | **Watch stats** | Medium | Hours watched, streaks, genre breakdown |
| 3 | **Apple TV app** | High | Far down the road, after App Store launch |

### Next Session — Google Sign-In Testing
1. **Create a development build** — either `npx expo run:ios` (local) or `eas build --profile development --platform ios` (cloud). This gives an app with the correct bundle ID (`com.pwidd.upnext`).
2. **Test Google Sign-In** on the dev build — should work since all OAuth config is correct.
3. **Add EAS secrets** for production: `eas secret:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "..." --scope project` (and same for iOS client ID).
4. **Build new TestFlight** with Google Sign-In included.
5. **Android Google credential** (optional, can defer) — needs SHA-1 from `eas credentials -p android`, then create Android OAuth client in Google Cloud Console.

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
- **Build 11** on TestFlight (Apple Sign-In working)

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
- See Review Feedback section above for deferred fixes
