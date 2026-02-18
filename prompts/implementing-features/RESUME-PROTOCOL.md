# Resume Protocol

> JSONL-based crash recovery flow. When a session is interrupted (crash, timeout, user kill), this protocol detects the interruption, reconstructs state from the event log, and resumes work from the last safe point.

---

## Overview

```
Detect Interruption
        |
        v
Analyze JSONL Events
        |
        v
Find Last Checkpoint
        |
        v
Check for Post-Checkpoint Issues
        |
        +--- No issues -------> Auto-Resume from Checkpoint
        |
        +--- Issues found ----> Present to User
                                    |
                                    +--- A. Fix & restart from before error
                                    +--- B. Continue past it
                                    +--- C. User provides custom input
```

---

## Phase 1: Detection

Detect whether a previous session was interrupted before completing normally.

### Scan for Feature Directories

Look for active feature progress directories:

```bash
ls .claude/progress/
# Expected: one directory per feature
# Example: auth-system/  payment-flow/  user-dashboard/
```

Each directory should contain an `events.jsonl` file.

### Check for Missing `session.end`

For each feature directory, read `events.jsonl` and check the most recent session:

```
1. Find all unique session IDs (sid values)
2. For each session (most recent first):
   a. Find the session.start event
   b. Check if a matching session.end event exists
   c. If session.end is MISSING → this session was interrupted
   d. If session.end exists → session completed normally, skip
```

#### Reading Backward for Efficiency

For large JSONL files, read from the end of the file to find the most recent session quickly:

```js
// Pseudocode: read last N lines to find recent session info
const lines = readFileLines('.claude/progress/auth-system/events.jsonl');
const reversed = lines.reverse();

let lastSessionId = null;
let hasSessionEnd = false;

for (const line of reversed) {
  const event = JSON.parse(line);
  if (!lastSessionId) {
    lastSessionId = event.sid;
  }
  if (event.sid !== lastSessionId) {
    break; // reached a different session, stop
  }
  if (event.type === 'session.end') {
    hasSessionEnd = true;
    break;
  }
}

if (!hasSessionEnd) {
  // Session was interrupted — proceed to Phase 2
}
```

### Multiple Interrupted Sessions

It is possible (though unlikely) for multiple sessions to have been interrupted. Process them in reverse chronological order — the most recent interrupted session is the one to resume.

---

## Phase 2: Analysis

Reconstruct the state of the interrupted session from the JSONL event log.

### Isolate Session Events

Filter all events by the interrupted session's `sid`:

```js
const sessionEvents = allEvents.filter(e => e.sid === interruptedSid);
```

Verify continuity using `seq` numbers. If there are gaps (e.g., seq jumps from 14 to 17), note the gap — some events were lost, likely due to a crash during a write.

### Find Last Checkpoint

Scan for the most recent `checkpoint` event in the session:

```js
const checkpoints = sessionEvents.filter(e => e.type === 'checkpoint');
const lastCheckpoint = checkpoints[checkpoints.length - 1];
// lastCheckpoint.data => { label, branch, plan_step, resumable }
```

If no checkpoint exists, the session was interrupted very early (during planning or the first task). In this case, resume from the beginning.

### Reconstruct Task State

Build a task status map from `task.started`, `task.completed`, and `task.failed` events:

```js
const taskState = {};

for (const event of sessionEvents) {
  switch (event.type) {
    case 'task.started':
      taskState[event.data.taskId] = {
        status: 'IN_PROGRESS',
        agent: event.data.agent,
        files: event.data.files
      };
      break;
    case 'task.completed':
      taskState[event.data.taskId] = {
        status: 'COMPLETE',
        files_changed: event.data.files_changed
      };
      break;
    case 'task.failed':
      taskState[event.data.taskId] = {
        status: 'FAILED',
        error: event.data.error,
        attempts: event.data.attempts
      };
      break;
  }
}
```

**Result**: A map of task IDs to their last known state. Tasks in `IN_PROGRESS` were interrupted mid-execution.

### Identify Active Agents

