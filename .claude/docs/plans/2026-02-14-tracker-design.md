# Design: Integrated Progress Tracker

**Status**: DESIGN
**Date**: 2026-02-14
**Scope**: New module within `claude-workflow-skill`

---

## 1. Problem

The workflow skill works well on the happy path but has no memory across sessions. When Claude crashes, hits context limits, or the user closes the terminal, all context is lost. The progress file helps, but it's manually maintained and not structured enough for automated recovery.

Additionally, there's no way to:
- Monitor agent teams in real-time
- Feed progress data to external apps (dashboards, webhooks, Electron, React Native)
- Analyze workflow performance across features
- Resume automatically with full context

## 2. Solution

An integrated tracking system with three layers:

1. **JSONL event log** (source of truth) — append-only, per-feature, machine-readable
2. **Rendered markdown summary** — regenerated from the log, human-readable
3. **Top-level index** — date-grouped overview of all features/tasks

## 3. Use Cases (Priority Order)

### 3a. Crash Recovery & Resume (PRIMARY)

Save enough local context and checkpoints so that on resume, Claude can:
1. Reconstruct what was happening
2. Detect any errors, blockers, or unfinished work
3. If clean stop (no errors): auto-resume from last checkpoint
4. If issues found: present to user with options

**Resume flow:**
```
/resume
  ├─ Read JSONL log (last session)
  ├─ Find last checkpoint
  ├─ Check for error/blocker events after it
  ├─ Reconstruct plan + task state
  │
  ├─ If no issues: auto-resume
  │
  └─ If issues found:
       "What happened: <brief description>"
       "What we can do next:"
       A. Fix the problem, restart from before the error
       B. Continue past it
       C. [Your input]
```

### 3b. Agent Monitoring & Analytics

Quick commands for agents to log tool use, progress, summaries. Data structured for:
- Real-time dashboards showing each agent's status
- Analytical measurements of workflow performance
- Testing pipeline changes (compare before/after metrics)
- Future WezTerm integration for live pane monitoring

### 3c. External App Integration

Structured data that apps can consume for:
- Webhooks (push events to external services)
- Electron/React Native apps (local dashboard)
- Websites (project status pages)
- Server-side storage and aggregation

## 4. Architecture

### 4.1 File Structure

```
.claude/tracker/
  index.md                          # top-level dashboard (all features)
  features/
    <feature-name>/
      events.jsonl                  # append-only event log
      summary.md                    # rendered summary (regenerated)
    <feature-name>/
      ...
  hotfixes/
    <fix-name>/
      events.jsonl
      summary.md
  refactors/
    <refactor-name>/
      events.jsonl
      summary.md
```

### 4.2 Event Schema (JSONL)

Every event is a single JSON line with a common envelope:

```jsonc
{
  "v": 1,                                // schema version
  "ts": "2026-02-14T10:32:05.123Z",     // ISO timestamp (millisecond precision)
  "sid": "a1b2c3",                        // session ID (groups events to one Claude run)
  "seq": 142,                             // monotonic sequence number
  "type": "task.completed",               // event type
  "feature": "auth-system",              // feature slug (inferred from git branch)
  "agent": "schema-designer",            // which agent (null = team leader)
  "pane_id": null,                        // WezTerm pane ID (null when not in WezTerm)
  "data": { ... }                         // type-specific payload
}
```

### 4.3 Event Types

**Lifecycle:**
- `session.start` — `{ command, feature, branch, mode }`
- `session.end` — `{ reason, duration_s, tasks_completed }`
- `plan.created` — `{ tasks: [...], waves: [...], dependencies: [...] }`
- `plan.updated` — `{ change, reason }`
- `checkpoint` — `{ label, branch, plan_step, resumable: true }`

