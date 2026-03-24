# Changelog

## [2.3.1] — 2026-03-24

### Fixed
- **Critical: `isWorkBranch()` now recognizes Claude Code worktree branch names** — Agent tool's `isolation: "worktree"` creates branches named `worktree-agent-*`, `claude/*`, `agent-*` which didn't match the `work/` prefix pattern, causing enforcement-gate, quality-gate, and safety-guard to block all agent file writes

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [2.3.0] — 2026-03-24

### Added
- **Pre-flight infrastructure audit** (Step 1.0): new Phase 1 pre-checklist validates all 14 hook files, 8 prompt files, 2 skill files, workflow.json integrity, core directories, and Agent Teams capability — in one pass before any workflow logic runs
- **Per-phase mandatory checklists**: every phase (1–7) now ends with a verification checklist the team leader must iterate through before proceeding — prevents step-skipping
- **Adversarial QA testing** (AGENT-SPAWN-TEMPLATES.md): QA agents now actively try to break code — edge cases, error paths, security, race conditions, boundary conditions — not just checklist verification
- **Context exhaustion protocol** (AGENT-SPAWN-TEMPLATES.md): coding agents that run low on context follow a structured handoff — commit WIP, message team leader with completed/remaining steps, fresh agent picks up
- **Artifact-level task state tracking** (tracker.js): `workflow-state.json` now contains a `tasks` object tracking per-task lifecycle — `in-progress` → `completed` → `qa-passed`/`qa-failed` → `merged` — with timestamps, files, agent, QA round count
- **Quality gate Stop hook** (hooks/quality-gate.js): auto-detects project toolchain (JS/TS, Python, Go, Makefile) and runs lint/typecheck/test at end of every coding agent turn — warnings injected into agent context on failure
- **Branch-scenario detection** (Step 1.3): workflow detects whether user is on a feature branch (most common), base branch, or wrong branch — adapts Phase 2 branch creation accordingly instead of always assuming fresh start from base
- **Agent Teams capability check** (Step 1.0f): validates TeamCreate, Agent, SendMessage, TaskOutput tools are available before workflow begins

### Fixed
- **`qa.passed` event now mandatory before merge**: Phase 4c explicitly emits `/track qa.passed` — previously undocumented, causing merge gate to block with "Branch does not have a QA pass"
- **`guardian-passed` checkpoint now mandatory**: Phase 5 explicitly emits `/track checkpoint "guardian-passed"` — previously missing, permanently blocking shutdown/TeamDelete
- **Phase 8 ordering**: agents now shut down BEFORE `session.end` emission — prevents enforcement-gate from allowing app code writes while agents still running
- **Coding agents no longer told to "spawn QA"**: removed impossible instruction — teammates cannot spawn teammates, only team leader can
- **Direct write to tracking `events.jsonl` removed**: Phase 2b now uses hooks/tracking.js auto-initialization instead of Edit/Write — enforcement-gate V1 blocks direct writes to `events.jsonl`
- **`git branch -D` in stale cleanup replaced with `-d`**: safety-guard destructive guard blocks uppercase `-D`
- **Redundant Phase 2 eliminated**: crash recovery / existing progress checks folded into Phase 1 Step 1.9
- **`totalWaves` now set in workflow state**: Phase 2c records wave count, Phase 3 passes it with `setup-complete` — prevents phantom wave creation

### Changed
- Phases renumbered 1–7 (was 1–8): old Phase 2 (redundant progress check) eliminated
- Phase 1 restructured: Step 1.0 (infrastructure audit) runs first, remaining steps renumbered 1.1–1.11
- `workflow-gate.js` prompt validation references updated for new phase numbering
- Added enforcement-gate V7 workaround notes for Phase 5 (Guardian fixes) and Phase 6 (verification failures)
- Added branch guard notes for `git push` on feature branches and Guardian commits

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [2.2.0] — 2026-03-23

### Added
- `/deep-research` command now distributed with plugin (previously project-local only)

### Removed
- Removed `/new`, `/new-hotfix`, `/new-refactor`, `/new-tests`, `/review-pr` from distributed commands
- Synced all distributed commands with trimmed project-local versions

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [2.1.0] — 2026-03-22

### Added
- Unified tracking system (`.claude/tracking/`) with manifest.json, events.jsonl, and per-agent JSONL files (`hooks/tracking.js`)
- Hook-based agent event emitter for team agent lifecycle tracking — TeammateIdle, TaskCompleted, PreToolUse, PostToolUse, Stop (`hooks/tracking-emitter.js`)
- Tracking initialization wired into `/new-feature`, `/new`, and `/new-plan` commands

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [2.0.0] — 2026-03-21

### Added
- **Consolidated enforcement hook** (`hooks/enforcement-gate.js`): single PreToolUse hook closing 4 vulnerability classes — state file tamper protection (V1), worktree read isolation (V3), sequence gates (V6), app code write block (V7)
- **Prompt content validation** (V2): workflow-gate.js now validates coding agent spawn prompts contain 8+ of 11 required structural markers and minimum 2000 chars
- **Classification hardening** (V5): team_name mismatch no longer bypasses gates; QA/Guardian require dual-signal detection; catch block fails CLOSED
- **Broader worktree gate** (V3): team-leader-gate.js Gate C rewritten with broad worktreeDir matching + allowlist
- **Broader merge gate** (V4): team-leader-gate.js Gate A rewritten with fail-CLOSED on empty events and no active feature
- **Worktree creation timing** (Gate E): blocks `git worktree add` outside wave/setup phases
- **`/deep-research` command**: conversational phased research with 5-layer validation, iterative cross-referencing, and quality rules
- 9 new PreToolUse matchers in `hooks.json` for enforcement-gate.js (Bash, Edit, Write, Read, Glob, Grep, TeamCreate, TeamDelete, EnterWorktree)
- `enforcementGate` guard toggle in workflow config

