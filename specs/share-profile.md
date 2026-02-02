# Share Profile Specification

## Summary
Allow users to share their UpNext profile with others via a deep link (`upnext://profile/username`). Recipients must have the app installed and be registered users to view the profile. Users can configure granular visibility settings to control what sections of their profile (tracked shows, activity feed, stats) are visible to others. The shared profile uses the existing profile screen with visibility-aware rendering.

## Requirements

### Core Functionality
- Generate shareable deep link: `upnext://profile/username`
- Share button on user's own profile screen triggers native share sheet
- Auto-generated share text: "Check out my TV tracking profile on UpNext! upnext://profile/username"
- Deep link opens the target user's profile in-app
- Requires app installed + user logged in to view

### Visibility Controls
- Gear icon on profile screen opens visibility settings modal/sheet
- Three toggleable sections:
  - **Tracked shows** - Shows/movies with their status (Watching, Completed, etc.)
  - **Activity feed** - Recent watch activity (last 10 items, expandable to 30+ days)
  - **Stats summary** - Total shows, total movies, episodes watched
- Settings stored in Supabase `profiles` table and synced across devices
- Hidden sections hidden from ALL viewers (including existing followers)
- Default: all sections visible

### Profile Viewing
- Uses existing profile view screen
- Shows Follow button if viewer isn't already following
- Sections render based on target user's visibility settings
- Activity feed: initial 10 items, "See more" loads up to 30+ days, grouped by day/batch

### Stats Computation
- Real-time calculation when profile is viewed
- Basic counts only:
  - Total tracked shows
  - Total tracked movies
  - Total episodes marked watched

### Error Handling
- Profile not found: "Profile not found" message with back button
- No app installed: Redirect to App Store / Play Store
- Not logged in: Prompt to sign in before viewing
- Username changes break old links (accepted limitation)

## Data Model

### Profiles Table Updates
Add visibility columns to existing `profiles` table:

```sql
ALTER TABLE profiles ADD COLUMN visibility_shows boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN visibility_activity boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN visibility_stats boolean DEFAULT true;
```

### TypeScript Types
```typescript
interface ProfileVisibility {
  shows: boolean;
  activity: boolean;
  stats: boolean;
}

interface ProfileStats {
  totalShows: number;
  totalMovies: number;
  totalEpisodes: number;
}
```

## UI Components

### New Components
1. **ProfileVisibilitySheet** - Bottom sheet with visibility toggles
   - Located: `src/components/ProfileVisibilitySheet.tsx`
   - Three toggle rows with labels and descriptions
   - Save button updates local + syncs to Supabase

2. **ProfileStats** - Stats display component
   - Located: `src/components/ProfileStats.tsx`
   - Three stat boxes (shows, movies, episodes)
   - Used on profile screen when stats are visible

### Modified Components
1. **ProfileScreen** - Add share button + gear icon
   - Share button (top right or prominent position)
   - Gear icon opens ProfileVisibilitySheet
   - Conditionally render sections based on visibility

2. **UserProfileScreen** - Visibility-aware rendering
   - Check target user's visibility settings
   - Hide sections where visibility is false
   - Show Follow button if not following

## Deep Link Handling

### URL Scheme Setup
Register `upnext://` scheme in app config:

**app.json:**
```json
{
  "expo": {
    "scheme": "upnext"
  }
}
```

### Link Parsing
- Pattern: `upnext://profile/{username}`
- Extract username from path
- Look up user by username in Supabase
- Navigate to UserProfileScreen with userId

### Fallback Handling
- iOS: Configure `LSApplicationQueriesSchemes` for store redirect
- Android: Intent filters with fallback URL
- If app not installed, redirect to respective app store

## API Calls

### Supabase
1. **Update visibility settings**
   ```typescript
   supabase.from('profiles').update({
     visibility_shows: boolean,
     visibility_activity: boolean,
     visibility_stats: boolean
   }).eq('id', userId)
   ```

2. **Fetch profile with visibility**
   ```typescript
   supabase.from('profiles').select(`
     id, username, display_name, bio, avatar_url,
     visibility_shows, visibility_activity, visibility_stats
   `).eq('username', username).single()
   ```

3. **Compute stats** (existing queries)
   - Count from `user_shows` where `user_id = ?`
   - Count from `user_movies` where `user_id = ?`
   - Count from `watched_episodes` where `user_id = ?`

### No new TMDB calls required

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Username not found | "Profile not found" error screen with back button |
| User not logged in | Redirect to sign in, then to profile |
| App not installed | Redirect to App Store / Play Store |
| Username changed | Old links break (no redirect) |
| All sections hidden | Show profile header only (name, bio, avatar) |
| Own profile shared | Share button visible, visibility icons shown |
| Blocked user views | Future consideration (not in scope) |

## Implementation Order

### Phase 1: Data Model
1. Create Supabase migration for visibility columns
2. Add ProfileVisibility type to `src/types/index.ts`
3. Add visibility fields to profile fetch/update services

### Phase 2: Visibility Settings UI
1. Create ProfileVisibilitySheet component
2. Add gear icon to ProfileScreen
3. Wire up toggle persistence (local + Supabase)

### Phase 3: Deep Link Handling
1. Configure URL scheme in app.json
2. Add deep link listener in App.tsx or navigation
3. Parse `upnext://profile/username` and navigate

### Phase 4: Share Functionality
1. Add share button to ProfileScreen
2. Implement share handler with native share sheet
3. Generate share text + deep link URL

### Phase 5: Profile Stats
1. Create ProfileStats component
2. Add stats queries to profile service
3. Integrate into profile screen (visibility-aware)

### Phase 6: Visibility-Aware Rendering
1. Update UserProfileScreen to check visibility settings
2. Conditionally render tracked shows section
3. Conditionally render activity feed section
4. Conditionally render stats section

### Phase 7: Polish
1. Add Follow button to shared profile view
2. Handle error states (not found, not logged in)
3. Test deep links on iOS and Android
4. Test app store fallback when app not installed

## Verification Checklist
- [ ] Visibility toggles persist across app restart
- [ ] Visibility settings sync to new device
- [ ] Share button generates correct deep link
- [ ] Deep link opens correct profile in app
- [ ] Hidden sections not visible to other users
- [ ] Hidden sections not visible to followers
- [ ] Stats compute correctly in real-time
- [ ] Activity feed shows grouped items
- [ ] Activity feed "see more" loads additional history
- [ ] Follow button works from shared profile
- [ ] "Profile not found" shows for invalid username
- [ ] App store redirect works when app not installed
