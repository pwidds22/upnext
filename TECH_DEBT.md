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
- [ ] **INSERT OR REPLACE Usage** - `storage.ts:464,559,845,900` - 4 uses instead of check-then-insert

### Screen Anti-Patterns
- [ ] **Direct Service Calls** - `SignInScreen.tsx:47-62` - Calls `followsService` directly, should use hook
- [ ] **Direct Service Calls** - `SignUpScreen.tsx:66,125` - Calls `followsService.isUsernameAvailable()` directly

### Code Duplication
- [ ] **Username Validation** - Duplicated in SignUpScreen.tsx, ProfileScreen.tsx (2x) - extract to utils
- [ ] **Follow Toggle Logic** - Duplicated in FollowersScreen, FollowingScreen, UserSearchScreen - create `useFollowToggle()` hook
- [ ] **ShowCard/MovieCard** - 85% identical - create single `MediaCard` component
- [ ] **Recommendation Hooks** - `useRecommendations.ts` and `useMovieRecommendations.ts` are nearly identical 150-line hooks

### Safety Issues
- [ ] **Unsafe Non-Null Assertion** - `ActivityItem.tsx:77` - `activity.rating!` without validation
- [ ] **Unsafe String Access** - `UserRow.tsx:27` - `displayName[0]` without length check

---

## Medium Priority (Fix When Convenient)

### Type Safety
- [ ] **`any` Type Usage** - `activity.ts:296,349,423,475,598,601` - 6 uses for row casting
- [ ] **`any` Type Usage** - `follows.ts:171,202,324,356` - 4 uses for profile data

### Missing Error UI
- [ ] **WatchHistorySheet.tsx** - Errors caught but no user feedback
- [ ] **ProfileVisibilitySheet.tsx** - Errors caught but no user feedback

### Component Structure
- [ ] **Large Component** - `ProfileScreen.tsx` is 1073 lines - extract EditProfileModal to separate file
- [ ] **Hardcoded Colors** - `MovieCard.tsx:29`, `ShowCard.tsx:29` - should use COLORS constants

### Hook Issues
- [ ] **Missing Cleanup** - `ProfileScreen.tsx:135-137`, `SignUpScreen.tsx:85-86` - debounce timeout cleanup inside conditional
- [ ] **Missing Dependency** - `useActivityFeed.ts:60` - `loadMore` depends on `activities` state

### Cleanup
- [ ] **Console Statements** - 34+ console.error/console.log calls across codebase - should use proper error tracking

---

## Low Priority (Nice to Have)

### Duplication
- [ ] **Show/Movie Methods** - `storage.ts`, `shows.ts`, `ratings.ts` - extensive duplication between show/movie methods

### Accessibility
- [ ] **Missing Labels** - All components lack `accessibilityLabel` on interactive elements

### Code Quality
- [ ] **Inconsistent Loading State Names** - `addingShow` vs `ratingLoading` vs `isLoading` across screens
- [ ] **Missing Return Type Annotations** - Multiple hooks should have explicit return types
- [ ] **Type Organization** - `types/index.ts` is 533 lines without section comments

---

## Patterns to Add to CLAUDE.md Anti-Patterns

When fixing these, add these patterns to CLAUDE.md:

1. **Don't call hooks conditionally** - wrap in try/catch seen in useEpisodeReactions.ts
2. **Don't duplicate show/movie methods** - extract to generic `media` methods with type parameter
3. **Don't use `any` for Supabase row data** - create proper row types
4. **Don't call services directly from auth screens** - create dedicated hooks

---

## Session Notes

### 2026-02-02 (Continued)
- Fixed all 3 critical issues:
  - `useEpisodeReactions.ts` - removed conditional hook call, now uses `useSyncOptional`
  - `useEpisodeReactions.ts` - fixed stale closure by deriving values from hook result
  - `storage.ts` - refactored `setReaction()` to check-then-insert pattern

### 2026-02-02
- Initial scan completed
- Share profile feature done, all review feedback fixed
- Next feature: Data export (last before launch)
