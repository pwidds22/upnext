---
argument-hint: [file or feature to refine]
description: Scrap the current approach and implement the elegant solution
---

# Elegant Solution Mode

## Pre-computed Context
Recent changes:
!git diff HEAD~1

Current branch:
!git branch --show-current

## The Prompt

"Knowing everything you know now, scrap this and implement the elegant solution."

## What This Means

You've seen how the current implementation works - its quirks, edge cases, and complications. Now step back and ask:

1. **What's the core problem?** Strip away the implementation details
2. **What's the simplest solution?** Not the first solution, the BEST solution
3. **What patterns exist in this codebase?** Can we reuse something?
4. **What would a senior engineer do?** Think design, not just code

## Rules for Elegant Solutions

- **Fewer lines is usually better** - But not at the cost of readability
- **Reuse existing patterns** - Check hooks/, utils/, components/ first
- **Clear data flow** - Easy to trace what happens when
- **Handle errors gracefully** - But don't over-engineer error handling
- **Match existing style** - Consistency > personal preference

## Anti-Elegance (Avoid)

- Clever tricks that are hard to understand
- Premature abstractions for "flexibility"
- Copy-pasted code with minor variations
- Deeply nested conditionals
- Magic numbers or strings

## Process

1. Read the current implementation
2. Identify what's inelegant about it
3. Design a cleaner approach (explain your thinking)
4. Implement it
5. Verify it handles all the same cases
6. Run TypeScript check

## Target
<target>$ARGUMENTS</target>

If no target specified, review the most recent changes (git diff HEAD~1).