### Fixed
- **QA workflow**: Team Leader now spawns QA agents — coding agents (teammates) cannot spawn other teammates/subagents

### Changed
- Coordination rules and workflow integrity sections replaced with hook-reference trigger tables (~240 lines trimmed, ~6,000 tokens saved per session)
- 9 command/agent/prompt files converted from ASCII box-drawing tables to GFM markdown tables
- Agent Enforcement Protocol section in playbook replaced with hook summary
- Hook Enforcement Summary expanded in PHASE-GATE-PROTOCOL.md

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.5.1] — 2026-02-24

### Fixed
- **Team leader no longer writes workflow-state.json directly** — AGENT-SPAWN-TEMPLATES.md kickoff checklist still had v1.3 gate-era "Initialize/Update `workflow-state.json`" instructions causing the team leader to use the Write tool (showing full diffs in terminal). Replaced with checkpoint event emissions — hooks handle all state writes automatically.
- **TaskOutput "No task found with ID" error** — team leader constructed IDs manually (e.g., `agent@task`) instead of using the `task_id` returned by the Task tool. Added explicit save-and-reuse instructions to spawn templates and team-leader Step 7/8.
- Updated workflow-integrity section to reference FSM fields (`guardianPassed`) instead of old Gate 8 references

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.5.0] — 2026-02-23

### Changed
- **Simplified FSM replaces 9-gate system** — workflow state now uses `phase` field (`plan`→`setup`→`wave`→`guardian`→`done`) instead of 9 individual gates. All transitions are event-driven via `/claude-workflow:track` checkpoints.
- **Rebuild state from events (CQRS)** — new `rebuildState(feature)` function replays `events.jsonl` to reconstruct `workflow-state.json`. Used defensively by `compact-reinject.js` when state file is missing.
- **Self-contained QA loop** — removed team leader QA micromanagement (Agent Health Monitoring subsection). Coding agents handle QA internally; team leader only intervenes on max-round failures.
- **Worker isolation** — explicit `<communication-rules>` section in spawn templates: agents communicate only with their QA sub-agent and the Team Leader, never peer agents.
- `hooks/tracker.js`: `updateWorkflowStateFromEvent()` rewritten for FSM v2 (~60 lines replacing ~90 lines)
- `hooks/config.js`: added `migrateV1State()` for transparent v1→v2 state migration on read; `getWorkflowState()` now calls migration automatically
- `hooks/workflow-gate.js`: checks `state.setupComplete` and `state.phase` instead of `gates['3_branch_team_ready']` and `gates['7_all_waves_complete']`
- `hooks/team-leader-gate.js`: checks `state.guardianPassed` instead of `gates['8_guardian_passed']`
- `hooks/compact-reinject.js`: defensively rebuilds state from events when state file is missing; references `phase` field instead of `currentPhase`
- `PHASE-GATE-PROTOCOL.md`: full rewrite from 97-line gate checklist to ~55-line FSM state transition table
- `agents/team-leader.md`: checkpoint emissions replace direct `workflow-state.json` writes; Rule #11 updated
- `commands/new-feature.md`: gate checks replaced with FSM phase checks and checkpoint emission guidance

### Added
- Two new checkpoints: `"setup-complete"` and `"all-waves-complete"` (team leader must emit these)
- `rebuildState(feature)` exported from `hooks/tracker.js`
- `migrateV1State(parsed)` in `hooks/config.js` — detects old 9-gate format and translates to FSM fields

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

## [1.4.0] — 2026-02-23

### Added
- **Team Leader behavioral enforcement hook** (`hooks/team-leader-gate.js`): 4 PreToolUse gates that technically prevent the team-leader agent from bypassing the QA workflow
  - **Merge gate** — blocks `git merge` on work/ branches unless events.jsonl has an unmerged `qa.passed` event
  - **Shutdown gate** — blocks `shutdown_request` messages until Gate 8 (Guardian Passed)
  - **Worktree polling gate** — blocks read-only git commands targeting .worktrees/ to prevent premature status checking
  - **TaskStop gate** — blocks force-stopping background agents until Gate 8
- `guards.teamLeaderGate` config toggle: enable/disable all 4 gates in `.claude/workflow.json`

### Changed
- `agents/team-leader.md`: replaced 40-line prose `<workflow-integrity>` anti-shortcutting rules with 8-line hook-enforced summary — behavior is now technically enforced, not just instructed
- `hooks/hooks.json`: registered `team-leader-gate.js` for Bash, SendMessage, and TaskStop tools

### Removed
- `renderHistoryMd()` from `hooks/tracker.js` — `history.md` was redundant with `events.jsonl`; tracking now only renders `current.md` and `index.md`

### Update
```
/plugin update claude-workflow@claude-workflow-marketplace
```

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
