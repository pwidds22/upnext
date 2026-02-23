# Technical Debt Tracker

Last scanned: 2026-02-23

## Session Notes (2026-02-23)
- **Import system removed** — All import screens, services, parsers, TMDB resolver deleted
- **Subscription/paywall system removed** — RevenueCat, PaywallScreen, SubscriptionContext, LockedSection deleted
- **All features now free** — Stats unlocked, data export ungated, no premium tiers

## How to Use
- Run `/techdebt` periodically to rescan and update this file
- Check items off as they're fixed
- Add new debt as discovered during development

---

## Critical (Fix Before Launch)

### Sync Engine Data Gaps
- [x] **Initial sync missing movies** - FIXED: `initialSync()` now syncs movies with conflict resolution
- [x] **Initial sync missing reactions/dismissed/history** - FIXED: Steps 6-9 added for reactions, dismissals, watch history
- [x] **Incremental pull missing data types** - FIXED: `pullChanges` now handles all data types
- [x] **Movie sync uses wrong converter** - FIXED: `processSyncQueueItem` checks `mediaType` and uses correct converter
- [x] **Upsert conflict key missing media_type** - FIXED: `onConflict: 'user_id,tmdb_id,media_type'` + Supabase migration
- [x] **markSeasonUnwatched missing sync** - FIXED: Queries episodes and queues deletions before bulk DELETE
- [x] **Remote-winning conflicts dropped** - FIXED: initialSync now applies remote-winning data locally
- [x] **Movie sync queue ID mismatch** - FIXED: pullChanges uses `movie-${tmdbId}` format matching storage.ts
- [x] **Pulled movies not marked synced** - FIXED: updateShowSyncStatus called for pulled movies + movies in step 10
- [x] **getShowRemoteId missing media_type** - FIXED: Added media_type parameter to prevent .single() errors
- [x] **triggerFullSync missing isOnline check** - FIXED: Now checks isOnline before syncing

### SyncContext Bugs
- [x] **Missing useEffect dependency** - FIXED: `triggerSync` added to dependency array
- [x] **Missing useEffect dependency** - FIXED: `triggerFullSync` added to dependency array
- [x] **NetInfo re-subscription** - FIXED: Subscribes once with empty dependency array, uses ref for isOnline

### Previously Fixed
- [x] **Conditional Hook Call** - `useEpisodeReactions.ts` - FIXED: Uses `useSyncOptional` unconditionally
- [x] **Stale Closure** - `useEpisodeReactions.ts` - FIXED: sync/isOnline derived from hook result
- [x] **ON CONFLICT Anti-Pattern** - `storage.ts` - FIXED: Uses check-then-insert pattern

---

## High Priority (Fix Soon)

### Service Layer
- [x] **INSERT OR REPLACE Usage** - FIXED: All 4 uses converted to check-then-insert
- [x] **softDeleteShow missing media_type filter** - FIXED: Added `.eq('media_type', 'tv')` filter
- [x] **updateShowStatus missing media_type filter** - FIXED: Added `.eq('media_type', 'tv')` filter
- [x] **Unsafe JSON.parse in sync** - FIXED: Wrapped in try-catch, skips malformed items
- [x] **N+1 query in getAllLocalEpisodes** - FIXED: Uses `storageService.getAllWatchedEpisodes()` single query
- [x] **Inefficient removeFromQueueIfExists** - FIXED: Uses direct SQL DELETE via `removeSyncQueueItemByKey`

### Screen Anti-Patterns (Direct Service Calls)
- [x] **Direct Service Calls** - FIXED: Created `useProfileLookup` hook
- [x] **Direct Service Calls** - FIXED: Created `useUsernameCheck` hook
- [ ] **UserProfileScreen** - 5+ direct `followsService` calls - needs `useUserProfile` hook
- [ ] **MovieDetailScreen** - 3 direct `ratingsService`/`followsService` calls
- [ ] **ProfileScreen** - 6 direct `followsService`/`ratingsService` calls
- [ ] **SearchScreen** - 3 direct TMDB calls + 2 direct ratings calls
- [ ] **UpNextScreen** - Direct `tmdbService.getSeason()` call
- [ ] **ActivityItem component** - Direct `activityService` call from component