**Work:**
- `task.started` — `{ taskId, summary, agent, files }`
- `task.completed` — `{ taskId, summary, files_changed }`
- `task.failed` — `{ taskId, error, attempts }`
- `agent.spawned` — `{ name, role, task, branch }`
- `agent.completed` — `{ name, result }`
- `agent.error` — `{ name, error, file, line, resolved }`
- `file.created` — `{ path, reason }`
- `file.modified` — `{ path, reason }`
- `branch.created` — `{ name, parent }`
- `branch.merged` — `{ name, target, conflicts }`

**Quality:**
- `qa.started` — `{ taskId, round, reviewer }`
- `qa.passed` — `{ taskId, round, summary }`
- `qa.failed` — `{ taskId, round, issues: [...] }`
- `check.ran` — `{ command, result, output_summary }`

**Issues:**
- `error.encountered` — `{ file, line, error, attempts, resolved }`
- `blocker.reported` — `{ description, agent, task }`
- `warning.logged` — `{ message, context }`

**Monitoring:**
- `tool.invoked` — `{ tool, target, duration_ms }`
- `context.usage` — `{ agent, tokens_used, tokens_limit, percent }`

### 4.4 Data Flow

```
                    ┌──────────────────────────────────┐
                    │          events.jsonl             │
                    │      (append-only, per-feature)   │
                    └──────────┬───────────┬────────────┘
                               │           │
                    ┌──────────┘           └──────────┐
                    │                                  │
          ┌────────▼────────┐                ┌────────▼────────┐
          │   summary.md    │                │    index.md      │
          │  (per-feature)  │                │  (top-level)     │
          └─────────────────┘                └──────────────────┘

 Writes come from:                    Reads go to:
 ┌─────────────────┐                  ┌─────────────────┐
 │ PostToolUse     │─── automatic ──▶ │ /resume         │
 │ hooks           │                  │ /status         │
 ├─────────────────┤                  │ /history        │
 │ Template gates  │─── /track ─────▶ │ External apps   │
 │ (spawn prompts) │                  │ WezTerm status  │
 ├─────────────────┤                  │ Webhooks        │
 │ Ad-hoc agent    │─── /track ─────▶ └─────────────────┘
 │ calls           │
 └─────────────────┘
```

## 5. Commands

### 5.1 `/track` — Single Tracking Command

The only command agents need to know. Infers feature context from git branch.

```
/track <event-type> <message> [--files file1,file2] [--task N]

Examples:
  /track started "Implementing auth service"
  /track done "Auth service complete" --files src/auth.ts,src/types.ts
  /track error "Type mismatch in src/service.ts:42"
  /track checkpoint "pre-merge-wave-2"
  /track qa-passed "Task #3, round 1, all criteria met"
  /track qa-failed "Task #3, round 1, missing error handling"
  /track blocker "Cannot resolve circular dependency in auth module"
```

**Feature detection:** reads current git branch.
- `work/auth-system/schema-design` → feature = `auth-system`
- `feature/auth-system` → feature = `auth-system`
- `hotfix/login-bug` → hotfix = `login-bug`
- `refactor/auth-cleanup` → refactor = `auth-cleanup`

### 5.2 `/resume` — Crash Recovery

Smart auto-resume. Only prompts user when there's a decision to make.

1. Scan `.claude/tracker/` for features with status != COMPLETE
2. Read that feature's `events.jsonl` backwards
3. Find last checkpoint, check for errors/blockers after it
4. If clean: auto-resume from checkpoint
5. If issues:
   ```
   What happened: Agent "service-eng" encountered a type mismatch
   in src/service.ts:42 (tried 2 fixes, unresolved)

   What we can do next:
   A. Fix the error, then resume from Wave 2
   B. Skip and continue from next task
   C. [Your input]
   ```

### 5.3 `/status` — Current State

Renders the current feature's summary from JSONL. Shows:
- Feature name, branch, mode
- Task completion (4/7 tasks, Wave 2)
- Active agents and their status
- Recent events (last 10)
- Any warnings or blockers

### 5.4 `/history` — Project Overview

Renders `index.md` — the top-level date-grouped view:

