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
ls {{PROGRESS_DIR}}/
```

If multiple progress files exist, identify the active one:
- Look for files with Status other than COMPLETE
- If multiple are in-progress, present the most recently updated one

If no progress files exist:
```
No active features found.

To start a new feature:  /implement-feature "description"
To discover agents:      /discover-agents
```

Stop here.

---

## Phase 2: Parse Progress File

Read the progress file and extract:

- **Feature name** and **status**
- **Workflow mode** (if recorded)
- **Feature branch** name
- **Task list** with statuses
- **Wave status** (if wave status table exists)
- **QA results** summary
- **Branch status** — which workbranches exist, which are merged
- **Blockers** — any active blockers
- **Timestamps** — started, last updated

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
Tasks complete / Tasks total × 20 characters

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
