# Changelog

## [1.3.1] — 2026-02-23

### Fixed
- `/track` skill resolution for subagents — use fully-qualified `/claude-workflow:track` in all agent/command files (10 files, ~40 replacements)
- Progress display now renders as inline markdown table in CLI instead of file diffs

### Added
- Progress Display Protocol in `team-leader.md` — formatted task table after each tracking event
- Two-path context loading in `new-feature.md` — Path A (design doc) reads 3 files, Path B (no doc) lazy-loads by phase (~5K-8K tokens saved)
- Workflow Integrity anti-shortcutting rules in `team-leader.md` — prevents rushing agents, skipping QA, and cutting merge corners

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.3.0] — 2026-02-22

### Added
- **Phase Gate Protocol** (`PHASE-GATE-PROTOCOL.md`): 97-line workflow state machine with 9 sequential gates — replaces 2000+ lines of prose for phase transitions
- **Workflow state file** (`workflow-state.json`): on-disk JSON tracking gate progress, survives context compaction and session crashes
- **`workflow-gate.js` hook**: PreToolUse hook on Task tool — blocks agent spawning when prerequisite gates haven't passed (Gate 3 for coding agents, Gate 7 for Guardian)
- **`compact-reinject.js` hook**: SessionStart hook re-injecting Phase Gate Protocol and current workflow state after context compaction
- **`guards.workflowGate`** config toggle: enable/disable phase gate enforcement in `.claude/workflow.json`
- Auto-sync of workflow state via `tracker.js` — significant events automatically update `workflow-state.json`
- Context Recovery section in `team-leader.md` for post-compaction resume
- Gate check reminders at 5 phase boundaries in the playbook README
- Section 16 (Phase Gate Protocol) in the playbook README

### Changed
- `hooks/config.js`: added `getWorkflowState()`, `updateWorkflowState()`, `getActiveFeature()` utilities
- `commands/new-feature.md`: PHASE-GATE-PROTOCOL.md as first mandatory read, gate check markers between phases, progressive disclosure for spawn templates
- `agents/team-leader.md`: Phase Gate Protocol in Phase 0 reads, state file management at each gate, non-negotiable rule #11
- `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`: Workflow State File awareness section for Team Leader checklist
- `hooks/hooks.json`: registered 2 new hooks (compact-reinject, workflow-gate)

### Fixed
- Gate object truthiness check in `workflow-gate.js` — objects are always truthy in JS, now correctly checks `.passed` property

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.2.0] — 2026-02-19

### Added
- **Configurable guard toggles**: `guards` section in `.claude/workflow.json` lets users enable/disable `branchGuard`, `destructiveGuard`, and `configGuard` independently
- `/settings` command: hub for guard permissions, agent audit, and performance audit
- `/new` unified entry point: create features, plans, tasks, agents, or ideas from a single command

### Changed
- **Command consolidation**: 15 commands reduced to 11 with `new-*` prefix grouping (`/new-feature`, `/new-plan`, `/new-hotfix`, `/new-refactor`, `/new-tests`, `/resume`)
- **Combined safety guard**: merged `branch-guard.js` + `destructive-guard.js` into single `safety-guard.js` — cuts per-Bash-command hook latency ~50%
- **XML-structured agent definitions**: all agent files (`team-leader.md`, `qa-reviewer.md`, `codebase-guardian.md`) now use XML tags for every section, improving Claude's parsing accuracy 15-25%
- **Lazy-load pattern for team-leader**: Phase 0 now only reads project rules + architecture file; playbook, spawn templates, and reference files load at the phase that needs them (~6,000 tokens saved per spawn)
- Absorbed `/scaffold-agent`, `/discover-agents`, `/agent-permissions`, `/audit-agents`, `/audit-performance` into `/new` and `/settings` sub-flows

### Removed
- `hooks/branch-guard.js` — superseded by `hooks/safety-guard.js`
- `hooks/destructive-guard.js` — superseded by `hooks/safety-guard.js`
- Standalone commands: `scaffold-agent`, `discover-agents`, `agent-permissions`, `audit-agents`, `audit-performance`

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.1.0] — 2026-02-18

### Added
- **Git worktree agent isolation**: each agent task gets its own worktree directory, enabling true parallel execution within waves
- New `hooks/config.js`: shared config reader with worktree-aware repo root resolution, branch pattern matchers, and effective branch detection
- `/workflow-setup` branching questions (Q4–Q8): branching strategy, base branch, agent isolation, enforcement level, protected branches
- `worktree.created` and `worktree.removed` event types in JSONL progress tracker
- Worktree reconciliation in resume protocol for crash recovery
- Worktree column in progress file task table
- "Agent Isolation with Worktrees" and "Changing Branch Rules at Runtime" sections in using-workflow skill

### Changed
- **Branch enforcement is now `warn` by default** (was `block`) — branch rules are guidelines, not permanent blocks
- `hooks/branch-guard.js`: configurable `enforce` modes (`warn`/`block`/`off`), worktree-aware branch detection, configurable protected branches
- `hooks/tracker.js`: `getFeatureFromBranch()` uses configurable prefixes, `getProgressDir()` resolves from repo root (works in worktrees)
- `hooks/git-tracker.js`: *(removed in later release — replaced by explicit `/track` commands)*
- `hooks/session-start.js`: injects branching + worktree configuration into `<workflow-config>` context
- `.claude/workflow.json`: added `branching` section with `baseBranch`, `featurePrefix`, `workPrefix`, `enforce`, `protectedBranches`, `useWorktrees`, `worktreeDir`
- `agents/team-leader.md`: rewritten branching model and merge protocol for worktrees with configurable prefixes
- `commands/implement-feature.md`: worktree creation/cleanup in Phases 4/6/9, updated Quick Reference
- `commands/hotfix.md`, `commands/refactor.md`: configurable base branch
- `commands/resume-feature.md`: worktree scanning and reconciliation
- All `prompts/implementing-features/` files updated for worktree model and configurable prefixes
- Version bump: 1.0.0 → 1.1.0

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [2.0.0] — 2026-02-14

### Changed
- Migrated from npm scaffolder to Claude Code plugin system
- Commands, agents, and prompts now live at plugin root (not templates/)
- Template variables ({{VAR}}) replaced with runtime config via session-start hook
- Installation via `/plugin install` instead of `npx create-claude-workflow`

### Added
- Plugin manifest (.claude-plugin/plugin.json)
- Hook system (hooks.json + 5 hook scripts)
- Skills (using-workflow, workflow-setup)
- Marketplace structure for plugin distribution

### Removed
- npm scaffolder (lib/, bin/, templates/, package.json)
- Template variable baking at install time
- Per-project file scaffolding

## [1.0.0] - 2026-02-14

### Added
- Plugin system: installable via Claude Code marketplace
- 12 workflow commands: implement-feature, create-feature-plan, resume-feature, claude-new, status, hotfix, refactor, review-pr, generate-tests, scaffold-agent, audit-agents, discover-agents
- 3 agent definitions: team-leader, qa-reviewer, codebase-guardian
- 4 enforcement hooks: branch-guard, destructive-guard, config-guard, activity-logger
- SessionStart bootstrap hook with project configuration injection
- Workflow modes: strict, standard, fast
- Crash recovery via progress files and /resume-feature
- Per-project configuration via .claude/workflow.json

### Changed
- Migrated from npm scaffolder (`npx create-claude-workflow init`) to Claude Code plugin system
- Template variables replaced with runtime configuration injection