```markdown
# Project History

## 2026-02-14
| Type | Name | Status | Tasks | Duration |
|------|------|--------|-------|----------|
| feature | Auth System | COMPLETE | 7/7 | 2h 14m |
| feature | Payment Flow | IN_PROGRESS | 3/7 | — |
| hardening | Stability Guards | COMPLETE | 1/1 | 45m |

## 2026-02-13
| Type | Name | Status | Tasks | Duration |
|------|------|--------|-------|----------|
| hotfix | Login Bug | COMPLETE | 1/1 | 12m |
```

## 6. Tracking Sources

### 6.1 Automatic (Hooks)

These fire without agent involvement:

| Hook | Trigger | Event Type |
|------|---------|------------|
| `activity-logger.js` (existing) | PostToolUse Edit/Write | `file.modified`, `file.created` |
| `tool-tracker.js` (new) | PostToolUse * | `tool.invoked` |
| `git-tracker.js` (new) | PostToolUse Bash | `branch.created`, `branch.merged` (detect from git commands) |

### 6.2 Template Gates

These are `/track` calls baked into the agent spawn templates at phase transitions:

| Gate | Location | Event |
|------|----------|-------|
| Phase 0 complete | After rule loading | `checkpoint "rules-loaded"` |
| Phase 1 complete | After plan written | `checkpoint "plan-written"` |
| Phase 2 complete | After code done | `checkpoint "code-complete"` |
| Phase 3 complete | After self-review | `checkpoint "self-review-done"` |
| QA spawned | Phase 4 | `qa.started` |
| QA verdict | QA Phase 4 | `qa.passed` or `qa.failed` |
| Merge complete | Team leader | `branch.merged` |
| Wave complete | Team leader | `checkpoint "wave-N-complete"` |

### 6.3 Ad-hoc

Agent calls `/track` manually for unexpected events:
- Errors encountered during execution
- Blockers that need escalation
- Warnings about potential issues

## 7. Branch Validation (Pre-Feature)

Before `/implement-feature` spawns any agents:

```
1. git fetch origin
2. Compare feature/{name} with origin/{primary-branch}
   - If behind: "Feature branch is X commits behind. Rebase first?"
   - If diverged: warn user, ask how to proceed
   - If up to date: proceed
3. Validate hierarchy: primary → feature/{name} → work/{name}/{task}
   - If orphan work branches exist: warn
```

## 8. Integration with Existing Workflow

### 8.1 New Template Files

```
templates/
  commands/
    track.md                    # /track command
    resume.md                   # /resume command
    status.md                   # /status command
    history.md                  # /history command
  hooks/
    tool-tracker.js             # PostToolUse hook for tool invocations
    git-tracker.js              # PostToolUse hook for git operations
  prompts/
    tracker/
      EVENT-SCHEMA.md           # event type reference
      RESUME-PROTOCOL.md        # how /resume works
```

### 8.2 Modified Template Files

| File | Change |
|------|--------|
| `AGENT-SPAWN-TEMPLATES.md` | Add `/track` gate calls at each phase transition |
| `team-leader.md` | Add `/track` calls at merge, wave completion |
| `implement-feature.md` | Add tracker directory creation, branch validation, `/track session.start` |
| `hotfix.md` | Add `/track session.start` |
| `refactor.md` | Add `/track session.start` |

### 8.3 Scaffolder Changes

| File | Change |
|------|--------|
| `lib/scaffolder.js` | Create `.claude/tracker/` directory structure during init |
| `lib/scaffolder.js` | Add new hook configurations for tool-tracker and git-tracker |

## 9. Index.md Format (Top-Level Dashboard)