Find agents that were spawned but never completed:

```js
const spawned = new Set();
const completed = new Set();

for (const event of sessionEvents) {
  if (event.type === 'agent.spawned') spawned.add(event.data.name);
  if (event.type === 'agent.completed') completed.add(event.data.name);
}

const activeAgents = [...spawned].filter(name => !completed.has(name));
// These agents were running when the session was interrupted
```

### Check for Post-Checkpoint Issues

Collect all issue events that occurred after the last checkpoint:

```js
const lastCheckpointSeq = lastCheckpoint ? lastCheckpoint.seq : -1;

const postCheckpointIssues = sessionEvents.filter(e =>
  e.seq > lastCheckpointSeq && (
    e.type === 'error.encountered' ||
    e.type === 'blocker.reported' ||
    e.type === 'task.failed'
  )
);
```

Also collect warnings for context:

```js
const postCheckpointWarnings = sessionEvents.filter(e =>
  e.seq > lastCheckpointSeq && e.type === 'warning.logged'
);
```

---

## Phase 3: Decision Flow

Based on the analysis, determine how to proceed.

### Case A: No Issues After Last Checkpoint

**Condition**: `postCheckpointIssues.length === 0` and a valid checkpoint exists.

**Action**: Auto-resume from the checkpoint without user intervention.

```
Auto-Resume:
  1. Checkpoint "wave-1-complete" found
  2. No errors, blockers, or failures after checkpoint
  3. Next step: wave-2-start
  4. Proceeding automatically...
```

This is the happy path. The session was interrupted at a clean point (e.g., between waves, after a merge).

### Case B: Issues Found After Last Checkpoint

**Condition**: `postCheckpointIssues.length > 0`

**Action**: Present the issues to the user and ask for direction.

```
Resume Analysis for feature "auth-system":
=============================================

Last checkpoint: "wave-1-complete" (seq 42)

Issues found after checkpoint:
  1. [error.encountered] src/api/service.ts:42 — TypeError (resolved: false)
  2. [task.failed] Task #2 — QA failed 3 rounds (attempts: 3)

Active agents at interruption:
  - service-eng (Task #2, branch: work/auth-system/api-service)

Options:
  A. Fix the problem, restart Task #2 from scratch
  B. Continue past it — skip Task #2, proceed to next wave
  C. Provide custom instructions

Your choice:
```

#### Option A: Fix and Restart

Roll back to the checkpoint state and re-attempt:

```
1. Verify git branch matches checkpoint branch
2. Reset task state for affected tasks
3. Re-create workbranches from checkpoint branch HEAD
4. Re-spawn agents for affected tasks
```

#### Option B: Continue Past It

Skip the failed/errored tasks and proceed:

```
1. Mark affected tasks as SKIPPED
2. Update plan — remove dependencies on skipped tasks if possible
3. Warn if skipping creates unresolvable dependency gaps
4. Proceed to next planned step
```

#### Option C: User Custom Input

Accept freeform instructions from the user:

```
1. Display full context (task state, errors, branch state)
2. Accept user input describing how to proceed
3. Incorporate user instructions into the resumed plan
```

### Case C: No Checkpoint Found

**Condition**: No `checkpoint` event exists in the session.

**Action**: The session was interrupted during planning or the very first task. Present state to the user.

```
Resume Analysis for feature "auth-system":
=============================================

No checkpoint found — session interrupted during early execution.

Session state:
  - Plan created: yes
  - Tasks started: 1 (Task #1 — IN_PROGRESS)
  - Tasks completed: 0

Recommendation: Restart feature implementation from the beginning.
The plan from the interrupted session is available for reference.

Options:
  A. Restart from scratch (reuse existing plan)
  B. Restart from scratch (create new plan)
  C. Provide custom instructions

Your choice:
```

---

## Phase 4: Resume Actions

Execute the chosen resume path.

### Emit Resume Session Start

Every resumed session begins with a `session.start` event indicating it is a resume:

