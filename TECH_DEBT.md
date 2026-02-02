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

### Code Duplication
- [x] **Username Validation** - FIXED: Extracted to `src/utils/validation.ts`
- [x] **Follow Toggle Logic** - FIXED: Created `useFollowToggle` hook, updated 3 screens
- [x] **ShowCard/MovieCard** - FIXED: Created `MediaCard` component, simplified both cards
- [x] **Recommendation Hooks** - FIXED: Created `useMediaRecommendations` generic hook

### Safety Issues
- [x] **Unsafe Non-Null Assertion** - FIXED: Changed to `activity.rating ?? 0`
- [x] **Unsafe String Access** - FIXED: Changed to `displayName.charAt(0) || 'U'`

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
- [x] **Hardcoded Colors** - FIXED: ShowCard/MovieCard now use MediaCard which uses COLORS constants

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

### 2026-02-02
- Initial scan completed
- Share profile feature done, all review feedback fixed
- Next feature: Data export (last before launch)
