---
name: track
description: "Emit a tracking event to the JSONL progress log — records checkpoints, task state, errors, blockers, and QA results"
---

# /track — Emit a Tracking Event

> Emit a structured event to the feature's JSONL progress log. Feature is auto-detected from the current git branch.

---

## Usage

```
/track <event-type> <message> [--files f1,f2] [--task N]
```

### Examples

```
/track checkpoint "pre-merge-wave-2"
/track task.started "Implementing auth service" --task 2
/track task.completed "Auth service complete" --files src/auth.ts,src/types.ts --task 2
/track error.encountered "Type mismatch in src/service.ts:42"
/track blocker.reported "Cannot resolve circular dependency in auth module"
/track qa.passed "Task #3, round 1, all criteria met" --task 3
/track qa.failed "Task #3, round 1, missing error handling" --task 3
/track warning.logged "Large file detected: src/utils.ts exceeds 500 lines"
/track session.start "Starting feature implementation"
/track session.end "Feature complete"
```

---

## Phase 1: Parse Input

Extract from the user's input:
- **event-type**: The dot-namespaced event type (e.g., `checkpoint`, `task.completed`)
- **message**: The descriptive message (everything after event-type, before flags)
- **--files**: Optional comma-separated list of file paths
- **--task**: Optional task number

---

## Phase 2: Detect Feature

Auto-detect the feature from the current git branch:

```bash
git branch --show-current
```

Parse the branch name:
- `work/<feature>/<task>` → feature = `<feature>`
- `feature/<feature>` → feature = `<feature>`
- `hotfix/<name>` → feature = `<name>`
- `refactor/<name>` → feature = `<name>`
- Other → warn user, ask for feature name

---

## Phase 3: Build Event Data

Map the event-type to a data payload:

| Event Type | Data Fields |
|-----------|-------------|
| `session.start` | `{ command: "track", feature, branch, mode: null }` |
| `session.end` | `{ reason: message, duration_s: null, tasks_completed: null }` |
| `checkpoint` | `{ label: message, branch, plan_step: null, resumable: true }` |
| `task.started` | `{ taskId: --task, summary: message, agent: null, files: --files }` |
| `task.completed` | `{ taskId: --task, summary: message, files_changed: --files }` |
| `task.failed` | `{ taskId: --task, error: message, attempts: null }` |
| `qa.started` | `{ taskId: --task, round: null, reviewer: null }` |
| `qa.passed` | `{ taskId: --task, round: null, summary: message }` |
| `qa.failed` | `{ taskId: --task, round: null, issues: [message] }` |
| `error.encountered` | `{ file: null, line: null, error: message, attempts: null, resolved: false }` |
| `blocker.reported` | `{ description: message, agent: null, task: --task }` |
| `warning.logged` | `{ message: message, context: null }` |

---

## Phase 4: Write Event

Write the event using the **tracker module** via a Bash node command. Do NOT write directly to events.jsonl with Write/Edit tools — direct writes are blocked by the proof-gate hook. The tracker module handles locking, atomic writes, workflow state updates, and markdown rendering automatically.

Run via Bash:

```bash
node -e "require('${PLUGIN_ROOT}/hooks/tracker.js').emitEvent('<event-type>', <data-as-json>, {feature: '<feature>'})"
```

Where:
- `${PLUGIN_ROOT}` is the plugin root path from the workflow session context
- `<event-type>` is the dot-namespaced event type (e.g., `session.start`, `task.completed`)
- `<data-as-json>` is the data object from Phase 3 as a JavaScript object literal
- `{feature: '<feature>'}` passes the feature name as an option (overrides auto-detection)

The tracker module automatically:
- Creates the feature directory if needed
- Appends the event with proper envelope (v, ts, sid, seq)
- Updates workflow-state.json via the FSM
- Re-renders current.md and index.md for significant events

---

## Phase 5: Confirm

Output a brief confirmation:

```
Tracked: <event-type> → .claude/progress/<feature>/events.jsonl
```