```jsonc
{
  "type": "session.start",
  "data": {
    "command": "resume",
    "feature": "auth-system",
    "branch": "feature/auth-system",
    "mode": "strict"
  }
}
```

The `"command": "resume"` value distinguishes resumed sessions from fresh ones in the event log.

### Verify Team State

Check if the team from the interrupted session still exists:

```bash
# Check for team configuration
ls ~/.claude/teams/<team-name>/config.json
```

If the team exists, reuse it. If not, recreate it with the same team name:

```
1. TeamCreate with the original team name
2. TaskCreate for all tasks (using reconstructed task state)
3. TaskUpdate to set status for already-completed tasks
4. TaskUpdate to set dependencies
```

### Verify Git Branch State

Confirm the repository matches what the JSONL expects:

```bash
# 1. Check current branch
git branch --show-current

# 2. Check if feature branch exists
git branch --list "feature/<feature-name>"

# 3. Check for leftover workbranches from the interrupted session
git branch --list "work/<feature-name>/*"

# 4. Check for uncommitted changes
git status
```

**Branch reconciliation**:

| JSONL State | Git State | Action |
|-------------|-----------|--------|
| Branch merged per JSONL | Branch still exists in git | Safe — branch was merged but not deleted. Delete it. |
| Branch merged per JSONL | Branch does not exist | Expected state. No action. |
| Branch IN_PROGRESS per JSONL | Branch exists with commits | Resume work on this branch. |
| Branch IN_PROGRESS per JSONL | Branch does not exist | Branch was lost. Recreate from feature branch and restart task. |
| No branch record in JSONL | Branch exists in git | Orphaned branch. Warn user, do not auto-delete. |

### Verify Worktree State

If worktrees are enabled (`useWorktrees: true` in config), check for existing worktrees:

```bash
git worktree list
```

**Worktree reconciliation**:

| JSONL State | Git Worktree State | Action |
|---|---|---|
| Task merged | Worktree exists | `git worktree remove <path>` — orphaned worktree |
| Task in-progress | Worktree exists | Resume in existing worktree |
| Task in-progress | Worktree missing | Recreate: `git worktree add <worktreeDir>/<feature>/<task>` |
| No record | Worktree exists | Orphaned — warn user, do not auto-delete |

### Continue from Resume Point

Based on the decision from Phase 3:

```
1. Identify the next planned step (from checkpoint.data.plan_step or reconstructed state)
2. Create any needed workbranches from the current feature branch HEAD
3. Spawn agents for tasks that need to be (re)started
4. Emit task.started events for resumed tasks
5. Monitor and proceed as normal
```

---

## Reading JSONL Efficiently

### Line-by-Line Parsing

JSONL files should be read line by line. Each line is an independent JSON object:

```js
const fs = require('fs');
const readline = require('readline');

async function readEvents(filePath) {
  const events = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    const trimmed = line.trim();
    if (!trimmed) continue; // skip empty lines

    try {
      events.push(JSON.parse(trimmed));
    } catch (err) {
      // Handle malformed lines gracefully — log and skip
      console.warn(`Malformed JSON at line ${lineNumber}, skipping: ${err.message}`);
    }
  }

  return events;
}
```

### Filtering by Session ID

To isolate events from a specific session:

```js
function getSessionEvents(events, sid) {
  return events.filter(e => e.sid === sid);
}
```

### Detecting Sequence Gaps

Check for missing events using `seq` numbers:

```js
function detectGaps(sessionEvents) {
  const sorted = sessionEvents.sort((a, b) => a.seq - b.seq);
  const gaps = [];

  for (let i = 1; i < sorted.length; i++) {
    const expected = sorted[i - 1].seq + 1;
    const actual = sorted[i].seq;
    if (actual !== expected) {
      gaps.push({
        after_seq: sorted[i - 1].seq,
        expected_seq: expected,
        actual_seq: actual,
        missing_count: actual - expected
      });
    }
  }

  return gaps;
}
```

If gaps are detected, they indicate events were lost (likely due to a crash during write). The resume process should note the gaps but proceed — the reconstructed state may be incomplete, but checkpoints provide a known-good anchor point.

