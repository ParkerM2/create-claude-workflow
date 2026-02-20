---
description: "Quick progress summary — shows completion percentage, task states, branch status, and active blockers"
---

# /status — Show Feature Implementation Progress

> Invoke this skill to see a formatted summary of the active feature's progress. Quick at-a-glance view without reading the full progress file.

---

## When to Use

- You want a quick overview of where a feature stands
- You need to check how many tasks are complete vs remaining
- You want to see QA results and blocker status
- You're returning to a session and want to orient yourself

---

## Phase 1: Find Active Feature

Scan for the active feature progress file:

```bash
# List progress files
ls the progress directory/
```

If multiple progress files exist, identify the active one:
- Look for files with Status other than COMPLETE
- If multiple are in-progress, present the most recently updated one

If no progress files exist:
```
No active features found in .claude/progress/.

To start a new feature:  /new-feature "description"
To discover agents:      /new (discover mode)
```

Stop here.

---

## Phase 2: Parse Progress File

Read the feature's tracking data. First check for `current.md` (pre-rendered summary):

```bash
# Quick path — read pre-rendered summary
cat the progress directory/<feature>/current.md
```

If `current.md` exists and is recent (< 5 minutes old), display it directly.

If stale or missing, regenerate from `events.jsonl`:
1. Read `the progress directory/<feature>/events.jsonl`
2. Extract: feature name, status, tasks, blockers, last checkpoint, timestamps
3. Render the summary below

Data to extract from events:
- **Feature name** — from event `feature` field
- **Status** — COMPLETE if `session.end` exists, else IN_PROGRESS
- **Task list** with statuses — from `task.started`/`task.completed`/`task.failed` events
- **QA results** — from `qa.passed`/`qa.failed` events
- **Branch status** — from `branch.created`/`branch.merged` events
- **Blockers** — from `blocker.reported` events (check if resolved)
- **Timestamps** — first and last event timestamps

---

## Phase 3: Display Summary

Format and display the summary:

```
═══════════════════════════════════════════════════════════
  FEATURE STATUS: <Feature Name>
═══════════════════════════════════════════════════════════

  Status:    <STATUS>
  Mode:      <strict|standard|fast>
  Branch:    feature/<feature-name>
  Started:   <date>
  Updated:   <date>

  ─── Progress ───────────────────────────────────────────

  Tasks:     ██████████░░░░░░░░░░  3/6 complete
  Waves:     Wave 2 of 4 in progress

  #1  Define types            COMPLETE  ✓  QA PASS (round 1)
  #2  Implement service       COMPLETE  ✓  QA PASS (round 2)
  #3  Create API handlers     COMPLETE  ✓  QA PASS (round 1)
  #4  Build state management  QA_REVIEW ●  QA round 1 in progress
  #5  Create UI components    PENDING   ○  blocked by #4
  #6  Integration tests       PENDING   ○  blocked by #5

  ─── Branches ───────────────────────────────────────────

  work/<feature>/state-mgmt     IN_PROGRESS  (not yet merged)
  work/<feature>/schema         MERGED       ✓
  work/<feature>/service        MERGED       ✓
  work/<feature>/api-handlers   MERGED       ✓

  ─── Blockers ───────────────────────────────────────────

  None

  ─── Guardian ───────────────────────────────────────────

  Not yet run (waiting for all tasks to complete)

═══════════════════════════════════════════════════════════
```

### Progress Bar

Build the progress bar from task counts:

```
Tasks complete / Tasks total x 20 characters

Example: 3/6 = 10 filled + 10 empty
██████████░░░░░░░░░░  3/6 complete
```

### Status Icons

| Status | Icon |
|--------|------|
| COMPLETE | ✓ |
| IN_PROGRESS / QA_REVIEW | ● |
| PENDING | ○ |
| FAILED | ✗ |

### If Blockers Exist

```
  ─── Blockers ───────────────────────────────────────────

  ⚠ Task #4 failed QA round 3 — escalated to user
    Issue: Missing error handling in state-mgmt module
    Affected: Task #5, #6 (blocked)
```

### If Guardian Has Run

```
  ─── Guardian ───────────────────────────────────────────

  Guardian Check: PASS ✓
  Checks passed: 7/7
  Ready for PR
```

Or:

```
  ─── Guardian ───────────────────────────────────────────

  Guardian Check: FAIL ✗
  Checks passed: 5/7
  Failed: Module Completeness, Documentation Coherence
  Action needed: fix issues and re-run Guardian
```
