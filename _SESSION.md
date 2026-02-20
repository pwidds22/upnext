# UpNext - Session State
Updated: 2026-02-19 | Branch: main

## Status: Phase 2 (Stats Dashboard) COMPLETE — tested on device with fixes applied

### This Session
- **Phase 2: Stats Dashboard — COMPLETE**
  - Built full stats dashboard with 10 sections (5 free, 5 premium-locked)
  - Custom View-based chart components (no chart library): BarChart, HeatmapGrid, SegmentedBar
  - SQL-first aggregation: all stats computed via COUNT/SUM/GROUP BY in SQLite
  - Progressive 4-stage loading: hero (~5ms) → library/reactions → streak/streaming/trend → premium sections
  - 30-second cache TTL via useRef, refresh on screen focus
  - Runtime estimation: movies use stored runtime, TV shows use COALESCE(runtime, 30) with lazy TMDB backfill
  - Premium gating: LockedSection component with blur + lock overlay (isPremium hardcoded true for now)
  - Navigation: Profile → Account → "My Stats" menu item
- **User feedback applied:**
  - Episode Reactions now shows "Recent Reactions" with last 5 reacted episodes (show name, episode code, emoji)
  - Bulk-mark detection: filters out episodes with timestamps within 60s + count > 12 for binge stats
  - Fastest binge requires watch span > 1 hour to exclude bulk-marked shows
- TypeScript compiles cleanly (pre-existing NotificationsScreen type error only)

### Files Created This Session
- `src/screens/StatsScreen.tsx` — Main stats dashboard screen (ScrollView, progressive loading, empty state)
- `src/hooks/useStats.ts` — Stats computation hook (4-stage progressive loading, 30s cache, backfill trigger)
- `src/services/statsService.ts` — Stats computation service (all business logic, streak calc, fun facts, backfill)
- `src/components/stats/StatCard.tsx` — Reusable section card wrapper with icon + title
- `src/components/stats/HeroBanner.tsx` — 3 hero stats: ~watch time, episodes, movies
- `src/components/stats/WatchingStreak.tsx` — Current/longest streak + 14-day dot visualization
- `src/components/stats/LibraryOverview.tsx` — TV/movie status breakdown with SegmentedBar + legend
- `src/components/stats/ReactionsSummary.tsx` — Good/meh/bad distribution + recent reacted episodes
- `src/components/stats/StreamingBreakdown.tsx` — "Where You Watch" horizontal bars by provider
- `src/components/stats/WatchTimeBreakdown.tsx` — This week/month/all-time + busiest day bar chart
- `src/components/stats/ActivityCalendar.tsx` — GitHub-style 3-month heatmap
- `src/components/stats/MostWatchedShows.tsx` — Top 5 show leaderboard with poster + completion bar
- `src/components/stats/MonthlyTrend.tsx` — 12-month bar chart with peak month highlight
- `src/components/stats/FunFacts.tsx` — Biggest binge, fastest binge, most rewatched (1 free, rest locked)
- `src/components/stats/LockedSection.tsx` — Premium lock overlay (opacity 0.25 + lock CTA)
- `src/components/stats/BarChart.tsx` — Reusable vertical bar chart (View-based)
- `src/components/stats/HeatmapGrid.tsx` — GitHub-style heatmap grid with month/day labels
- `src/components/stats/SegmentedBar.tsx` — Horizontal proportional bar

### Files Modified This Session
- `src/types/index.ts` — Added Stats route + ~86 lines of stat types (HeroStats, StreakStats, StatsData, ReactedEpisode, etc.)
- `src/navigation/AppNavigator.tsx` — Added StatsScreen route
- `src/screens/ProfileScreen.tsx` — Added "My Stats" menu item (top of Account section)
- `src/services/storage.ts` — Added ~20 aggregate query methods for stats (counts, joins, grouping, bulk-mark detection)

### Next Session Priority Order
1. **Phase 3: RevenueCat + Subscriptions** — Premium infrastructure
2. **Phase 4: Paywall + Reverse Trial** — Requires Phase 3
3. **Phase 5: Feature Gating** — Requires Phase 2 + 3 (Stats already has LockedSection ready)
4. **Phase 6: Onboarding Revamp** — Requires Phase 1 + 4
5. **Phase 7: Launch Prep** — Requires all above

### Stats-Specific Remaining Work
- Genres breakdown (deferred — needs genre_ids column + backfill)
- Wire up isPremium to actual RevenueCat subscription state (Phase 3)
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
| 3 | RevenueCat + Subscriptions | TODO | Next up |
| 4 | Paywall + Reverse Trial | TODO | Requires Phase 3 |
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