### Finding All Sessions

Extract all unique session IDs and their time ranges:

```js
function listSessions(events) {
  const sessions = {};

  for (const event of events) {
    if (!sessions[event.sid]) {
      sessions[event.sid] = {
        sid: event.sid,
        first_ts: event.ts,
        last_ts: event.ts,
        event_count: 0,
        has_end: false
      };
    }

    const session = sessions[event.sid];
    session.event_count++;
    session.last_ts = event.ts;

    if (event.type === 'session.end') {
      session.has_end = true;
    }
  }

  return Object.values(sessions);
}
```

### Handling Malformed Lines

JSONL files can become corrupted if a crash occurs mid-write. Handle this defensively:

- **Empty lines**: Skip silently.
- **Truncated JSON**: The last line may be incomplete if the process was killed mid-write. Log a warning and skip.
- **Non-JSON content**: Skip with a warning. Do not abort the entire read.
- **Duplicate sequence numbers**: If two events have the same `sid` and `seq`, keep the last one (later file position wins).

---

## Resume Checklist

A quick-reference checklist for the resume flow:

```
RESUME CHECKLIST
================

Detection:
  [ ] Scanned .claude/progress/ for feature directories
  [ ] Found events.jsonl for each feature
  [ ] Identified sessions missing session.end events
  [ ] Selected most recent interrupted session

Analysis:
  [ ] Filtered events by interrupted session ID
  [ ] Checked seq continuity (noted any gaps)
  [ ] Found last checkpoint event (or noted absence)
  [ ] Reconstructed task state (started/completed/failed)
  [ ] Identified active agents at interruption
  [ ] Collected post-checkpoint issues

Decision:
  [ ] No issues → auto-resume path selected
  [ ] Issues found → presented to user with options A/B/C
  [ ] No checkpoint → presented full state to user

Execution:
  [ ] Emitted session.start with command: "resume"
  [ ] Verified/recreated team in ~/.claude/teams/
  [ ] Verified git branch state matches JSONL state
  [ ] Reconciled any branch mismatches
  [ ] Verified worktree state matches JSONL state
  [ ] Reconciled any worktree mismatches (removed orphaned, recreated missing)
  [ ] Identified resume point (next planned step)
  [ ] Created workbranches as needed
  [ ] Spawned agents for tasks to (re)start
  [ ] Monitoring resumed — proceeding normally
```

---

## Example: Full Resume Scenario

### Interrupted Session JSONL

