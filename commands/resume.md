---
description: "Crash recovery — scans progress files, detects errors and blockers, auto-resumes or presents options to user"
---

# /resume — Resume an In-Progress Feature

> Invoke this skill to find and resume a previously started (or crashed) feature implementation. Scans progress files, shows status, and picks up where the last session left off.

---

## When to Use

- Your terminal closed or timed out during `/new-feature`
- You want to continue a feature started in a previous session
- You're unsure if a feature was completed or left in-progress

---

## Phase 1: Scan for In-Progress Features

Scan the progress directory for feature directories with JSONL event logs:

```bash
# List all feature progress directories
ls the progress directory/*/events.jsonl 2>/dev/null

# Check for active workbranches
git branch --list "work/*"

# Check for feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/ 2>/dev/null

# Check for existing worktrees
git worktree list
```

For each feature directory with events.jsonl, read the events to determine state.

If `current.md` exists, read it for a quick summary. Otherwise, scan events.jsonl to extract:
- Feature name (from event envelope)
- Status (check for session.end event — if absent, feature is in-progress)
- Task counts (count task.completed vs task.started events)
- Last checkpoint
- Last event timestamp

---

## Phase 2: Present Options

### No progress files found

```
No in-progress features found in the progress directory.

To start a new feature, run:
  /new-feature "your feature description"
```

Stop here.

### One in-progress feature found

Present a summary and ask to confirm:

```
Found in-progress feature:

  Feature:      <name>
  Status:       <status>
  Progress:     <N>/<total> tasks complete
  Current Wave: <wave number>
  Last Updated: <timestamp>
  Branch:       feature/<name>

Resume this feature?
```

Use AskUserQuestion:
- "Yes, resume" — proceed to Phase 3
- "No, start fresh" — suggest `/new-feature`

### Multiple in-progress features found

Present all and let the user pick:

```
Found <N> in-progress features:

  1. <name> — <status> — <N>/<total> tasks — last updated <timestamp>
  2. <name> — <status> — <N>/<total> tasks — last updated <timestamp>
  3. ...
```

Use AskUserQuestion with multiSelect: false to let the user pick one.

### All features are COMPLETE

```
All features in the progress directory are marked COMPLETE.

To start a new feature, run:
  /new-feature "your feature description"
```

Stop here.

---

## Phase 3: Load and Analyze State

Read the selected progress file in full. Then analyze the recovery state:

### 3a. Check Git State

```bash
# Verify feature branch exists
git branch --list "feature/<feature-name>"

# Check current branch
git branch --show-current

# Check for uncommitted work
git status

# List active workbranches for this feature
git branch --list "work/<feature-name>/*"

# List worktrees for this feature
git worktree list | grep "<worktreeDir>/<feature-name>"

# Check workbranch commit status
git log --oneline -3 work/<feature-name>/<task-slug>  # for each workbranch
```

### 3b. Check Team State

```bash
# Check if team still exists
ls ~/.claude/teams/<team-name>/ 2>/dev/null
```

If the team exists, run `TaskList` to get current task status.

### 3c. Identify Resume Point

Using the progress file's Branch Status table and Task Progress section, determine:

| Scenario | Resume Action |
|----------|--------------|
| Task has workbranch + commits + QA PASS | Merge the workbranch, remove worktree if exists |
| Task has workbranch + commits + QA FAIL | Re-spawn agent to fix issues (in existing worktree) |
| Task has workbranch + commits + no QA | Spawn QA reviewer (in existing worktree) |
| Task has workbranch + no commits | Re-spawn the coding agent (in existing worktree) |
| Task has no workbranch + not merged | Create workbranch + worktree + spawn agent |
| Task is COMPLETE + merged | Skip; remove worktree if lingering |
| All tasks COMPLETE + Guardian not run | Spawn Guardian |
| All tasks COMPLETE + Guardian PASS | Go to completion (Phase 9) |
| Worktree exists but branch merged in JSONL | Orphaned worktree — `git worktree remove` |
| Worktree missing but task in-progress | Recreate: `git worktree add <worktreeDir>/<feature>/<task>` |

### JSONL-Based Recovery (see RESUME-PROTOCOL.md)

1. Read events.jsonl backward from end
2. Find last `checkpoint` event
3. Check for `error.encountered`, `blocker.reported`, or `task.failed` events after the checkpoint
4. If no issues: auto-resume from checkpoint
5. If issues found: present to user with options

### Worktree Reconciliation

In addition to branch reconciliation, check worktree state:

```bash
git worktree list
```

| JSONL State | Worktree State | Action |
|---|---|---|
| Task merged | Worktree exists | `git worktree remove <path>` |
| Task in-progress | Worktree exists | Resume work in worktree |
| Task in-progress | Worktree missing | Recreate: `git worktree add <worktreeDir>/<feature>/<task>` |
| No record | Worktree exists | Orphaned — warn user, do not auto-delete |

---

## Phase 4: Resume Execution

### 4a. Recreate Team if Needed

If the team no longer exists but tasks remain:

```
1. TeamCreate — team_name: "<feature-name>"
2. TaskCreate — recreate remaining tasks from progress file
3. TaskUpdate — set dependencies from progress file's dependency graph
```

### 4b. Load Context

Read the same files as `/new-feature` Phase 1:

```
1. the project rules file
2. the architecture file
3. prompts/implementing-features/README.md
4. prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md
5. prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
6. prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md
```

Also read the workflow mode from the progress file (if recorded) and load:
- `prompts/implementing-features/WORKFLOW-MODES.md`

### 4c. Resume from Identified Point

Switch to the feature branch and continue from the resume point identified in Phase 3c.

```bash
git checkout feature/<feature-name>
```

Update the progress file:
```markdown
**Last Updated**: <current timestamp>
**Updated By**: resume-session
```

Add a recovery note:
```markdown
## Recovery Notes

### <timestamp> — Session Recovery
- Previous session ended: <last updated from progress file>
- Resumed from: <task/phase description>
- State on recovery: <brief description of git/team state>
```

Then follow the `/new-feature` workflow from the appropriate phase (Phase 6, 7, 8, or 9).
