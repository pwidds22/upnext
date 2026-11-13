---
name: review
description: Hand off to Claude Web for code review
---

# Hand Off for Review

## Pre-computed Context
Current branch:
!git branch --show-current

Changes to review:
!git diff --stat HEAD~1

Files changed:
!git diff --name-only HEAD~1

Recent commit:
!git log -1 --pretty=format:"%s%n%n%b"

## Instructions
Tell the user to copy this to Claude Web (claude.ai/code) for review:

---

**Review Request for UpNext**

Branch: `[branch name from above]`
Commit: `[commit message from above]`

**Files changed:**
[list from above]

**Please review for:**
1. Any bugs or logic errors
2. Missing error handling
3. Type safety issues
4. Violations of patterns in CLAUDE.md (especially anti-patterns)
5. Edge cases not handled
6. Anything that looks off

**Context:** Read `CLAUDE.md` for project conventions.

---

After Claude Web reviews, incorporate any feedback before continuing.
