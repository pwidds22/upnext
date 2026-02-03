# UpNext - Session State
Updated: 2026-02-03 | Branch: main

## Status: 4 CRITICAL BUGS - Fix Next Session

### Bugs Found During Testing (NOT FIXED YET)

1. **Recommendations show library items** - Trending, For You, and Top Rated sections show shows/movies that are already in user's library. The `trackedIds` filter isn't working.
   - Files: `src/hooks/useMediaRecommendations.ts`, `src/hooks/useRecommendations.ts`
   - Check: Is `trackedIds` being passed correctly? Is the filter logic working?

2. **Dismiss still scrolls to top** - Clicking X on any movie/show in Search page still causes page refresh and scrolls to top. The `isDismissingRef` fix didn't work.
   - Files: `src/hooks/useMediaRecommendations.ts`
   - Try: Maybe the effect still runs despite the ref check, or there's another cause of the scroll

3. **Sync still failing** - Error: `unique constraint failed: tracked_shows.tmdb_id` (error code 19, finalizeAsync failed)
   - Files: `src/services/storage.ts`
   - Root cause: The PRIMARY KEY is `tmdb_id` alone (not composite with `media_type`). Transaction-based upsert should work but maybe there's a different code path triggering the error.
   - Check: Are there other INSERT statements not using the transaction pattern?

4. **Auto-mark not working on add** - When adding a show as "Watched", episodes show 0/X and no seasons marked. The useEffect approach isn't triggering when adding a NEW show.
   - Files: `src/screens/ShowDetailScreen.tsx`
   - Root cause: Auto-mark useEffect only runs on ShowDetailScreen, but status is set BEFORE navigating there. Need to mark episodes at add time, not just on status change.

### Files Modified This Session
- `src/screens/ShowDetailScreen.tsx` - Added useRef + useEffect for auto-mark (not working for new adds)
- `src/services/storage.ts` - Transaction-based upsert (still failing), ORDER BY DESC (works)
- `src/screens/NotificationsScreen.tsx` - Title text (works)
- `src/hooks/useMediaRecommendations.ts` - isDismissingRef (not working)
- `CLAUDE.md` - Updated anti-patterns

### What Was Attempted
1. Changed `ON CONFLICT` to transaction-based upsert → still fails (different issue)
2. Added `isDismissingRef` to skip reload on dismiss → still scrolls (ref not preventing it)
3. Added useEffect for auto-mark when status='completed' → works for status CHANGE, not initial ADD

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
- **Data Export** - JSON export with profile, follows, ratings
- **Settings** - About, Sync Settings, Notifications screens

## Pre-Launch Roadmap

### Before Launch
| # | Task | Status |
|---|------|--------|
| 1 | Fix 4 critical bugs above | BLOCKED |
| 2 | Medium priority tech debt | PENDING |
| 3 | Production prep (API key to env) | PENDING |
| 4 | Launch prep (app store assets) | PENDING |

### Fast Follow (v1.1)
| # | Feature | Complexity |
|---|---------|------------|
| 1 | **Widgets** | Medium |
| 2 | **Watch stats** | Medium |

## Next Session Action Items

1. **Debug recommendations filter** - Add console.log to see if trackedIds is populated and if filter runs
2. **Debug dismiss scroll** - Check if effect runs despite ref, or if scroll comes from elsewhere
3. **Debug sync constraint** - Search for ALL INSERT statements for tracked_shows, ensure all use transaction
4. **Fix auto-mark on add** - Mark episodes when show is added with status='completed', not just on status change

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly

## Commits This Session
```
de163a5 Update CLAUDE.md: ON CONFLICT requires table constraint, not index
3a9c378 Fix ON CONFLICT error and dismiss scroll-to-top
e541c51 Fix review feedback: auto-mark edge case and timestamp swap
0164dcb Update session notes to reflect main branch
faf18ea Add error handling to auto-mark, update ON CONFLICT guidance
6548040 Fix 5 testing bugs: sync race, auto-mark, watch history order
```

## Known Issues
- API key hardcoded (move to env vars before production)
- See `TECH_DEBT.md` for full technical debt tracking
