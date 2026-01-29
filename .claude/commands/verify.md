---
name: verify
description: Run all checks before committing
---

# Verify Changes

## Pre-computed Context
Changed files:
!git diff --name-only HEAD

TypeScript files changed:
!git diff --name-only HEAD | grep -E "\\.tsx?$" || echo "No TS files changed"

## Instructions
1. Run TypeScript check: `npx tsc --noEmit`
2. If there are type errors, fix them before proceeding
3. Start the app: `npm start` (let user verify it runs)
4. Report: all checks passed or list what failed

## Verification Checklist
- [ ] TypeScript compiles without errors
- [ ] App starts without crashes
- [ ] Changed features work as expected
