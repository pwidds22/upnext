# UpNext - Session State
Updated: 2026-02-19 | Branch: main

## Status: Phase 3 (RevenueCat + Subscriptions) COMPLETE — code ready, needs dev build + ASC products

### This Session
- **Phase 3: RevenueCat + Subscriptions — COMPLETE**
  - Installed `react-native-purchases` SDK + Expo plugin
  - Created subscription service (`src/services/subscription.ts`) with lazy SDK init, offline cache (AsyncStorage 7-day TTL), graceful degradation when unconfigured
  - Created SubscriptionContext (`src/contexts/SubscriptionContext.tsx`) exposing `isPremium`, subscription state, restore purchases
  - Wired up StatsScreen: replaced hardcoded `isPremium = true` with real `useSubscription()` hook
  - Added `onUnlock` callbacks on all 4 LockedSection instances → navigates to Paywall modal
  - Created placeholder PaywallScreen with feature list + restore purchases button
  - Added "Upgrade to Premium" menu item in ProfileScreen (Account section, after My Stats)
  - Added subscription types to `types/index.ts` (SubscriptionPlan, SubscriptionState, CachedPremiumStatus)
  - RevenueCat test API key configured in `.env`: `test_TxZGwckdvmNGBzSQcqkuIGmyrRA`
- TypeScript compiles cleanly (pre-existing NotificationsScreen type error only)

### Files Created This Session
- `src/services/subscription.ts` — RevenueCat SDK wrapper (lazy import, configure, identify, checkPremiumStatus, restorePurchases, offline cache)
- `src/contexts/SubscriptionContext.tsx` — React context (isPremium, plan, periodType, trial state, restore, auto-refresh on auth/foreground/listener)
- `src/screens/PaywallScreen.tsx` — Placeholder paywall (feature list, restore purchases, premium check)

### Files Modified This Session
- `package.json` — Added `react-native-purchases`
- `app.json` — Added `react-native-purchases` plugin
- `.env` / `.env.example` — Added `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`
- `src/utils/constants.ts` — Added RevenueCat key to dev warning block
- `src/types/index.ts` — Added subscription types + `Paywall` nav param
- `App.tsx` — Added `SubscriptionProvider` to provider tree (inside SyncProvider)
- `src/screens/StatsScreen.tsx` — Replaced `isPremium = true` with `useSubscription()`, added `handleUnlock` → Paywall navigation
- `src/navigation/AppNavigator.tsx` — Added PaywallScreen route (modal presentation)
- `src/screens/ProfileScreen.tsx` — Added PremiumMenuItem component with trial badge

### Next Session Priority Order
1. **App Store Connect: Create subscription products** — Monthly ($2.99), Annual ($24.99), Lifetime ($79.99)
2. **RevenueCat dashboard: Create entitlement + offering** — `premium` entitlement, `default` offering, attach ASC products
3. **New dev build** — `react-native-purchases` requires native build (batch with any other native changes)
4. **Phase 4: Paywall + Reverse Trial** — Replace placeholder PaywallScreen with real purchase UI
5. **Phase 5: Feature Gating** — Gate export, advanced notifications beyond Stats
6. **Phase 6: Onboarding Revamp** — Requires Phase 1 + 4
7. **Phase 7: Launch Prep** — Requires all above

### RevenueCat Status
- **Account**: Created, "UpNext" project exists
- **Test API key**: `test_TxZGwckdvmNGBzSQcqkuIGmyrRA` (in `.env`)
- **Production API keys**: Not yet created (need ASC products first)
- **Entitlement**: Not yet created (need `premium` entitlement in dashboard)
- **Offerings**: Not yet created (need `default` offering with products)
- **ASC Products**: Not yet created (need subscription group + 3 products)

### Stats-Specific Remaining Work
- Genres breakdown (deferred — needs genre_ids column + backfill)
- Runtime backfill could be more aggressive (currently lazy on stats screen open)

### Import-Specific Remaining Work (from Phase 1)
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

### Monetization Phases
| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Import Infrastructure | DONE | 5 sources, TMDB resolver, import UI |
| 2 | Stats Dashboard | DONE | 10 sections, charts, premium gating ready |
| 3 | RevenueCat + Subscriptions | DONE | SDK installed, service + context + paywall placeholder, needs ASC products + dev build |
| 4 | Paywall + Reverse Trial | TODO | Requires Phase 3 products |
| 5 | Feature Gating | TODO | Requires Phase 2 + 3 |
| 6 | Onboarding Revamp | TODO | Requires Phase 1 + 4 |
| 7 | Launch Prep | TODO | Requires all above |

### Post-Launch (v1.1+)
| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| 1 | **Widgets** | Medium | iOS home screen widget |
| 2 | **Apple TV app** | High | Far down the road, after App Store launch |

### App Store Connect Status
- **Privacy Policy**: Notion page (published, URL set in ASC)
- **Support Page**: Notion page (published, URL set in ASC)
- **Description, Keywords, Promo Text**: Written and saved
- **Age Rating**: 4+ configured
- **Pricing**: Free, all territories
- **App Privacy**: 4 data types declared
- **Build**: Build 14 submitted to TestFlight (ASC App ID: 6758222275)
- **Still needs**: App name resolution, screenshots, test account, export compliance, marketing URL cleanup, subscription products

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
- **Import Data** — 5 sources (UpNext JSON, Trakt, TV Time, SIMKL, Letterboxd)
- **Stats Dashboard** — 10-section analytics with custom charts, premium gating
- **Subscriptions** — RevenueCat SDK, SubscriptionContext, PaywallScreen placeholder

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (all 22 fixes)
- **ASC App ID**: 6758222275
- **Needs new dev build** for `react-native-purchases` native module

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)
- **RevenueCat**: Test key in `.env`, production keys pending ASC product setup

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
