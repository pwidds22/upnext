# UpNext - Session State
Updated: 2026-02-20 | Branch: main

## Status: Phase 4 (Paywall) COMPLETE — ASC products configured, dev build in progress

### This Session
- **ASC Products + RevenueCat Dashboard — COMPLETE** (done via Claude Web extension)
  - Created subscription group "UpNext Premium" in App Store Connect
  - Monthly: $1.99/month + 14-day free trial (founding price)
  - Annual: $14.99/year + 14-day free trial (founding price)
  - Lifetime: $49.99 non-consumable (founding price)
  - IAP Key ID: `A3VL7TXUCZ`, Issuer ID: `1faf4cae-0970-419b-a0c1-377f6e9a19af`
  - RevenueCat: `premium` entitlement, `default` offering with 3 packages (`$rc_monthly`, `$rc_annual`, `$rc_lifetime`)
  - App Store Server Notifications: Production + Sandbox URLs set to RevenueCat webhook (V2)
  - P8 key uploaded to RevenueCat, showing "Valid credentials"
  - Production API key created in RevenueCat (needs to replace test key in `.env`)
- **Phase 4: Real Paywall Screen — COMPLETE**
  - Rewrote `src/screens/PaywallScreen.tsx` from placeholder to full purchase UI
  - Fetches real offerings from RevenueCat on mount
  - 3 plan cards (Monthly, Annual, Lifetime) with localized prices from App Store
  - Annual pre-selected with "BEST VALUE" badge, per-month equivalent, savings %
  - Dynamic CTA: "Start Free Trial" when trial available, "Purchase" for lifetime
  - Purchase flow with loading state, auto-dismisses on success
  - Silent handling of user cancel (PURCHASE_CANCELLED_ERROR)
  - Graceful fallback when offerings fail to load (retry button)
  - Trial disclaimer text for Apple compliance
  - Legal links (Terms of Service, Privacy Policy)
  - Restore purchases button
- **Build fix**: Removed invalid `react-native-purchases` config plugin from `app.json` (v9 doesn't ship one)
- TypeScript compiles cleanly (pre-existing NotificationsScreen type error only)

### Files Modified This Session
- `src/screens/PaywallScreen.tsx` — Complete rewrite: placeholder → real paywall with offerings, plan cards, purchase flow
- `app.json` — Removed invalid `react-native-purchases` plugin entry

### Next Session Priority Order
1. **Update `.env` with production RevenueCat API key** — Replace `test_TxZGwckdvmNGBzSQcqkuIGmyrRA` with production `appl_xxx` key
2. **Test paywall on dev build** — Verify offerings load, plan cards show real prices, sandbox purchase works
3. **Phase 5: Feature Gating** — Gate data export, advanced notifications beyond Stats
4. **Phase 6: Onboarding Revamp** — Requires Phase 1 + 4
5. **Phase 7: Launch Prep** — Requires all above

### RevenueCat Status
- **Account**: Created, "UpNext" project exists
- **Test API key**: `test_TxZGwckdvmNGBzSQcqkuIGmyrRA` (currently in `.env`)
- **Production API key**: Created (Feb 20, 2026) — needs to be swapped into `.env` and EAS secrets
- **Entitlement**: `premium` — created with 3 products attached
- **Offerings**: `default` — with `$rc_monthly`, `$rc_annual`, `$rc_lifetime` packages
- **ASC Products**: All 3 created with founding prices ($1.99/$14.99/$49.99)
- **Server Notifications**: Production + Sandbox URLs configured (V2)
- **P8 key**: Uploaded, valid credentials
- **Shared secret**: Entered (legacy StoreKit 1, optional since P8 key handles StoreKit 2)

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
| 3 | RevenueCat + Subscriptions | DONE | SDK, service, context, ASC products, RevenueCat dashboard |
| 4 | Paywall + Reverse Trial | DONE | Real paywall with offerings, plan cards, purchase flow |
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
- **Subscription Products**: 3 products created (founding prices: $1.99/$14.99/$49.99)
- **Server Notifications**: V2, production + sandbox URLs set
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
- **Import Data** — 5 sources (UpNext JSON, Trakt, TV Time, SIMKL, Letterboxd)
- **Stats Dashboard** — 10-section analytics with custom charts, premium gating
- **Subscriptions** — RevenueCat SDK, SubscriptionContext, real PaywallScreen with purchase flow

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (one pre-existing NotificationsScreen type error)
- **Build 14** on TestFlight (all 22 fixes)
- **ASC App ID**: 6758222275
- **Dev build in progress** — EAS building iOS development profile (includes `react-native-purchases` native module)

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **IAP Key ID**: A3VL7TXUCZ (uploaded to RevenueCat)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)
- **RevenueCat**: Production key created, test key currently in `.env` (swap before next TestFlight)

## Known Issues
- See `TECH_DEBT.md` for full technical debt tracking
