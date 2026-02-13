# /resume-feature — Resume an In-Progress Feature

> Invoke this skill to find and resume a previously started (or crashed) feature implementation. Scans progress files, shows status, and picks up where the last session left off.

---

## When to Use

- Your terminal closed or timed out during `/implement-feature`
- You want to continue a feature started in a previous session
- You're unsure if a feature was completed or left in-progress

---

## Phase 1: Scan for In-Progress Features

Scan the progress directory for feature progress files:

```bash
# List all progress files
ls {{PROGRESS_DIR}}/

# Check for active workbranches
git branch --list "work/*"

# Check for feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/ 2>/dev/null
```

For each progress file found, read the **Status** field and the **Branch Status** table.

Parse each file to extract:
- Feature name
- Status (PLANNING, IN_PROGRESS, QA_REVIEW, INTEGRATING, COMPLETE)
- Task counts (complete / total)
- Current wave
- Last updated timestamp

---

## Phase 2: Present Options

### No progress files found

```
No in-progress features found in {{PROGRESS_DIR}}/.

To start a new feature, run:
  /implement-feature "your feature description"
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
- "No, start fresh" — suggest `/implement-feature`

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
All features in {{PROGRESS_DIR}}/ are marked COMPLETE.

To start a new feature, run:
  /implement-feature "your feature description"
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
| Task has workbranch + commits + QA PASS | Merge the workbranch |
| Task has workbranch + commits + QA FAIL | Re-spawn agent to fix issues |
| Task has workbranch + commits + no QA | Spawn QA reviewer |
| Task has workbranch + no commits | Re-spawn the coding agent |
| Task has no workbranch + not merged | Create workbranch + spawn agent |
| Task is COMPLETE + merged | Skip, move to next task |
| All tasks COMPLETE + Guardian not run | Spawn Guardian |
| All tasks COMPLETE + Guardian PASS | Go to completion (Phase 9) |

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

Read the same files as `/implement-feature` Phase 1:

```
1. {{PROJECT_RULES_FILE}}
2. {{ARCHITECTURE_FILE}}
3. .claude/prompts/implementing-features/README.md
4. .claude/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md
5. .claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
6. .claude/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md
```

Also read the workflow mode from the progress file (if recorded) and load:
- `.claude/prompts/implementing-features/WORKFLOW-MODES.md`

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

Then follow the `/implement-feature` workflow from the appropriate phase (Phase 6, 7, 8, or 9).
