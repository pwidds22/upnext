# UpNext - Session State
Updated: 2026-02-24 | Branch: main

## Status: Build 17 submitted to ASC, awaiting screenshots + review submission

### This Session
- **App Store launch prep** — Updated AboutScreen URLs, built and submitted to ASC
  - Updated privacy policy link → Notion URL
  - Added Terms of Use link → Notion URL (created by Claude Chrome)
  - Updated Contact Support → Notion support page (was broken `support@upnext.app` email)
  - Removed placeholder `upnext.app` domain references
  - Claude Chrome audited ASC: updated app privacy declarations (removed Product Interaction, now 3 data types)
  - Export compliance already configured (`ITSAppUsesNonExemptEncryption: false`)
- **Bug fixes found during testing:**
  - Fixed UpNext screen showing empty state after sign-in — was a race condition where screen loaded before sync completed. Added `useSyncContext()` to reload when sync transitions from syncing → idle.
  - Fixed episode count showing unaired episodes (e.g., "22/30" instead of "22/22") — `airedEpisodes` was only calculated for "completed" status. Now calculated for all statuses when adding a show. Also fixed MyShowsScreen background refresh to recalculate shows with missing `airedEpisodes`.
  - Fixed shows lost on sign-out/sign-in — sync queue wasn't flushed before clearing local data. Now `pushChanges()` runs before `clearAllData()` on sign-out, ensuring pending changes reach Supabase.
- **Build 17** submitted to ASC (includes all fixes + URL updates)

### Files Modified This Session
- `src/screens/AboutScreen.tsx` — Updated privacy/terms/support URLs to Notion pages, added Terms of Use link
- `src/screens/UpNextScreen.tsx` — Added sync state listener to reload after initial sync completes
- `src/screens/SearchScreen.tsx` — Calculate airedEpisodes for all show statuses (not just completed)
- `src/screens/MyShowsScreen.tsx` — Background refresh catches shows with null airedEpisodes
- `src/contexts/AuthContext.tsx` — Flush sync queue before clearing data on sign-out

### What's Left for App Store Submission
1. **Screenshots** — Install Build 17 via TestFlight, take screenshots of 6 key screens
2. **Upload screenshots to ASC** — iPhone 6.5" (1242x2688 or 1284x2778) required
3. **Verify demo account** — Ensure test account has sample tracked shows/movies/ratings
4. **Select Build 17 in ASC** — On the version page, select the new build
5. **Submit for Review** — Click "Submit for Review"

### App Store Connect Status
- **Privacy Policy**: Notion page (published, URL set in ASC)
- **Support Page**: Notion page (published, URL set in ASC)
- **Terms of Use**: Notion page (created this session)
- **Description, Keywords, Promo Text**: Written and saved
- **Age Rating**: 4+ configured
- **Pricing**: Free, all territories
- **App Privacy**: 3 data types declared (Email Address, Other User Content, User ID — all App Functionality, Linked)
- **Export Compliance**: Configured (no non-exempt encryption)
- **App Review Contact**: Set
- **Build**: Build 17 submitted to ASC (v1.0.0, build 17)
- **Still needs**: Screenshots, demo account verification, submit for review

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
- **Build 17** submitted to ASC (v1.0.0, build 17)
- **ASC App ID**: 6758222275

## External Config Notes
- **Apple Key ID**: 3D34TRP685 (keep .p8 file secure, cannot re-download)
- **Google Sign-In**: Configured — Web + iOS client IDs in `.env`, Supabase Google provider enabled
- **Google Play**: Developer account created (personal, $25)

## Research Files (Not Committed)
- `CLAUDE_DEEP_RESEARCH.md` — Market viability analysis
- `Monetization_Launch.md` — Original monetization strategy (obsolete)
- Other research docs — `OAUTH_TRAKT_SIMKL.md`, `Premium_Value_Proposition.md`, `WATCH_HISTORY_IMPORT.md`, `series_guide_reviews.md`, `trakt_reviews.md`, `tv_time_reviews.md`
