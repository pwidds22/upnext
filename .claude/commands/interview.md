---
argument-hint: [feature or task to spec out]
description: Interview user in-depth to create a detailed spec before coding
allowed-tools: AskUserQuestion, Write
---

# Spec Interview Mode

Follow the user instructions and interview me in detail using the AskUserQuestion tool about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing me continually until it's complete.

## Interview Topics to Cover
- **Core functionality:** What exactly should this do?
- **UI/UX:** How should it look? What interactions? What screens?
- **Data model:** What new tables/fields? How does it relate to existing data?
- **Edge cases:** What happens when X? What about Y?
- **Error handling:** What could go wrong? How should we handle it?
- **Sync:** Does this need to sync to Supabase? How?
- **Performance:** Any concerns about list sizes, API calls, etc.?
- **Existing patterns:** How does this fit with our current architecture?

## Project Context
This is a React Native + Expo app for tracking TV shows and movies.
- SQLite local database (offline-first)
- Supabase cloud sync
- TMDB API for show/movie data
- Follow patterns in CLAUDE.md

## After Interview
Once the interview is complete, write the spec to a file:
`specs/[feature-name].md`

Include:
1. **Summary** - One paragraph overview
2. **Requirements** - Bulleted list of what it must do
3. **Data Model** - Tables, fields, relationships
4. **UI Components** - Screens, components needed
5. **API Calls** - TMDB or Supabase calls needed
6. **Edge Cases** - How to handle each
7. **Implementation Order** - Suggested sequence of steps

<instructions>$ARGUMENTS</instructions>