```markdown
# Project History

> Auto-generated by claude-workflow tracker. Do not edit manually.

## Summary

| Metric | Count |
|--------|-------|
| Features completed | 4 |
| Features in progress | 1 |
| Hotfixes completed | 2 |
| Refactors completed | 1 |
| Total agent hours | ~8h |

## 2026-02-14

### Completed
- **feature** Auth System — 7 tasks, 2h 14m → [history](./features/auth-system/summary.md)
- **hardening** Stability Guards — 1 task, 45m → [history](./features/stability-guards/summary.md)

### In Progress
- **feature** Payment Flow — 3/7 tasks → [history](./features/payment-flow/summary.md)

## 2026-02-13

### Completed
- **hotfix** Login Bug — 1 task, 12m → [history](./hotfixes/login-bug/summary.md)
```

## 10. Future: WezTerm Integration

### 10.1 Why WezTerm Over tmux

| Aspect | tmux | WezTerm |
|--------|------|---------|
| Windows support | WSL2 required | Native Windows |
| Scripting | Shell commands only | Lua (full programming language) |
| Multiplexing | External tool + terminal | Built-in multiplexer |
| GPU rendering | No | Yes |
| Configuration | `.tmux.conf` | `wezterm.lua` (version-controllable) |
| Pane management | CLI commands | CLI + Lua API |
| Status bar | Shell `#()` interpolation | Lua-rendered (rich formatting) |
| Cross-platform | macOS/Linux only | macOS, Linux, Windows |

WezTerm is a separate project for customization (file explorer, git branch headers, etc.), but the tracker design accounts for it as the target terminal platform.

### 10.2 Architecture Overview

Each agent runs in its own WezTerm pane. The tracker's JSONL log remains the universal interface — every integration (live tail, status bar, wave gates, crash recovery) reads from the same event stream. WezTerm becomes a thin presentation/coordination layer.

```
WezTerm workspace: workflow-<feature>
  ├─ tab: wave-1
  │    ├─ pane: schema-designer    (env: AGENT_NAME, TASK_ID, WAVE)
  │    └─ pane: type-engineer
  ├─ tab: wave-2
  │    └─ pane: service-engineer
  ├─ tab: monitor
  │    └─ pane: tail -f events.jsonl | formatter
  └─ status bar: "Tasks: 3/6 | Wave: 2 | QA: pending" (Lua-rendered)
```

### 10.3 WezTerm CLI for Agent Management

WezTerm provides `wezterm cli` commands for pane/tab management:

```bash
# Spawn a new pane for an agent:
wezterm cli split-pane --bottom -- claude-code --agent coding-agent ...

# Spawn in a new tab:
wezterm cli spawn --new-window -- claude-code --agent qa-agent ...

# List panes (get pane IDs for correlation):
wezterm cli list --format json

# Send text to a specific pane:
wezterm cli send-text --pane-id 3 "command here"
```

Unlike tmux's `send-keys`, WezTerm's CLI returns structured JSON for pane listing, making it easier to correlate agents to panes programmatically.

### 10.4 Event Schema — Pane Correlation

The `pane_id` field in the event schema maps to WezTerm pane IDs:

```jsonc
{
  "v": 1,
  "ts": "2026-02-14T10:32:05.123Z",
  "sid": "a1b2c3",
  "seq": 142,
  "type": "task.completed",
  "feature": "auth-system",
  "agent": "schema-designer",
  "pane_id": "3",                       // WezTerm pane ID (from $WEZTERM_PANE)
  "data": { ... }
}
```

| Field | Purpose | WezTerm Use |
|-------|---------|-------------|
| `v` | Schema version | Allows formatters to handle upgrades |
| `feature` | Feature slug | Maps to WezTerm workspace name |
| `agent` | Logical agent name | Correlates with pane via env var |
| `pane_id` | `$WEZTERM_PANE` value | Physical pane correlation (null when not in WezTerm) |

### 10.5 Lua Status Bar Integration

WezTerm's `wezterm.lua` config supports rich status bar rendering:

