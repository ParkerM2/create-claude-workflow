# Event Schema Reference

> Full type reference for the JSONL progress tracker. Every line in `events.jsonl` is a self-contained JSON object conforming to this schema.

---

## Envelope Format

Every event shares a common envelope. No fields are optional at the envelope level — every event must include all envelope fields (use `null` where a value does not apply).

```jsonc
{
  "v": 1,                               // schema version (always 1 for now)
  "ts": "2026-02-14T10:32:05.123Z",    // ISO-8601 timestamp with milliseconds
  "sid": "a1b2c3d4",                    // session ID (8-char hex, unique per Claude run)
  "seq": 142,                           // per-session monotonic sequence number
  "type": "task.completed",             // dot-namespaced event type
  "feature": "auth-system",            // feature slug (derived from git branch)
  "agent": "schema-designer",          // agent name (null for team leader)
  "pane_id": null,                      // WezTerm pane ID (reserved for future use)
  "data": { }                          // type-specific payload (see below)
}
```

---

## Envelope Fields

### `v` — Schema Version

Integer. Currently always `1`. Bump this when the envelope format changes in a backward-incompatible way. Consumers should reject events with an unrecognized version.

### `ts` — Timestamp

ISO-8601 string with millisecond precision. Always in UTC (trailing `Z`). Generated with:

```js
new Date().toISOString()
// => "2026-02-14T10:32:05.123Z"
```

### `sid` — Session ID

8-character hexadecimal string, unique per Claude invocation. Generated once at session start and reused for all events in that session:

```js
const crypto = require('crypto');
const sid = crypto.randomBytes(4).toString('hex');
// => "a1b2c3d4"
```

This allows filtering a single JSONL file to isolate events from one session, even when multiple sessions have appended to the same file.

### `seq` — Sequence Number

Per-session monotonic counter starting at `0`. Incremented by 1 for each event emitted within a session. Used to:

- Detect gaps (missing events, e.g., from a crash mid-write)
- Reconstruct event ordering when timestamps have identical milliseconds
- Verify completeness during resume analysis

### `type` — Event Type

Dot-namespaced string identifying the event kind. Always two segments: `<category>.<action>`. The full list of valid types is documented below.

### `feature` — Feature Slug

Derived from the current git branch name using these patterns:

| Branch Pattern | Extracted Feature |
|---------------|-------------------|
| `work/<feature>/<task>` | `<feature>` |
| `feature/<feature>` | `<feature>` |
| `feature/<feature>/<subtopic>` | `<feature>` |

If the branch does not match any pattern (e.g., `main`, `develop`), set to `null`.

### `agent` — Agent Name

The name of the agent that emitted the event, or `null` if emitted by the team leader. Matches the `name` parameter from the agent spawn template.

### `pane_id` — Pane ID

Reserved for future WezTerm integration. Currently always `null`. Will hold the pane identifier when agents run in dedicated terminal panes.

---

## Event Types

### Lifecycle Events

These mark the boundaries and structure of a session.

---

#### `session.start`

Emitted once at the beginning of every session (including resumed sessions).

