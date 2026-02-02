---
description: Find and report technical debt, duplicated code, and cleanup opportunities
---

# Technical Debt Audit

Use subagents to thoroughly scan the codebase for technical debt. Run this at the end of every session or before major features.

## What to Find

### 1. Duplicated Code
Search for:
- Similar function implementations across files
- Copy-pasted logic that should be extracted to utils
- Repeated patterns that could be DRYed up

### 2. Type Issues
- Any usage of `any` type
- Missing return types on functions
- Inconsistent type definitions (duplicates in types/index.ts)

### 3. Anti-Pattern Violations
Check against CLAUDE.md anti-patterns:
- `ON CONFLICT` usage in SQLite (should be check-then-insert)
- camelCase in SQL columns (should be snake_case)
- Direct API calls from screens (should go through hooks/services)
- Inline styles (should use StyleSheet.create)
- Missing loading states

### 4. Cleanup Opportunities
- Unused imports
- Dead code / commented out code
- TODOs that should be addressed
- Console.log statements that should be removed

### 5. Known Issues
- API key hardcoded in constants.ts
- Missing error boundaries
- Missing TypeScript strict null checks

## Output Format

Create a markdown report with:

```markdown
# Tech Debt Report - [Date]

## Critical (Fix Now)
- [ ] Issue description - `file:line`

## High Priority (Fix Soon)
- [ ] Issue description - `file:line`

## Medium Priority (Fix When Convenient)
- [ ] Issue description - `file:line`

## Low Priority (Nice to Have)
- [ ] Issue description - `file:line`

## Patterns to Add to Anti-Patterns
- Pattern description (seen in X places)
```

## Instructions

Use multiple subagents in parallel to scan different parts of the codebase:
1. One for src/services/
2. One for src/screens/
3. One for src/components/
4. One for src/hooks/

Report findings but DO NOT fix anything automatically - just report for human review.
