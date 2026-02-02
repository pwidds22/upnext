# UpNext - Session State
Updated: 2026-02-02 | Branch: master

## Status: All High-Priority Tech Debt Fixed

### Completed This Session
- **Fixed 3 Critical + 9 High-Priority Tech Debt Issues:**

  **Critical:**
  - `useEpisodeReactions.ts` - Removed conditional hook call (useSync inside try/catch)
  - `useEpisodeReactions.ts` - Fixed stale closure (sync/isOnline now from hook result)
  - `storage.ts` - Refactored setReaction() from ON CONFLICT to check-then-insert

  **Service Layer:**
  - `storage.ts` - Fixed 4 more INSERT OR REPLACE usages (check-then-insert)
  - Created `useProfileLookup` hook for SignInScreen
  - Created `useUsernameCheck` hook for SignUpScreen

  **Code Duplication:**
  - Extracted username validation to `src/utils/validation.ts`
  - Created `useFollowToggle` hook (FollowersScreen, FollowingScreen, UserSearchScreen)
  - Created `MediaCard` component (unified ShowCard + MovieCard)
  - Created `useMediaRecommendations` generic hook

  **Safety:**
  - `ActivityItem.tsx` - Fixed unsafe `activity.rating!` assertion
  - `UserRow.tsx` - Fixed unsafe `displayName[0]` access

### Previous Session Work
- **Share Profile feature implemented** - Full implementation as per spec:
  - Added `visibility_shows`, `visibility_activity`, `visibility_stats` columns to profiles table
  - Created `ProfileVisibilitySheet` component for privacy settings
  - Created `ProfileStats` component for showing total shows/movies/episodes
  - Created `useProfileVisibility` hook
  - Added share button and privacy button to ProfileScreen
  - Added deep linking support with `upnext://profile/username` URL scheme
  - Updated UserProfileScreen for visibility-aware rendering and username lookup

- **Claude Web review feedback fixed:**
  - Fixed race condition: wait for profile to load before checking visibility
  - Fixed own profile via deep link: always show full content regardless of visibility settings
  - Added visibility check to ratings loading (respects shows visibility)
  - Added user feedback Alert when share fails
  - Handle empty/whitespace usernames in deep link parsing

### Key Files Changed (This Session)
- `src/services/storage.ts` - 5 methods refactored to check-then-insert pattern
- `src/hooks/useSync.ts` - Uses `useSyncOptional`, returns undefined if no provider
- `src/hooks/useEpisodeReactions.ts` - Removed try/catch, uses optional chaining
- `src/hooks/useFollowToggle.ts` - NEW: Follow/unfollow logic with haptics
- `src/hooks/useUsernameCheck.ts` - NEW: Username availability checking
- `src/hooks/useProfileLookup.ts` - NEW: Profile lookup by username
- `src/hooks/useMediaRecommendations.ts` - NEW: Generic recommendations hook
- `src/hooks/useRecommendations.ts` - Simplified, uses generic hook
- `src/hooks/useMovieRecommendations.ts` - Simplified, uses generic hook
- `src/components/MediaCard.tsx` - NEW: Unified card component
- `src/components/ShowCard.tsx` - Simplified wrapper around MediaCard
- `src/components/MovieCard.tsx` - Simplified wrapper around MediaCard
- `src/components/ActivityItem.tsx` - Fixed unsafe assertion
- `src/components/UserRow.tsx` - Fixed unsafe string access
- `src/utils/validation.ts` - NEW: Username validation utilities
- `src/screens/auth/SignInScreen.tsx` - Uses useProfileLookup hook
- `src/screens/auth/SignUpScreen.tsx` - Uses useUsernameCheck hook, validation utils
- `src/screens/ProfileScreen.tsx` - Uses validation utils
- `src/screens/FollowersScreen.tsx` - Uses useFollowToggle hook
- `src/screens/FollowingScreen.tsx` - Uses useFollowToggle hook
- `src/screens/UserSearchScreen.tsx` - Uses useFollowToggle hook

### Key Files Changed (Previous Session)
- `supabase/migrations/015_add_profile_visibility.sql` - Applied via MCP
- `src/types/index.ts` - Added ProfileVisibility, ProfileStats types
- `src/services/supabase/follows.ts` - Added visibility methods, getUserStats, updated queries
- `src/components/ProfileVisibilitySheet.tsx` - New privacy settings sheet
- `src/components/ProfileStats.tsx` - New stats display component
- `src/hooks/useProfileVisibility.ts` - New hook for visibility management
- `src/navigation/linking.ts` - New deep link configuration
- `src/navigation/AppNavigator.tsx` - Integrated deep linking
- `src/screens/ProfileScreen.tsx` - Added share + privacy buttons
- `src/screens/UserProfileScreen.tsx` - Visibility-aware rendering, username lookup
- `app.json` - Added `scheme: "upnext"`

### New Dependencies Added
- `expo-linking` - For deep link URL handling

### Previous Session Work
- Rewatch tracking complete and reviewed
- Delete sync issues fixed

### Commits This Session
- `0cf5be1` Add share profile feature with deep links and privacy controls
- `7101683` Fix share profile review feedback: visibility and error handling

### Completed Features
- **Core** - Search, tracking, episodes, sync engine
- **Auth** - Signup, signin (email or username)
- **Social** - Follow system, activity feed, friend ratings
- **Ratings** - 5-star system with half-star toggle, episode reactions
- **Recommendations** - Trending + personalized with dismiss feature
- **Profile** - Edit username, display name, bio
- **Movies** - Full tracking with search, status, ratings
- **Rewatch Tracking** - Full watch history for episodes and movies
- **Share Profile** - Deep links, privacy controls, profile stats

## Pre-Launch Roadmap

### Before Launch (Priority Order)
| # | Feature | Complexity | Status |
|---|---------|------------|--------|
| 1 | ~~Movie tracking~~ | Medium-High | DONE |
| 2 | ~~Rewatch tracking~~ | Medium | DONE |
| 3 | ~~Share profile~~ | Low | DONE |
| 4 | **Data export** | Low | Not started |

### Fast Follow (v1.1)
| # | Feature | Complexity |
|---|---------|------------|
| 5 | **Widgets** | Medium |
| 6 | **Watch stats** | Medium |

## Next Steps
1. **Test share profile on device** - Verify deep links and visibility controls work
2. **Data export** - Last feature before launch
3. **High priority tech debt** - See `TECH_DEBT.md` (critical issues fixed, 9 high priority remain)

## Build Info
- Expo SDK 54 | React Native 0.81
- Supabase backend
- TypeScript compiles cleanly

## Known Issues
- API key hardcoded (move to env vars before production)
- See `TECH_DEBT.md` for full technical debt tracking
