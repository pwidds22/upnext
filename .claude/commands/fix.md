---
argument-hint: [bug description, error message, or paste from Slack/logs]
description: Autonomous bug fixing - just describe the bug and let Claude fix it
---

# Autonomous Bug Fix Mode

You've been given a bug to fix. Work autonomously to:

1. **Understand the bug** - Parse the error message, stack trace, or description
2. **Locate the source** - Use search/grep to find relevant code
3. **Identify root cause** - Read the code and understand what's wrong
4. **Implement the fix** - Make minimal, targeted changes
5. **Verify the fix** - Run TypeScript check, test if possible

## Rules

- **Don't ask questions** - Figure it out from context
- **Don't over-engineer** - Fix the bug, nothing more
- **Don't refactor** - Only change what's necessary for the fix
- **Do explain** - After fixing, briefly explain what was wrong and why

## Context

This is a React Native + Expo app:
- SQLite for local storage (`src/services/storage.ts`)
- Supabase for cloud sync (`src/services/supabase/`)
- TMDB API for show data (`src/services/tmdb.ts`)
- Check CLAUDE.md for patterns and anti-patterns

## Common Bug Categories

### Sync Issues
- Look in `src/services/supabase/sync.ts`
- Check payload field names (snake_case for DB)
- Verify sync queue entries

### Type Errors
- Check `src/types/index.ts` for type definitions
- Ensure database columns match type fields
- Watch for optional vs required fields

### UI Issues
- Check for missing loading states
- Verify data exists before rendering
- Look for race conditions in useEffect

### API Issues
- Check response parsing in tmdb.ts
- Verify API key is available
- Handle null/undefined from API

## Bug Description
<bug>$ARGUMENTS</bug>

## After Fixing

1. Run `npx tsc --noEmit` to verify no type errors
2. Summarize what was fixed and why
3. If this reveals a pattern that could cause other bugs, mention it
