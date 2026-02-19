# UpNext - Session State
Updated: 2026-02-19 | Branch: main

## Status: Build 14 on TestFlight — ready for verification and App Store prep

### This Session
- **Build 14 created on EAS and submitted to TestFlight** — iOS production build with all 22 bug fixes including Bug #22 (watch history dedup)
  - Build number auto-incremented 13 → 14
  - EAS build: https://expo.dev/accounts/pwidds/projects/upnext/builds/100b49df-fb48-49a8-811a-c8fd560a1ea8
  - Submission: https://expo.dev/accounts/pwidds/projects/upnext/submissions/bb4159b4-504a-4f31-87eb-c7604ee270b5
  - Pre-build checks passed: expo-doctor 17/17, git clean, TS clean (pre-existing NotificationsScreen type error only)
- **Added `ascAppId` to `eas.json`** — `6758222275`, enables non-interactive `eas submit` going forward
- **Added build discipline anti-pattern to `CLAUDE.md`** — batch fixes, don't build after every single fix
- **Build credits at 97%** for this month — be mindful of additional builds

### Files Modified This Session
- `eas.json` — Added `ascAppId: "6758222275"` to submit profile
- `CLAUDE.md` — Added "Builds" anti-pattern section (batch fixes, check credits)

### Next Session Priority Order
1. **Verify Build 14 on TestFlight** — Install, test Bug #22 fix (watch count stays at 1), smoke test all features
2. **App Store Connect remaining items**:
   - Resolve app name ("UpNext" is taken — try "UpNext: TV Tracker" or alternatives)
   - Clear marketing URL (still shows fake upnext.app)
   - Add test account credentials (test@test.com / test1234)
   - Confirm export compliance (no encryption)
   - Screenshots
3. **Create test account** — test@test.com / test1234 for Apple reviewer
4. **Submit for review** once build 14 is verified

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