### Race Conditions (Transactions)
- [x] **markEpisodeWatched** - FIXED: Wrapped in `withTransactionAsync`
- [x] **setReaction** - FIXED: Wrapped in `withTransactionAsync`
- [x] **addToSyncQueue** - FIXED: Wrapped in `withTransactionAsync`
- [x] **dismissShow/dismissMovie** - FIXED: Wrapped in `withTransactionAsync`
- [ ] **CRITICAL: Nested withTransactionAsync** - `markEpisodeWatched`, `setReaction`, `dismissShow`, `dismissMovie` all wrap in transaction then call `addToSyncQueue` which ALSO wraps in transaction. expo-sqlite may not support nested transactions (no savepoint). **Fix**: Extract `addToSyncQueue` inner logic into `_addToSyncQueueRaw()` that outer transactions call directly, keep `addToSyncQueue` wrapper for standalone callers.
- [ ] **markSeasonWatched sequential transactions** - `storage.ts:554-563` - Calls `markEpisodeWatched` in a loop, each opening its own transaction. For 20+ episodes, should wrap entire season in one transaction.

### Code Duplication
- [x] **Username Validation** - FIXED: Extracted to `src/utils/validation.ts`
- [x] **Follow Toggle Logic** - FIXED: Created `useFollowToggle` hook
- [x] **ShowCard/MovieCard** - FIXED: Created `MediaCard` component
- [x] **Recommendation Hooks** - FIXED: Created `useMediaRecommendations` generic hook
- [x] **FollowersScreen/FollowingScreen** - FIXED: Merged into `UserListScreen.tsx`

### Safety
- [x] **Unsafe Non-Null Assertion** - FIXED
- [x] **Unsafe String Access** - FIXED
- [x] **Unsafe error cast in SyncContext** - FIXED: Uses `error instanceof Error ? error.message : 'Sync failed'`

### Hook Issues
- [ ] **Missing useCallback Dependency** - `useFollows.ts:42` - `toggleFollow` depends on `isFollowing` but not in deps
- [ ] **Circular useEffect Dependency** - `useActivityFeed.ts:60` - `loadMore` includes `activities` in deps
- [x] **Missing Error State** - FIXED: `useFollowToggle` and `useEpisodeReactions` now expose `error`
- [ ] **useFollowToggle error not consumed** - `UserListScreen.tsx` doesn't destructure or display the `error` from useFollowToggle

### Non-functional UI
- [x] **Auto-sync toggle** - FIXED: Removed non-functional toggle from SyncSettingsScreen
- [x] **"See All" button** - FIXED: Removed non-functional button from ProfileScreen

---

## Medium Priority (Fix When Convenient)

### Type Safety
- [ ] **`any` Type Usage** - `activity.ts:78,296,304,349,369,423,475,598,601` - 9 uses
- [ ] **`any` Type Usage** - `follows.ts:171,202,324,356` - 4 uses
- [ ] **`as any` cast** - `SyncSettingsScreen.tsx:131` - Icon name cast
- [ ] **Duplicate `RatingWithShowInfo`** - Defined differently in ProfileScreen and UserProfileScreen
- [ ] **`UserShowRow.status` allows invalid combos** - Union of ShowStatus|MovieStatus without discrimination
- [ ] **Types in wrong files** - `RatingType`, `UserRatingRow` in ratings.ts; `UserPublicShow` in follows.ts

### Duplicated Code (Services)
- [ ] **Row type + mapper boilerplate** - `storage.ts` - 8+ identical row-to-object mappings
- [ ] **Dismissed shows/movies methods** - `storage.ts` - Near-identical, differ only by table name
- [ ] **Episode/movie watch history** - `storage.ts` - 9 pairs of identical methods
- [ ] **profileFromRow duplicated** - `activity.ts:15` and `follows.ts:25` - Different shapes, should be unified
- [ ] **Rating methods** - `ratings.ts` - 4 rate* methods follow identical upsert pattern
- [ ] **Average rating methods** - `ratings.ts` - show/movie versions identical except filter
- [ ] **rowToTrackedShow duplicated** - `sync.ts:481` vs `shows.ts:47` - same field mapping
- [ ] **TMDB paginated fetch** - `tmdb.ts` - 8 functions share same loop pattern
- [ ] **triggerSyncIfOnline** - Duplicated in 4 hooks, extract to `useTriggerSync()`

