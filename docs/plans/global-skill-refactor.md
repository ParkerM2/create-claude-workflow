# Future Plan: Refactor claude-workflow into a Global Skill

**Status**: PLANNED (not started)
**Date**: 2026-02-14
**Context**: Currently `npx create-claude-workflow init` scaffolds everything into `.claude/` per-project. This is backwards — the skill itself (commands, agents, prompts) should be global, and only project config should be per-project.

## Current Flow (wrong)

```
npx create-claude-workflow init    →  scaffolds EVERYTHING into .claude/
user runs /implement-feature       →  uses the scaffolded files
```

## Target Flow

```
npx create-claude-workflow install →  installs commands/agents/prompts to ~/.claude/ (GLOBAL)
user runs /implement-feature       →  command detects no project config → runs quick setup
next time /implement-feature       →  project already configured → proceeds normally
```

## Key Changes

1. **Split global vs project-local files**
   - Global (`~/.claude/`): commands, agents, prompts (the skill itself)
   - Project (`.claude/`): `workflow.json` (config), hooks, progress files

2. **Move template variable substitution from build-time to runtime**
   - Commands read `.claude/workflow.json` for `PROJECT_RULES_FILE`, `ARCHITECTURE_FILE`, `PROGRESS_DIR`
   - No more `{{VARIABLE}}` baking at scaffold time for commands/agents/prompts
   - Hooks still get installed per-project (they reference project-specific paths)

3. **Add lazy init to every command**
   - Each command checks for `.claude/workflow.json` at the top
   - If missing: run first-time setup (3 questions → write config → install hooks)
   - If present: read config and proceed

4. **Update `npx create-claude-workflow`**
   - `install` subcommand: installs to `~/.claude/` (global)
   - `init` subcommand: kept for backwards compat, creates project config only
   - `update` subcommand: updates global files to latest version

## Benefits

- Install once, works in every project
- No per-project scaffolding needed upfront
- Updates to the skill don't require re-scaffolding every project
- Cleaner separation of concerns
