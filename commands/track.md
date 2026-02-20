---
description: "Emit a tracking event to the JSONL progress log — the sole mechanism for recording checkpoints, task state, errors, blockers, and QA results"
---

# /track — Emit a Tracking Event

> The sole tracking mechanism for the workflow. Emits a structured event to the feature's JSONL progress log. Feature is auto-detected from the current git branch. Agents MUST call `/track` at each required checkpoint — there are no automatic hooks.

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

Write the event to the feature's JSONL log:

1. Read progressDir from `.claude/workflow.json` (default: `.claude/progress`)
2. Create `<progressDir>/<feature>/` directory if it doesn't exist
3. Build the event envelope:
   ```json
   {
     "v": 1,
     "ts": "<ISO timestamp>",
     "sid": null,
     "seq": null,
     "type": "<event-type>",
     "feature": "<feature>",
     "agent": null,
     "pane_id": null,
     "data": { ... }
   }
   ```
4. Append the JSON line to `<progressDir>/<feature>/events.jsonl`

---

## Phase 5: Confirm

Output a brief confirmation:

```
Tracked: <event-type> → .claude/progress/<feature>/events.jsonl
```

If this is a significant event (checkpoint, task.completed, qa.passed/failed, session.start/end, blocker.reported), also regenerate `current.md` from the JSONL log.