### Duplicated Code (UI)
- [ ] **Rating section** - ShowDetailScreen and MovieDetailScreen - near-identical rating UI
- [ ] **Streaming providers** - ShowDetailScreen and MovieDetailScreen - same "Where to Watch" section
- [ ] **Avatar placeholder** - 3 components implement same circle-with-initial pattern differently
- [ ] **Modal header** - ProfileVisibilitySheet and WatchHistorySheet - identical header structure
- [ ] **Empty state** - 7 screens implement same centered icon+text pattern independently

### Missing Error UI
- [x] **WatchHistorySheet.tsx** - FIXED: Added Alert.alert in 4 catch blocks
- [x] **ProfileVisibilitySheet.tsx** - FIXED: Added Alert.alert on save failure
- [ ] **ActivityItem.tsx:132-140** - Fetches user activity, console.error only
- [x] **UpNextScreen** - FIXED: Added error state + retry button (but error view lacks pull-to-refresh)
- [x] **MyShowsScreen** - FIXED: Added error state + retry button (but error view lacks pull-to-refresh)
- [ ] **MovieDetailScreen** - Optimistic status update with no rollback on failure
- [ ] **ShowDetailScreen** - Same optimistic update issue
- [ ] **UpNextScreen** - `handleMarkWatched` optimistic with no rollback

### Component Structure
- [ ] **ProfileScreen** - 1,122 lines, extract EditProfileModal
- [ ] **ShowDetailScreen** - Extract rating section, providers, about section
- [ ] **SearchScreen** - 1,034 lines, extract AddShowModal and AddMovieModal
- [ ] **Missing React.memo** - No components use React.memo (EpisodeRow, ShowCard, MovieCard, etc.)
- [ ] **Missing useCallback** - EpisodeRow, ActivityItem, FriendsWatchingCard handlers recreated every render
- [ ] **Inline ItemSeparatorComponent** - `UserListScreen.tsx:119` - Creates new component ref every render, extract to const

### Inline Styles
- [ ] **MyShowsScreen:416** - `{{ flex: 1 }}`
- [ ] **UserProfileScreen:412,458** - `{{ padding: 20 }}`
- [ ] **ProfileScreen:506,641** - `{{ marginVertical: 8 }}`, `{{ padding: 20 }}`
- [ ] **SearchScreen:585,694** - `{{ width: 60 }}`
- [ ] **ProfileVisibilitySheet:119, WatchHistorySheet:190** - `{{ width: 40 }}`
- [ ] **EpisodeRow:151** - `{ color: COLORS.error }`
- [ ] **ShowPoster:40** - Dynamic dimensions inline

### Hardcoded Colors
- [ ] **EpisodeRow.tsx:254,259** - `'#fff'` and `rgba(0,0,0,0.5)`
- [ ] **MediaCard.tsx:41,50,71** - `rgba` and `#FFD700`
- [ ] **ActivityItem.tsx:44-50** - `#34C759`, `#9B59B6`, `#FFD700`, `#FF3B30`
- [ ] **REACTION_CONFIG in types/index.ts** - Hardcoded colors, should use COLORS constants