```jsonc
{
  "type": "session.start",
  "data": {
    "command": "implement",         // "implement" | "resume" | "fix" | "refactor"
    "feature": "auth-system",      // feature name from user or branch
    "branch": "feature/auth-system", // full git branch name
    "mode": "strict"               // "strict" | "standard" | "fast"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | The workflow command that initiated this session. `"resume"` indicates crash recovery. |
| `feature` | string | Human-readable feature name. |
| `branch` | string | Full git branch name checked out at session start. |
| `mode` | string | Workflow mode governing QA depth and fence checks. |

---

#### `session.end`

Emitted when a session terminates normally. **If this event is missing**, the session was interrupted (crash, timeout, user kill).

```jsonc
{
  "type": "session.end",
  "data": {
    "reason": "completed",         // "completed" | "user_cancelled" | "error"
    "duration_s": 342,             // total session duration in seconds
    "tasks_completed": 5           // number of tasks that reached COMPLETE status
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Why the session ended. `"completed"` means all planned work finished. |
| `duration_s` | number | Wall-clock seconds from `session.start` to `session.end`. |
| `tasks_completed` | number | Count of tasks that reached COMPLETE status during this session. |

---

#### `plan.created`

Emitted after the team leader decomposes a feature into tasks and waves.

```jsonc
{
  "type": "plan.created",
  "data": {
    "tasks": [
      { "id": "1", "summary": "Design database schema", "agent": "schema-designer" },
      { "id": "2", "summary": "Build API service", "agent": "service-eng" },
      { "id": "3", "summary": "Create UI components", "agent": "component-eng" }
    ],
    "waves": [
      { "wave": 1, "task_ids": ["1"] },
      { "wave": 2, "task_ids": ["2", "3"] }
    ],
    "dependencies": [
      { "task_id": "2", "blocked_by": "1" },
      { "task_id": "3", "blocked_by": "1" }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tasks` | array | List of task objects with `id`, `summary`, and assigned `agent`. |
| `waves` | array | Execution waves. Tasks within a wave run in parallel. |
| `dependencies` | array | Blocking relationships between tasks. |

---

#### `plan.updated`

Emitted when the plan changes mid-session (e.g., new task added, dependency changed, task reassigned).

```jsonc
{
  "type": "plan.updated",
  "data": {
    "change": "task_added",        // "task_added" | "task_removed" | "dependency_changed" | "wave_reordered" | "agent_reassigned"
    "reason": "QA found schema gap requiring migration task"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `change` | string | What kind of plan modification occurred. |
| `reason` | string | Human-readable explanation of why the plan changed. |

---

#### `checkpoint`

Emitted at stable points where work can be safely resumed. These are the primary anchor points for crash recovery.

```jsonc
{
  "type": "checkpoint",
  "data": {
    "label": "wave-1-complete",    // human-readable checkpoint name
    "branch": "feature/auth-system", // branch state at checkpoint
    "plan_step": "wave-2-start",   // next planned step after this checkpoint
    "resumable": true              // always true (reserved for future non-resumable checkpoints)
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Descriptive name for this checkpoint (e.g., `"wave-1-complete"`, `"all-tasks-merged"`). |
| `branch` | string | Git branch that was checked out when the checkpoint was created. |
| `plan_step` | string | Identifier of the next step in the plan, so resume knows where to continue. |
| `resumable` | boolean | Whether this checkpoint can be used as a resume point. Currently always `true`. |

---

### Work Events

These track the progress of tasks and agents.

---

#### `task.started`

Emitted when a coding agent begins work on a task.

```jsonc
{
  "type": "task.started",
  "data": {
    "taskId": "2",
    "summary": "Build API service",
    "agent": "service-eng",
    "files": ["src/api/service.ts", "src/api/routes.ts"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task identifier matching the plan. |
| `summary` | string | Brief task description. |
| `agent` | string | Agent assigned to this task. |
| `files` | array | Files the agent plans to create or modify (from Phase 1 plan). |

---

#### `task.completed`

Emitted when a task passes QA and is ready for merge.

```jsonc
{
  "type": "task.completed",
  "data": {
    "taskId": "2",
    "summary": "Build API service",
    "files_changed": ["src/api/service.ts", "src/api/routes.ts", "src/api/types.ts"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task identifier. |
| `summary` | string | Brief task description. |
| `files_changed` | array | Actual files created or modified (may differ from initial plan). |

---

#### `task.failed`

Emitted when a task fails after exhausting retry/QA rounds.

```jsonc
{
  "type": "task.failed",
  "data": {
    "taskId": "2",
    "error": "QA failed 3 rounds — type mismatches in service layer",
    "attempts": 3
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task identifier. |
| `error` | string | Description of the failure. |
| `attempts` | number | Number of attempts made (including QA rounds). |

---

#### `agent.spawned`

Emitted when the team leader spawns a new agent.

```jsonc
{
  "type": "agent.spawned",
  "data": {
    "name": "service-eng",
    "role": "Standard Coding Agent",
    "task": "2",
    "branch": "work/auth-system/api-service"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name (matches spawn template `name` parameter). |
| `role` | string | Agent role description. |
| `task` | string | Task ID assigned to this agent. |
| `branch` | string | Workbranch the agent operates on. |

---

#### `agent.completed`

Emitted when an agent finishes its work (regardless of success or failure).

```jsonc
{
  "type": "agent.completed",
  "data": {
    "name": "service-eng",
    "result": "success"            // "success" | "failed" | "terminated"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name. |
| `result` | string | Outcome of the agent's work. |

---

#### `agent.error`

Emitted when an agent encounters an error during execution.

```jsonc
{
  "type": "agent.error",
  "data": {
    "name": "service-eng",
    "error": "TypeError: Cannot read properties of undefined (reading 'id')",
    "file": "src/api/service.ts",
    "line": 42,
    "resolved": true               // whether the agent resolved it via error recovery protocol
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name. |
| `error` | string | Error message. |
| `file` | string or null | File where the error occurred, if applicable. |
| `line` | number or null | Line number, if applicable. |
| `resolved` | boolean | Whether the agent successfully resolved the error. |

---

#### `file.created`

Emitted when an agent creates a new file.

```jsonc
{
  "type": "file.created",
  "data": {
    "path": "src/api/service.ts",
    "reason": "Task #2 — API service implementation"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Relative path from repository root. |
| `reason` | string | Why this file was created (task reference + brief purpose). |

---

#### `file.modified`

Emitted when an agent modifies an existing file.

```jsonc
{
  "type": "file.modified",
  "data": {
    "path": "src/api/routes.ts",
    "reason": "Task #2 — added auth endpoints"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Relative path from repository root. |
| `reason` | string | Why this file was modified (task reference + brief description). |

---

#### `branch.created`

Emitted when a new git branch is created.

```jsonc
{
  "type": "branch.created",
  "data": {
    "name": "work/auth-system/api-service",
    "parent": "feature/auth-system"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full branch name. |
| `parent` | string | Branch this was created from. |

---

#### `branch.merged`

Emitted when a branch is merged into another.

```jsonc
{
  "type": "branch.merged",
  "data": {
    "name": "work/auth-system/api-service",
    "target": "feature/auth-system",
    "conflicts": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Branch that was merged (source). |
| `target` | string | Branch it was merged into (destination). |
| `conflicts` | boolean | Whether merge conflicts occurred (and were resolved). |

---

#### `branch.pulled`

Emitted when a branch is updated from its remote or parent.

```jsonc
{
  "type": "branch.pulled",
  "data": {
    "branch": "feature/auth-system",
    "behind": 3,
    "ahead": 12
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch that was pulled/updated. |
| `behind` | number | Number of commits the branch was behind before the pull. |
| `ahead` | number | Number of commits the branch is ahead of the remote after the pull. |

---

#### `branch.rebased`

Emitted when a branch is rebased onto another.

```jsonc
{
  "type": "branch.rebased",
  "data": {
    "branch": "work/auth-system/api-service",
    "onto": "feature/auth-system",
    "conflicts": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch that was rebased. |
| `onto` | string | Target branch it was rebased onto. |
| `conflicts` | boolean | Whether rebase conflicts occurred (and were resolved). |

---

### Quality Events

These track QA review rounds and automated checks.

---

#### `qa.started`

Emitted when a QA review round begins for a task.

```jsonc
{
  "type": "qa.started",
  "data": {
    "taskId": "2",
    "round": 1,                    // QA round number (1-3)
    "reviewer": "qa-task-2"        // QA agent name
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task being reviewed. |
| `round` | number | QA round number (max 3 rounds per task). |
| `reviewer` | string | Name of the QA agent performing the review. |

---

#### `qa.passed`

Emitted when a QA review round passes.

```jsonc
{
  "type": "qa.passed",
  "data": {
    "taskId": "2",
    "round": 1,
    "summary": "All checks pass. Code follows conventions. Docs updated."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task that passed review. |
| `round` | number | Which QA round passed. |
| `summary` | string | Brief summary of the QA result. |

---

#### `qa.failed`

Emitted when a QA review round fails.

```jsonc
{
  "type": "qa.failed",
  "data": {
    "taskId": "2",
    "round": 1,
    "issues": [
      "Missing input validation on POST /api/auth/login",
      "Type assertion used instead of type guard in service.ts:87",
      "No error handling for database connection failure"
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task that failed review. |
| `round` | number | Which QA round failed. |
| `issues` | array | List of issue descriptions found by the reviewer. |

---

#### `check.ran`

Emitted when an automated check command is executed (lint, typecheck, test, build).

```jsonc
{
  "type": "check.ran",
  "data": {
    "command": "npm run typecheck",
    "result": "pass",              // "pass" | "fail"
    "output_summary": "No errors found"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | The exact command that was run. |
| `result` | string | `"pass"` or `"fail"`. |
| `output_summary` | string | Truncated summary of command output (keep under 200 chars). |

---

### Issue Events

These track problems encountered during execution.

---

#### `error.encountered`

Emitted when any error is encountered during task execution. Complements the error recovery protocol.

```jsonc
{
  "type": "error.encountered",
  "data": {
    "file": "src/api/service.ts",
    "line": 42,
    "error": "TypeError: Cannot read properties of undefined (reading 'id')",
    "attempts": 2,
    "resolved": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `file` | string or null | File where the error occurred. |
| `line` | number or null | Line number. |
| `error` | string | Error message or description. |
| `attempts` | number | How many fix attempts were made (max 2 per error recovery protocol). |
| `resolved` | boolean | Whether the error was resolved. |

---

#### `blocker.reported`

Emitted when an agent reports a blocking issue to the team leader.

```jsonc
{
  "type": "blocker.reported",
  "data": {
    "description": "Database migration requires schema from Task #1 which has not been merged yet",
    "agent": "service-eng",
    "task": "2"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Human-readable description of the blocker. |
| `agent` | string | Agent that reported the blocker. |
| `task` | string | Task ID affected by the blocker. |

---

#### `warning.logged`

Emitted for non-blocking issues that should be noted but do not stop execution.

```jsonc
{
  "type": "warning.logged",
  "data": {
    "message": "Existing test file has 3 skipped tests — not introduced by this task",
    "context": "self-review phase, task #2"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Warning message. |
| `context` | string | Where in the workflow the warning was observed. |

---

### Monitoring Events

These track tool usage and resource consumption.

---

#### `tool.invoked`

Emitted when a significant tool call is made. Not every tool call needs to be logged — focus on file operations, git commands, and external commands.

```jsonc
{
  "type": "tool.invoked",
  "data": {
    "tool": "Bash",
    "target": "npm run test",
    "duration_ms": 4523
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name (e.g., `"Bash"`, `"Read"`, `"Edit"`, `"Write"`). |
| `target` | string | What the tool operated on (command, file path, etc.). |
| `duration_ms` | number | How long the tool call took in milliseconds. |

---

#### `context.usage`

Emitted periodically to track context window consumption per agent.

```jsonc
{
  "type": "context.usage",
  "data": {
    "agent": "service-eng",
    "tokens_used": 45000,
    "tokens_limit": 200000,
    "percent": 22.5
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `agent` | string | Agent name (or `"team-leader"`). |
| `tokens_used` | number | Approximate tokens consumed so far. |
| `tokens_limit` | number | Context window limit for this agent. |
| `percent` | number | Percentage of context consumed (`tokens_used / tokens_limit * 100`). |

---

## Complete Event Type Index

| Category | Type | Data Fields |
|----------|------|-------------|
| Lifecycle | `session.start` | `command`, `feature`, `branch`, `mode` |
| Lifecycle | `session.end` | `reason`, `duration_s`, `tasks_completed` |
| Lifecycle | `plan.created` | `tasks`, `waves`, `dependencies` |
| Lifecycle | `plan.updated` | `change`, `reason` |
| Lifecycle | `checkpoint` | `label`, `branch`, `plan_step`, `resumable` |
| Work | `task.started` | `taskId`, `summary`, `agent`, `files` |
| Work | `task.completed` | `taskId`, `summary`, `files_changed` |
| Work | `task.failed` | `taskId`, `error`, `attempts` |
| Work | `agent.spawned` | `name`, `role`, `task`, `branch` |
| Work | `agent.completed` | `name`, `result` |
| Work | `agent.error` | `name`, `error`, `file`, `line`, `resolved` |
| Work | `file.created` | `path`, `reason` |
| Work | `file.modified` | `path`, `reason` |
| Work | `branch.created` | `name`, `parent` |
| Work | `branch.merged` | `name`, `target`, `conflicts` |
| Work | `branch.pulled` | `branch`, `behind`, `ahead` |
| Work | `branch.rebased` | `branch`, `onto`, `conflicts` |
| Quality | `qa.started` | `taskId`, `round`, `reviewer` |
| Quality | `qa.passed` | `taskId`, `round`, `summary` |
| Quality | `qa.failed` | `taskId`, `round`, `issues` |
| Quality | `check.ran` | `command`, `result`, `output_summary` |
| Issue | `error.encountered` | `file`, `line`, `error`, `attempts`, `resolved` |
| Issue | `blocker.reported` | `description`, `agent`, `task` |
| Issue | `warning.logged` | `message`, `context` |
| Monitoring | `tool.invoked` | `tool`, `target`, `duration_ms` |
| Monitoring | `context.usage` | `agent`, `tokens_used`, `tokens_limit`, `percent` |

---

## Concurrency and File Safety

JSONL is append-only by design. Each line is a complete, self-contained JSON object. This provides natural concurrency safety under the following constraints:

- **Line size limit**: Keep each JSON line under 4KB. At this size, POSIX `write()` calls are atomic on most filesystems, meaning parallel appends from multiple processes will not interleave within a single line.
- **No file locking required**: Because appends are atomic under the 4KB threshold, multiple agents or sessions can safely append to the same `events.jsonl` file without coordination.
- **Session isolation**: Use the `sid` field to filter events from a specific session. Even if multiple sessions write to the same file, each session's events are identifiable.
- **Ordering**: Within a single session, `seq` provides total ordering. Across sessions, `ts` provides approximate ordering (subject to clock precision).

### File Location

Events are stored at:

```
.claude/progress/<feature-slug>/events.jsonl
```

One file per feature. All sessions working on the same feature append to the same file.

---

## Example: Complete Session

A minimal complete session producing 8 events:

```jsonl
{"v":1,"ts":"2026-02-14T10:00:00.000Z","sid":"a1b2c3d4","seq":0,"type":"session.start","feature":"auth-system","agent":null,"pane_id":null,"data":{"command":"implement","feature":"auth-system","branch":"feature/auth-system","mode":"strict"}}
{"v":1,"ts":"2026-02-14T10:00:05.200Z","sid":"a1b2c3d4","seq":1,"type":"plan.created","feature":"auth-system","agent":null,"pane_id":null,"data":{"tasks":[{"id":"1","summary":"Design schema","agent":"schema-designer"}],"waves":[{"wave":1,"task_ids":["1"]}],"dependencies":[]}}
{"v":1,"ts":"2026-02-14T10:00:10.500Z","sid":"a1b2c3d4","seq":2,"type":"agent.spawned","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"schema-designer","role":"Standard Coding Agent","task":"1","branch":"work/auth-system/schema-design"}}
{"v":1,"ts":"2026-02-14T10:00:11.000Z","sid":"a1b2c3d4","seq":3,"type":"task.started","feature":"auth-system","agent":"schema-designer","pane_id":null,"data":{"taskId":"1","summary":"Design schema","agent":"schema-designer","files":["src/db/schema.ts"]}}
{"v":1,"ts":"2026-02-14T10:05:30.000Z","sid":"a1b2c3d4","seq":4,"type":"task.completed","feature":"auth-system","agent":"schema-designer","pane_id":null,"data":{"taskId":"1","summary":"Design schema","files_changed":["src/db/schema.ts","src/db/migrations/001.ts"]}}
{"v":1,"ts":"2026-02-14T10:05:31.000Z","sid":"a1b2c3d4","seq":5,"type":"agent.completed","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"schema-designer","result":"success"}}
{"v":1,"ts":"2026-02-14T10:05:35.000Z","sid":"a1b2c3d4","seq":6,"type":"checkpoint","feature":"auth-system","agent":null,"pane_id":null,"data":{"label":"wave-1-complete","branch":"feature/auth-system","plan_step":"guardian-check","resumable":true}}
{"v":1,"ts":"2026-02-14T10:05:42.000Z","sid":"a1b2c3d4","seq":7,"type":"session.end","feature":"auth-system","agent":null,"pane_id":null,"data":{"reason":"completed","duration_s":342,"tasks_completed":1}}
```
