# UpNext - Claude Code Guidelines

## Project Overview
Mobile app (iOS + Android) for tracking TV shows, movies, and episodes.
- React Native 0.81 + Expo 54 + TypeScript
- SQLite (local) + Supabase (cloud sync)
- TMDB API for show/movie data

## Quick Commands
```bash
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
```

## Code Architecture

### Directory Structure
```
src/
├── components/     # Reusable UI components (ShowCard, MovieCard, etc.)
├── contexts/       # React Context providers (AuthContext, SyncContext)
├── hooks/          # Custom hooks (useTrackedShows, useSync, etc.)
├── screens/        # Full-screen features
├── services/       # Data layer
│   ├── storage.ts  # SQLite local database
│   ├── supabase/   # Cloud sync services (one file per domain)
│   └── tmdb.ts     # TMDB API client
├── types/          # TypeScript interfaces
└── utils/          # Constants, helpers
```

### Key Patterns
1. **Offline-first**: SQLite is source of truth, Supabase syncs in background
2. **Type-first**: All data shapes defined in `src/types/index.ts`
3. **Hook-based state**: Custom hooks manage loading/error/data states
4. **Service layer**: Never call APIs directly from components

## Code Conventions

### Naming
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Functions: `camelCase` (e.g., `addShow`, `updateStatus`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `TMDB_API_KEY`)
- Booleans: `is*` prefix (e.g., `isLoading`, `isOnline`)
- Event handlers: `on*` prefix (e.g., `onPress`, `onDismiss`)
- Database columns: `snake_case` (conversion happens in service layer)

### TypeScript
- Use explicit types, avoid `any`
- Separate types: `TrackedShow` (UI) vs `UserShowRow` (database)
- Union types for media: `TrackedMedia = TrackedShow | TrackedMovie`

### React Patterns
- Styles at bottom using `StyleSheet.create()`
- `useCallback` for functions passed to children
- `useMemo` for context values
- Destructure props in function signature

### Error Handling
```typescript
try {
  const data = await service.method();
  setState(data);
} catch (e) {
  setError(e instanceof Error ? e.message : 'Failed to...');
} finally {
  setLoading(false);
}
```

## Anti-Patterns (DO NOT DO THESE)

### Database
- **DON'T** use `INSERT OR REPLACE` - it deletes and re-inserts, losing data like `added_at` timestamps
- **DON'T** use `ON CONFLICT` with columns only covered by a UNIQUE INDEX - `ON CONFLICT` requires a PRIMARY KEY or UNIQUE constraint defined in `CREATE TABLE`, not a separate `CREATE UNIQUE INDEX`
- **DO** use `withTransactionAsync` for atomic check-then-insert to prevent race conditions
- **DON'T** mix camelCase in SQL columns - always use `snake_case`
- **DON'T** forget to add new tables to both SQLite AND Supabase migrations

### Components
- **DON'T** call TMDB or Supabase directly from screens - use hooks/services
- **DON'T** use inline styles - use StyleSheet.create()
- **DON'T** forget loading states - always show ActivityIndicator while fetching

### Types
- **DON'T** duplicate type definitions - extend from base types
- **DON'T** use `id` for TMDB items - use `tmdb_id` to avoid confusion with our IDs

### Git
- **DON'T** commit API keys - they should be in environment variables
- **DON'T** use vague commit messages - be specific about what changed

### Builds
- **DON'T** create an EAS build after every single fix — batch fixes together and build once
- **DO** accumulate multiple fixes/features per session, then build at the end
- **DO** check build credit usage before building (`eas build` shows remaining credits)
- EAS free tier has limited monthly build credits — treat each build as precious

### Module Initialization
- **DON'T** call SDK initializers (`createClient()`, etc.) at module top-level - they crash before React can render error UI
- **DO** use lazy initialization (Proxy pattern) for SDKs requiring configuration
- **DON'T** rely on `.env` for production - EAS Build requires EAS secrets (see `eas.json`)

## Common Tasks

### Adding a New Screen
1. Create screen in `src/screens/`
2. Add to navigation in `src/navigation/AppNavigator.tsx`
3. Add types for navigation params in `src/types/index.ts`

### Adding a New Database Table
1. Add to SQLite in `src/services/storage.ts` (`initializeDatabase`)
2. Create migration in `supabase/migrations/`
3. Add service methods in `src/services/supabase/`
4. Add types in `src/types/index.ts`

### Adding a New API Endpoint
1. Add to `src/services/tmdb.ts` or create new service
2. Create hook in `src/hooks/` for state management
3. Add types for response data

## Session Workflow
- Check `TECH_DEBT.md` for known issues to fix when convenient
- Run `/techdebt` at end of sessions to update debt tracker
- Use semantic commit messages

## Multi-Claude Feedback Loop
This project uses two Claudes working together:
- **Claude Code (VS Code/terminal)**: Does the implementation work
- **Claude Web (claude.ai/code)**: Reviews changes for bugs, edge cases, missed patterns

### Workflow
1. Claude Code implements feature and pushes
2. Run `/review` to generate a handoff summary
3. Paste handoff to Claude Web for review
4. Claude Web checks for: bugs, missing error handling, type issues, anti-pattern violations
5. Bring feedback back to Claude Code
6. **If Claude Web catches a recurring mistake**: Add it to the Anti-Patterns section above

### When to Use Review
- After completing a feature (before moving to next)
- After fixing a tricky bug (sanity check)
- Before merging to main (final review)

## Power User Workflow Tips

### Slash Commands Quick Reference
| Command | When to Use |
|---------|-------------|
| `/interview [feature]` | BEFORE coding - creates detailed spec via Q&A |
| `/plan` | After spec, to design implementation approach |
| `/fix [bug]` | Paste error/bug, Claude fixes autonomously |
| `/challenge` | After changes - Claude grills you on your code |
| `/elegant [file]` | After mediocre fix - refine to best solution |
| `/techdebt` | End of session - find duplicates and cleanup |
| `/review` | Hand off to Claude Web for external review |

### Recommended Workflow
1. **Spec first**: `/interview share-profile` → Creates `specs/share-profile.md`
2. **Plan**: Review spec, run `/plan` to design approach
3. **Implement**: Code the feature
4. **Challenge**: `/challenge` to stress-test your changes
5. **Refine**: If needed, `/elegant` to improve the solution
6. **Review**: `/review` for Claude Web external review
7. **Cleanup**: `/techdebt` at end of session

### Subagents - When to Use Them
Append "use subagents" or "use 5 subagents" to requests when:
- Exploring unfamiliar parts of the codebase
- Searching for patterns across many files
- Running multiple independent checks in parallel
- The task benefits from parallel processing

Example prompts:
- "Find all places where we handle sync errors, use subagents"
- "Check all screens for missing loading states, use 3 subagents"
- "Explore how the rating system works, use subagents"

### Prompting Patterns
**Challenge Claude:**
- "Grill me on these changes and don't approve until I pass your test"
- "Prove to me this works - diff behavior between main and this branch"

**Refine Solutions:**
- "Knowing everything you know now, scrap this and implement the elegant solution"

**Detailed Specs:**
- The more specific you are, the better the output
- Use `/interview` to create specs before handing off work

## Known Issues
- No automated tests yet (add before launch)
