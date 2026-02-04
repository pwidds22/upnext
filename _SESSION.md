# UpNext - Session State
Updated: 2026-02-04 | Branch: main

## Status: Tech Debt Pass Complete + Review Feedback Captured

### This Session
- Fixed 7 batches of tech debt (18 files, -101 net lines)
- Ran Claude Web review — found 1 critical issue (nested transactions) and 4 medium/low issues
- All review feedback captured in TECH_DEBT.md for next session
- TypeScript compiles cleanly (zero errors, export.ts displayName bug fixed)

### What Was Completed
1. **Race condition transactions** (`src/services/storage.ts`) - Wrapped 5 check-then-insert methods in `withTransactionAsync`: `markEpisodeWatched`, `addToSyncQueue`, `setReaction`, `dismissShow`, `dismissMovie`
2. **Sync safety** (`src/services/supabase/sync.ts`) - Added try-catch around `JSON.parse` in `processSyncQueueItem`, eliminated N+1 query in `getAllLocalEpisodes`
3. **Hook error states** (`src/hooks/useFollowToggle.ts`, `src/hooks/useEpisodeReactions.ts`) - Both hooks now expose `error` state to consumers
4. **Non-functional UI removed** (`src/screens/SyncSettingsScreen.tsx`) - Removed fake auto-sync toggle; (`src/screens/ProfileScreen.tsx`) - Removed non-functional "See All" button
5. **Unused imports cleaned** - `src/screens/MyShowsScreen.tsx`, `src/screens/SearchScreen.tsx`, `src/screens/UpNextScreen.tsx`, `src/components/EpisodeRow.tsx`
6. **Export bug fixed** (`src/services/export.ts`) - Fixed `display_name` → `displayName` property access, added `warnings` array for partial export failures; (`src/types/index.ts`) - Added `warnings?: string[]` to ExportData
7. **Error UI added** (`src/components/WatchHistorySheet.tsx`) - Alert.alert in 4 catch blocks; (`src/components/ProfileVisibilitySheet.tsx`) - Alert on save failure; (`src/screens/UpNextScreen.tsx`, `src/screens/MyShowsScreen.tsx`) - Error state + retry button
8. **Screen merge** - Merged `FollowersScreen.tsx` + `FollowingScreen.tsx` → `src/screens/UserListScreen.tsx`; updated `src/navigation/AppNavigator.tsx`

### Files Modified This Session
- `src/services/storage.ts` - 5 methods wrapped in withTransactionAsync
- `src/services/supabase/sync.ts` - JSON.parse safety, N+1 elimination
- `src/hooks/useFollowToggle.ts` - Added error state
- `src/hooks/useEpisodeReactions.ts` - Added error state, removed unused import
- `src/screens/SyncSettingsScreen.tsx` - Removed auto-sync toggle + unused imports/styles
- `src/screens/ProfileScreen.tsx` - Removed "See All" button + styles
- `src/screens/MyShowsScreen.tsx` - Removed unused imports, added error state + retry UI
- `src/screens/SearchScreen.tsx` - Removed unused MediaType import
- `src/screens/UpNextScreen.tsx` - Removed unused import, added error state + retry UI
- `src/components/EpisodeRow.tsx` - Removed unused formatEpisodeCode import
- `src/components/WatchHistorySheet.tsx` - Added Alert.alert in 4 catch blocks
- `src/components/ProfileVisibilitySheet.tsx` - Added Alert.alert on save failure
- `src/services/export.ts` - Fixed displayName bug, added warnings
- `src/types/index.ts` - Added warnings to ExportData
- `src/screens/UserListScreen.tsx` - NEW: merged Followers/Following screen
- `src/navigation/AppNavigator.tsx` - Updated to use UserListScreen
- `TECH_DEBT.md` - Updated with fixed items + new review feedback

### Next Session Plan (Priority Order)
1. **CRITICAL: Fix nested withTransactionAsync** - `storage.ts` — `markEpisodeWatched` etc. call `addToSyncQueue` which also uses `withTransactionAsync`. expo-sqlite may not support nesting. Extract inner logic into `_addToSyncQueueRaw()` helper.
2. **Fix UserListScreen double hook call** - Both `useFollowersList` and `useFollowingList` fire on mount. Add `enabled` parameter to skip unused fetch.
3. **Fix error state pull-to-refresh** - UpNextScreen and MyShowsScreen error views render outside scrollable container. Wrap in ScrollView+RefreshControl.
4. **Display useFollowToggle error in UI** - UserListScreen doesn't show follow error to user.
5. **Production prep** - Move API key to env vars
6. **Launch prep** - App Store assets, privacy policy

### Deferred Items
- Bug 8: `dismissed_movies` cloud sync - needs new Supabase table
- Bug 10: Conflict resolution uses `lastSyncedAt` instead of local `updated_at`
- `markSeasonWatched` sequential transactions - wraps 20+ individual transactions, should be one
- Schema: `tmdb_id` PK vs UNIQUE INDEX contradiction in `tracked_shows`

## Pre-Launch Roadmap

### Before Launch
| # | Task | Status |
|---|------|--------|
| 1 | Fix 4 critical bugs | DONE |
| 2 | Test all fixes | DONE |
| 3 | Fix review feedback (3 issues) | DONE |
| 4 | Sync engine hardening (5 review rounds) | DONE |
| 5 | Tech debt pass | DONE |
| 6 | Fix review feedback (nested transactions) | **NEXT** |
| 7 | Production prep (API key to env) | PENDING |
| 8 | Launch prep (app store assets) | PENDING |

### Fast Follow (v1.1)
| # | Feature | Complexity |
|---|---------|------------|
| 1 | **Widgets** | Medium |
| 2 | **Watch stats** | Medium |

### Completed Features
- **Core** - Search, tracking, episodes, sync engine
- **Auth** - Signup, signin (email or username)
- **Social** - Follow system, activity feed, friend ratings
- **Ratings** - 5-star system with half-star toggle, episode reactions
- **Recommendations** - Trending + personalized with dismiss feature
- **Profile** - Edit username, display name, bio
- **Movies** - Full tracking with search, status, ratings
- **Rewatch Tracking** - Full watch history with editable timestamps
- **Share Profile** - Deep links, privacy controls, profile stats
- **Data Export** - JSON export with profile, follows, ratings, warnings
- **Settings** - About, Sync Settings, Notifications screens

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly (zero errors)

## Commits This Session
```
a1edc53 Fix tech debt: race conditions, error UI, unused code, screen merge
```

## Known Issues
- API key hardcoded (move to env vars before production)
- Nested `withTransactionAsync` may fail at runtime (critical, fix first next session)
- See `TECH_DEBT.md` for full technical debt tracking
