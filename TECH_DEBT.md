# Technical Debt Tracker

Last scanned: 2026-02-02

## How to Use
- Run `/techdebt` periodically to rescan and update this file
- Check items off as they're fixed
- Add new debt as discovered during development

---

## Critical (Fix Before Launch)

- [x] **Conditional Hook Call** - `useEpisodeReactions.ts:14-20` - FIXED: Now uses `useSyncOptional` unconditionally
- [x] **Stale Closure** - `useEpisodeReactions.ts:41-45` - FIXED: `sync` and `isOnline` now derived from hook result
- [x] **ON CONFLICT Anti-Pattern** - `storage.ts:757-761` - FIXED: Now uses check-then-insert pattern

---

## High Priority (Fix Soon)

### Service Layer Issues
- [x] **INSERT OR REPLACE Usage** - FIXED: All 4 uses converted to check-then-insert pattern

### Screen Anti-Patterns
- [x] **Direct Service Calls** - FIXED: Created `useProfileLookup` hook for SignInScreen
- [x] **Direct Service Calls** - FIXED: Created `useUsernameCheck` hook for SignUpScreen
- [ ] **Direct TMDB Calls** - `SearchScreen.tsx:96-100` - Calls `tmdbService.searchShows()` directly in component

### Code Duplication
- [x] **Username Validation** - FIXED: Extracted to `src/utils/validation.ts`
- [x] **Follow Toggle Logic** - FIXED: Created `useFollowToggle` hook, updated 3 screens
- [x] **ShowCard/MovieCard** - FIXED: Created `MediaCard` component, simplified both cards
- [x] **Recommendation Hooks** - FIXED: Created `useMediaRecommendations` generic hook

### Safety Issues
- [x] **Unsafe Non-Null Assertion** - FIXED: Changed to `activity.rating ?? 0`
- [x] **Unsafe String Access** - FIXED: Changed to `displayName.charAt(0) || 'U'`

### Hook Issues (Newly Found)
- [ ] **Missing useCallback Dependency** - `useFollows.ts:42` - `toggleFollow` depends on `isFollowing` but not in deps
- [ ] **Circular useEffect Dependency** - `useActivityFeed.ts:60` - `loadMore` includes `activities` in deps
- [ ] **Missing Error State** - `useMovieWatchHistory.ts` - No `error` state returned unlike similar hooks

---

## Medium Priority (Fix When Convenient)

### Type Safety
- [ ] **`any` Type Usage** - `activity.ts:296,349,423,475,598,601` - 6 uses for row casting
- [ ] **`any` Type Usage** - `follows.ts:171,202,324,356` - 4 uses for profile data
- [ ] **Loose Type Assertions** - `activity.ts:78,304,369,427,483,605` - Multiple `as any[]` and `as ProfileRow` casts

### Missing Error UI
- [ ] **WatchHistorySheet.tsx** - Errors caught but no user feedback (4 catch blocks)
- [ ] **ProfileVisibilitySheet.tsx** - Errors caught but no user feedback
- [ ] **ActivityItem.tsx:132-140** - Fetches user activity, console.error only

### Component Structure
- [ ] **Large Component** - `ProfileScreen.tsx` is 1,065 lines - extract EditProfileModal
- [ ] **Large Component** - `ShowDetailScreen.tsx` is 1,134 lines - extract sections
- [ ] **Large Component** - `SearchScreen.tsx` is 1,033 lines - extract modal content
- [x] **Hardcoded Colors** - FIXED: ShowCard/MovieCard now use MediaCard which uses COLORS constants

### Hardcoded Colors (Components)
- [ ] **EpisodeRow.tsx:254,259** - `'#fff'` and `rgba(0,0,0,0.5)` should use constants
- [ ] **MediaCard.tsx:41,50,71** - `rgba` and `#FFD700` should use constants
- [ ] **ActivityItem.tsx:44,46,48,50** - `#34C759`, `#9B59B6`, `#FFD700`, `#FF3B30` need constants

### Hook Issues
- [x] **Missing Cleanup** - FIXED: Added debounceTimerRef in ProfileScreen and SignUpScreen
- [ ] **Duplicated Sync Pattern** - `useShowData.ts:46`, `useEpisodeReactions.ts:36` - `sync?.catch(console.error)` repeated

### Cleanup
- [ ] **Console Statements** - 30+ console.error/console.warn calls across codebase:
  - Services: `activity.ts:317,495`, `auth.ts:44`, `follows.ts:73`
  - Hooks: `useFollows.ts` (6), `useActivityFeed.ts` (3), `useShowData.ts` (3), etc.
  - Components: `WatchHistorySheet.tsx` (4), `ActivityItem.tsx:137`, `ProfileVisibilitySheet.tsx:91`

---

## Low Priority (Nice to Have)

### Duplication
- [ ] **Show/Movie Methods** - `storage.ts`, `shows.ts`, `ratings.ts` - extensive duplication
- [ ] **Genre Extraction** - `useRecommendations.ts:8-29` and `useMovieRecommendations.ts:8-29` nearly identical
- [ ] **Profile Row Mapping** - `activity.ts` has 3 identical profile mapping patterns
- [ ] **Avatar Placeholder** - Same pattern in `UserRow.tsx`, `ActivityItem.tsx`, `FriendsWatchingCard.tsx`

### Accessibility
- [ ] **Missing Labels** - All components lack `accessibilityLabel` on interactive elements

### Code Quality
- [ ] **Inconsistent Loading State Names** - `addingShow` vs `ratingLoading` vs `isLoading`
- [ ] **Missing Return Type Annotations** - Multiple hooks should have explicit return types
- [ ] **Type Organization** - `types/index.ts` is 533 lines without section comments
- [ ] **State Consolidation** - `SearchScreen.tsx:37-57` has 12 useState hooks

### Performance
- [ ] **Missing Memoization** - `ActivityItem.tsx:23-93` helper functions recreated every render
- [ ] **Inline Object Creation** - `ActivityItem.tsx:44-50` creates new objects on each call

---

## Patterns to Add to CLAUDE.md Anti-Patterns

When fixing these, add these patterns to CLAUDE.md:

1. **Don't call hooks conditionally** - wrap in try/catch seen in useEpisodeReactions.ts
2. **Don't duplicate show/movie methods** - extract to generic `media` methods with type parameter
3. **Don't use `any` for Supabase row data** - create proper row types
4. **Don't call services directly from auth screens** - create dedicated hooks
5. **Don't use hardcoded hex colors** - add to COLORS constants first
6. **Don't console.error without user feedback** - show toast/alert or set error state

---

## Session Notes

### 2026-02-02 (Full Tech Debt Pass)
- Fixed all 3 critical issues + all 9 high-priority issues:
  - **Critical fixes:** useEpisodeReactions hooks, storage.ts setReaction
  - **INSERT OR REPLACE:** Fixed 4 more locations in storage.ts
  - **Service hooks:** Created useProfileLookup, useUsernameCheck
  - **Validation:** Extracted to src/utils/validation.ts
  - **Follow toggle:** Created useFollowToggle hook, updated 3 screens
  - **MediaCard:** Unified ShowCard/MovieCard
  - **Recommendations:** Created useMediaRecommendations generic hook
  - **Safety:** Fixed unsafe assertions in ActivityItem, UserRow
- Fixed debounce cleanup bugs found in Claude Web review (2 rounds)
- Ran `/techdebt` scan - found new hook dependency issues, more hardcoded colors

### 2026-02-02
- Initial scan completed
- Share profile feature done, all review feedback fixed
- Next feature: Data export (last before launch)
