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
- **DON'T** use `ON CONFLICT` for upserts - use check-then-insert pattern instead
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
- Read `_SESSION.md` for current state and in-progress work
- Read `_HANDOFF.md` for full project context
- Update `_SESSION.md` with file paths when making changes
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

## Known Issues
- API key hardcoded in `src/utils/constants.ts` (fix before production)
- No automated tests yet (add before launch)
