# UpNext

A mobile app for tracking the TV shows and movies you watch, and seeing which episode comes next.

## What it does

- Search TV shows and movies, add them to your list, and set a status (Watching, Watchlist, Completed, Dropped).
- Mark episodes as watched. An "Up Next" home screen shows your next episode and upcoming air dates.
- Rate shows, react to episodes, log rewatches, and view stats such as watch time, streaks, and an activity calendar.
- Follow friends, see what they are watching, and export your data.

## Tech stack

- React Native 0.81, Expo 54, TypeScript
- SQLite on the device as the source of truth (offline-first)
- Supabase for sign-in (email, Apple, Google) and background cloud sync, with row level security on user tables
- TMDB API for show, movie, and episode data

## Built with Claude Code

I built this app with [Claude Code](https://claude.com/claude-code). `CLAUDE.md` holds the project conventions and the mistakes to avoid that I gave it. `.claude/commands/` holds the custom slash commands I used for planning, review, and tech-debt passes.

## Running it locally

You need Node.js 20 or later, and an iOS simulator or Android emulator.

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup). Then copy the "API Read Access Token" from [Settings > API](https://www.themoviedb.org/settings/api).
2. Create a free [Supabase](https://supabase.com) project. Run the SQL files in `supabase/migrations/` in its SQL editor.
3. Copy `.env.example` to `.env`. Fill in the TMDB token, the Supabase URL, and the Supabase anon key.
4. Install and run:

   ```bash
   npm install
   npm run ios       # or: npm run android
   ```

The app requires sign-in, so it needs a Supabase project. Email sign-up works with the steps above. Apple and Google sign-in need extra provider setup in Supabase.

The repo does not have the full Supabase schema. Migrations 002 to 013 are missing, so follows, episode reactions, dismissed shows, and the username sign-in function will not work on a fresh project.

## Status

I no longer maintain this app. The repo is here as a portfolio piece.

This product uses the TMDB API but is not endorsed or certified by TMDB.
