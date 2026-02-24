# UpNext - Session State
Updated: 2026-02-24 | Branch: main

## Status: Onboarding + auth gating complete, caught-up detection added

### This Session
- **Fixed stale refresh token data bleed** — When session restoration fails (stale token), now clears orphaned SQLite data alongside auth session
- **Required auth before main app** — Onboarding → Sign In/Sign Up → Main (no more "Continue without account")
  - Conditional screen rendering in AppNavigator based on `isOnboardingComplete` + `user`
  - Removed `onSkip` prop and skip button from SignIn/SignUp screens
  - OnboardingScreen now accepts `onComplete` callback instead of using navigation
- **Added empty state CTAs** — Home and Library show actionable "Find Shows & Movies" / "Search" buttons when empty
- **Added caught-up detection** — When user watches all aired episodes, prompts with "Mark as Waiting" / "Mark as Completed" / "Keep Watching"
- **Fixed auto-mark transaction error** — Skip auto-mark when already caught up (prevents nested SQLite transaction crash)

### Files Modified This Session
- `src/contexts/AuthContext.tsx` — Clear orphaned local data on stale session detection
- `src/navigation/AppNavigator.tsx` — Conditional rendering: Onboarding → Auth → Main; removed `onComplete` from AuthNavigator
- `src/screens/OnboardingScreen.tsx` — Accept `onComplete` prop, removed `useNavigation` dependency
- `src/screens/auth/SignInScreen.tsx` — Removed `onSkip` prop, "Continue without account" button, and post-auth `onSkip()` calls
- `src/screens/auth/SignUpScreen.tsx` — Same removals as SignInScreen
- `src/screens/ProfileScreen.tsx` — Removed `onSkip` from embedded auth screens (dead code now)
- `src/screens/UpNextScreen.tsx` — Welcome empty state with "Find Shows & Movies" CTA button
- `src/screens/MyShowsScreen.tsx` — Empty state with "Search" CTA button
- `src/screens/ShowDetailScreen.tsx` — Caught-up prompt (watching → waiting/completed), skip auto-mark when already caught up

### Next Session Priority Order
1. **Ship to App Store** — Minimal launch prep (screenshots, app name resolution, test account, export compliance)
2. **Investigate search bar yellow tint** — User noticed search TextInput appears yellowish; may be cursor tint from nav theme primary color
3. **Consider show status notifications** — When metadata refresh detects a show changed to "Ended"/"Cancelled", could prompt user

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