### Cleanup
- [ ] **30+ console.error/console.warn** - Replace with proper logging for production
- [ ] **Stale comment in sync.ts:320** - Already removed (was about INSERT OR REPLACE)
- [x] **Unused imports** - FIXED: Removed FlatList/MediaType/TMDBEpisode/formatEpisodeCode/EpisodeReaction
- [ ] **Dead code** - SignUpScreen success state (never set), EpisodeReactionPicker default emoji size (always overridden), empty provider logo in ShowDetailScreen
- [x] **Silent partial export** - FIXED: Added warnings array to ExportData, fixed displayName bug
- [ ] **UserListScreen double hook call** - Both `useFollowersList` and `useFollowingList` fire on mount regardless of mode. Add `enabled` param to skip unused fetch.
- [ ] **Error state not pull-to-refreshable** - UpNextScreen and MyShowsScreen error views render outside FlatList/SectionList, so pull-to-refresh gesture doesn't work in error state. Wrap error in ScrollView+RefreshControl.
- [ ] **Schema: tmdb_id PK vs UNIQUE INDEX contradiction** - `tracked_shows` has `tmdb_id INTEGER PRIMARY KEY` but also `UNIQUE INDEX on (tmdb_id, media_type)` — PK already prevents duplicate tmdb_ids regardless of media_type, making the index misleading
- [ ] **formatRating/starsToValue/valueToStars** - Utility functions exported from StarRating.tsx component file, should be in utils/

---

## Low Priority (Nice to Have)

### Accessibility
- [ ] **Missing accessibilityLabel** - All interactive elements across all screens and components
- [ ] **Missing accessibilityRole** - No roles on buttons, inputs, or toggles
- [ ] **Missing accessibilityLabel on TextInputs** - Across SearchScreen, auth screens, ProfileScreen

### Code Quality
- [ ] **Inconsistent loading state names** - `addingShow` vs `ratingLoading` vs `isLoading`
- [ ] **Missing return type annotations** - Multiple hooks lack explicit return types
- [ ] **Type organization** - `types/index.ts` is 533+ lines without section comments
- [ ] **State consolidation** - `SearchScreen.tsx` has 12+ useState hooks
- [ ] **ExportFormat single-value union** - `types/index.ts:538` - only `'json'`, no value
- [ ] **Misleading comments** - "returns null" but `useSyncOptional` returns `undefined`
- [ ] **Duplicate follow-toggle logic** - `useFollowToggle.ts` and `useFollows.ts:toggleFollow` both exist
- [ ] **FlatList misuse in UpNextScreen** - Empty data + ListHeaderComponent, should be ScrollView
- [ ] **Stale findNextEpisode closure** - `UpNextScreen.tsx` - Not memoized but called from memoized callback

---

## Session Notes

### 2026-02-03 (Claude Web Review Round 2 - Sync Engine)
- Claude Web found 7 bugs (3 critical, 4 significant) in the sync engine fixes
- Fixed all 11 issues from review:
  - Bug 1: Remote-winning conflicts now applied to local data
  - Bug 2+11: Movie sync queue IDs use correct `movie-${tmdbId}` format
  - Bug 3: Pulled movies/reactions/dismissals/history cleaned from sync queue
  - Bug 4: triggerFullSync now checks isOnline
  - Bug 5: updateShowSyncStatus documented (PK prevents media_type collision)
  - Bug 6: getShowRemoteId now filters by media_type
  - Bug 7: Pulled movies now marked as synced + included in step 10
  - Bug 9: Null local_id in watch history deletion now warns
- Deferred: Bug 8 (dismissed_movies cloud sync - needs new Supabase table), Bug 10 (conflict resolution timestamps)

### 2026-02-03 (Full Rescan - Pre-Launch Audit)
- Fixed 3 review feedback issues (re-dismiss, expiry consistency, partial fetch)
- Fixed 9 critical sync engine bugs (movies, reactions, dismissals, watch history, SyncContext)
- Full 4-agent tech debt scan across services, screens, components, hooks
- Build config check: EAS Build ready, 70% App Store ready (missing privacy policy, screenshots, metadata)

### 2026-02-02 (Full Tech Debt Pass)
- Fixed all 3 critical issues + all 9 high-priority issues
- Fixed debounce cleanup bugs found in Claude Web review (2 rounds)
- Created useProfileLookup, useUsernameCheck, useFollowToggle, MediaCard, useMediaRecommendations
- Extracted validation utilities

### 2026-02-02
- Initial scan completed
- Share profile feature done, all review feedback fixed