```lua
-- In wezterm.lua:
wezterm.on("update-right-status", function(window, pane)
  local status_file = io.open(".claude/tracker/features/current/status.txt", "r")
  if status_file then
    local status = status_file:read("*a")
    status_file:close()
    window:set_right_status(wezterm.format({
      { Foreground = { Color = "#88c0d0" } },
      { Text = status },
    }))
  end
end)
```

The `status.txt` file is a single pre-computed line:
```
Tasks: 3/6 | Wave: 2 | QA: pending | Mode: standard
```

### 10.6 Wave Gates via File-Based Signaling

Instead of tmux's `wait-for`, use file-based gate signaling (works cross-platform):

```bash
# Coding agent signals completion:
echo "done" > .claude/tracker/gates/task-3-code-complete

# QA agent polls for gate (or uses inotifywait/fswatch):
while [ ! -f .claude/tracker/gates/task-3-code-complete ]; do sleep 1; done
```

Gate naming convention:
```
.claude/tracker/gates/
  <feature>-task-<N>-code-complete
  <feature>-task-<N>-qa-pass
  <feature>-wave-<N>-fence-pass
  <feature>-complete
```

**Design principle**: File-based gates work identically in-process, in WezTerm panes, and on any terminal. The JSONL log records all transitions; gate files provide fast notification. Crash recovery reads JSONL, not gate files.

### 10.7 Updated File Layout

```
.claude/tracker/
  features/
    <feature-name>/
      events.jsonl          # structured event log
      summary.md            # rendered summary
      status.txt            # one-line status bar cache
      gates/                # file-based gate signals
  gates/                    # cross-feature gate signals
```

### 10.8 Communication Abstraction

The tracker's file-based event log serves as a **transport-agnostic communication layer**:

- **Today** (in-process): Agents use `Task` tool + `SendMessage`. Hooks append to JSONL. `/track` writes events. Everything works without WezTerm.
- **Tomorrow** (WezTerm): Same JSONL log, but agents run in WezTerm panes. File-based gates signal between panes. Lua status bar reads `status.txt`. `wezterm cli` manages pane lifecycle.

The JSONL event log IS the abstraction. No code changes needed when switching from in-process to WezTerm mode — only the agent spawning mechanism changes.

### 10.9 What to Implement Now vs Later

| Decision | Urgency |
|----------|---------|
| Add `v`, `feature`, `pane_id` fields to event schema | **Now** (in design) |
| Upgrade `activity-logger.js` from text to JSONL | **Now** (when building tracker) |
| `status.txt` file location and format | **Now** (in design) |
| Gate file naming convention | **Now** (in design) |
| File-based gate signaling pattern | **Now** (in design) |
| WezTerm Lua status bar config | **Later** (WezTerm project) |
| WezTerm workspace/tab management scripts | **Later** (WezTerm project) |
| Replace `Task` tool with WezTerm pane spawning | **Later** (WezTerm project) |
| WezTerm file explorer + git branch UI | **Later** (separate project) |

### 10.10 Platform Note

WezTerm runs natively on Windows, macOS, and Linux — no WSL required. The tracker works in any terminal (in-process mode). WezTerm pane mode is an optional enhancement that adds visibility and pane-based agent isolation.

Full tmux research (historical): [`2026-02-14-tmux-research.md`](./2026-02-14-tmux-research.md)

## 11. Implementation Order

### Phase 1: Core (MVP)
1. `/track` command + JSONL write logic
2. Tracker directory creation in scaffolder
3. EVENT-SCHEMA.md reference doc
4. Update spawn templates with gate `/track` calls

### Phase 2: Recovery
5. `/resume` command + JSONL read/reconstruct logic
6. RESUME-PROTOCOL.md reference doc
7. Branch validation in `/implement-feature`

### Phase 3: Monitoring
8. `/status` command (render from JSONL)
9. `/history` command (render index.md)
10. `tool-tracker.js` hook
11. `git-tracker.js` hook
12. Context usage tracking per agent

### Phase 4: Polish
13. Summary.md auto-regeneration
14. Index.md auto-update
15. Performance analytics helpers
