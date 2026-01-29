---
name: start-session
description: Load project context and understand where we left off
---

# Start Session

## Pre-computed Context
Current git status:
!git status --short

Recent commits:
!git log --oneline -5

Current branch:
!git branch --show-current

## Instructions
1. Read `CLAUDE.md` for project conventions and anti-patterns
2. Read `_SESSION.md` for current state and in-progress work
3. Read `_HANDOFF.md` if you need full project context
4. Summarize: current state, what was last worked on, suggested next task

## Check for Review Feedback
If the user mentions feedback from Claude Web, incorporate it:
- Update `CLAUDE.md` anti-patterns if Claude Web caught a recurring mistake
- Fix any issues identified before starting new work