```jsonl
{"v":1,"ts":"2026-02-14T10:00:00.000Z","sid":"f4e3d2c1","seq":0,"type":"session.start","feature":"auth-system","agent":null,"pane_id":null,"data":{"command":"implement","feature":"auth-system","branch":"feature/auth-system","mode":"strict"}}
{"v":1,"ts":"2026-02-14T10:00:05.000Z","sid":"f4e3d2c1","seq":1,"type":"plan.created","feature":"auth-system","agent":null,"pane_id":null,"data":{"tasks":[{"id":"1","summary":"Design schema","agent":"schema-designer"},{"id":"2","summary":"Build API","agent":"service-eng"}],"waves":[{"wave":1,"task_ids":["1"]},{"wave":2,"task_ids":["2"]}],"dependencies":[{"task_id":"2","blocked_by":"1"}]}}
{"v":1,"ts":"2026-02-14T10:01:00.000Z","sid":"f4e3d2c1","seq":2,"type":"agent.spawned","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"schema-designer","role":"Standard Coding Agent","task":"1","branch":"work/auth-system/schema-design"}}
{"v":1,"ts":"2026-02-14T10:01:01.000Z","sid":"f4e3d2c1","seq":3,"type":"task.started","feature":"auth-system","agent":"schema-designer","pane_id":null,"data":{"taskId":"1","summary":"Design schema","agent":"schema-designer","files":["src/db/schema.ts"]}}
{"v":1,"ts":"2026-02-14T10:06:00.000Z","sid":"f4e3d2c1","seq":4,"type":"task.completed","feature":"auth-system","agent":"schema-designer","pane_id":null,"data":{"taskId":"1","summary":"Design schema","files_changed":["src/db/schema.ts","src/db/migrations/001.ts"]}}
{"v":1,"ts":"2026-02-14T10:06:01.000Z","sid":"f4e3d2c1","seq":5,"type":"agent.completed","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"schema-designer","result":"success"}}
{"v":1,"ts":"2026-02-14T10:06:10.000Z","sid":"f4e3d2c1","seq":6,"type":"branch.merged","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"work/auth-system/schema-design","target":"feature/auth-system","conflicts":false}}
{"v":1,"ts":"2026-02-14T10:06:15.000Z","sid":"f4e3d2c1","seq":7,"type":"checkpoint","feature":"auth-system","agent":null,"pane_id":null,"data":{"label":"wave-1-complete","branch":"feature/auth-system","plan_step":"wave-2-start","resumable":true}}
{"v":1,"ts":"2026-02-14T10:06:20.000Z","sid":"f4e3d2c1","seq":8,"type":"agent.spawned","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"service-eng","role":"Standard Coding Agent","task":"2","branch":"work/auth-system/api-service"}}
{"v":1,"ts":"2026-02-14T10:06:21.000Z","sid":"f4e3d2c1","seq":9,"type":"task.started","feature":"auth-system","agent":"service-eng","pane_id":null,"data":{"taskId":"2","summary":"Build API","agent":"service-eng","files":["src/api/service.ts"]}}
{"v":1,"ts":"2026-02-14T10:08:00.000Z","sid":"f4e3d2c1","seq":10,"type":"error.encountered","feature":"auth-system","agent":"service-eng","pane_id":null,"data":{"file":"src/api/service.ts","line":42,"error":"Import path not found: ../db/schema","attempts":1,"resolved":true}}
```

Note: No `session.end` event. The session was interrupted while `service-eng` was working on Task #2.

### Resume Analysis

```
Detection:
  - Feature: auth-system
  - Session f4e3d2c1 has no session.end → INTERRUPTED
  - 11 events, seq 0-10, no gaps

Last checkpoint:
  - seq 7: "wave-1-complete"
  - Next step: wave-2-start

Post-checkpoint events:
  - seq 8: agent.spawned (service-eng)
  - seq 9: task.started (Task #2)
  - seq 10: error.encountered (resolved: true)

Task state:
  - Task #1: COMPLETE
  - Task #2: IN_PROGRESS (interrupted)

Active agents:
  - service-eng (spawned at seq 8, no agent.completed)

Decision:
  - Post-checkpoint error was resolved (resolved: true)
  - No unresolved errors, blockers, or failures
  - Auto-resume: restart Task #2 from wave-2-start
```

### Resumed Session JSONL

The new session appends to the same file:

```jsonl
{"v":1,"ts":"2026-02-14T11:00:00.000Z","sid":"b5a4c3d2","seq":0,"type":"session.start","feature":"auth-system","agent":null,"pane_id":null,"data":{"command":"resume","feature":"auth-system","branch":"feature/auth-system","mode":"strict"}}
{"v":1,"ts":"2026-02-14T11:00:05.000Z","sid":"b5a4c3d2","seq":1,"type":"agent.spawned","feature":"auth-system","agent":null,"pane_id":null,"data":{"name":"service-eng","role":"Standard Coding Agent","task":"2","branch":"work/auth-system/api-service"}}
{"v":1,"ts":"2026-02-14T11:00:06.000Z","sid":"b5a4c3d2","seq":2,"type":"task.started","feature":"auth-system","agent":"service-eng","pane_id":null,"data":{"taskId":"2","summary":"Build API","agent":"service-eng","files":["src/api/service.ts"]}}
```

The resumed session has a new `sid` (`b5a4c3d2`) and its own `seq` counter starting at 0. Both sessions coexist in the same JSONL file, distinguishable by their `sid` values.
