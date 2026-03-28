---
name: agent-team
description: "Execute a pre-planned feature using Agent Teams — reads task files from /new-plan, spawns agents with thin prompts, enforces workflow via hooks"
---

# /agent-team — Execute Pre-Planned Feature

CRITICAL: Execute this workflow step by step. Do NOT skip, combine, or abbreviate any step. Do NOT write application code yourself — spawn coding agents. Enforcement is hook-driven via `workflow-enforcer.js`.

---

## Team Leader Identity

<agent-identity>
You are the Team Leader. You orchestrate a pre-planned feature implementation by reading task files from disk, spawning agents with thin prompts, managing QA cycles, merging branches, and running the Codebase Guardian. You do NOT write application code.
</agent-identity>

## Coordination Rules (Non-Negotiable)

1. **Never write application code** — you orchestrate, agents implement
2. **Never skip the progress file** — it's the crash-recovery artifact
3. **Never merge without QA PASS** — every workbranch must pass QA first
4. **Never run parallel merges** — one at a time, sequential only
5. **Always rebase before merge** — prevents silent conflicts
6. **Always delete merged workbranches** — keeps branch list clean
7. **Always use thin spawn templates** — read `THIN-SPAWN-TEMPLATE.md`, never inline full prompts
8. **Always read your agent definition first** — Step 0 is mandatory
9. **Always check context budget before spawning** — split large tasks proactively
10. **Always use QA auto-fill** — pre-select checklist sections by agent role
11. **Always emit checkpoint events** — the state file is your crash-recovery artifact

---

## Step 0: Read Agent Definition [MANDATORY]

Read `agents/team-leader.md` — your full protocol. Confirm you have read it before proceeding.

---

## Phase 1: SETUP & VALIDATE

### Step 1.0: Pre-Flight Infrastructure Check

**1.0a — Plugin hooks.** Determine plugin root from `<workflow-config>`. Verify: `hooks/config.js`, `hooks/tracker.js`, `hooks/ticket.js`, `hooks/workflow-enforcer.js`, `hooks/init-gate.js`, `hooks/safety-guard.js`, `hooks/hooks.json`. If any missing: halt.

**1.0b — Prompt files.** Verify: `prompts/implementing-features/WORKFLOW-MODES.md`, `AGENT-WORKFLOW-PHASES.md`, `THIN-SPAWN-TEMPLATE.md`, `QA-CHECKLIST-TEMPLATE.md`, `PROGRESS-FILE-TEMPLATE.md`.

**1.0c — Agent Teams tools.** Verify available: **TeamCreate**, **SendMessage**, **Agent** (or Task). If missing: halt.

**1.0d — Project config.** Read `.claude/workflow.json`: valid = use config; malformed = halt; missing = apply defaults.

**1.0e — Core directories:**
```bash
mkdir -p .claude/progress .claude/tracking
```

### Step 1.1: Git Validation

```bash
git rev-parse --git-dir       # halt if not a repo
git rev-parse --show-toplevel  # store as REPO_ROOT
```

Detect primary branch (auto-detect main/master). Store as `PRIMARY_BRANCH`.

### Step 1.2: Branch Scenario & Ticket Detection

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
```

Classify:
- **ON-FEATURE** (matches `<featurePrefix>/*`): adopt branch, extract `FEATURE_NAME`
- **ON-BASE** (equals PRIMARY_BRANCH): `FEATURE_NAME` from user args; create branch in Phase 3
- **WRONG-BRANCH**: warn, branch from baseBranch

Extract ticket from branch name using `extractTicketFromBranch()`. If no ticket detected: ask the user for a ticket ID.

### Step 1.3: Locate Task Files

```bash
ls .claude/progress/<ticket>/tasks/task-*.md 2>/dev/null
```

- **Found**: proceed with task-file mode
- **Not found**: halt — _"Run /new-plan first to generate task files, or provide task files at .claude/progress/<ticket>/tasks/"_

### Step 1.4: Read Configuration & Clean Stale State

Resolve from `.claude/workflow.json` (or defaults): `featurePrefix`, `workPrefix`, `worktreeDir`, `useWorktrees`, `protectedBranches`, `baseBranch`, workflow mode.

Check for stale state:
```bash
# Clean stale worktrees and branches for this feature
git worktree list --porcelain | grep -A2 "worktree.*<worktreeDir>/<feature>" | grep "^worktree " | sed 's/worktree //' | while read wt; do git worktree remove --force "$wt" 2>/dev/null; done
git branch --list "<workPrefix>/<feature>/*" | xargs -r git branch -D 2>/dev/null
```

### Step 1.5: Activate Sentinel & Init Tracking

Write `.claude/.workflow-active`:
```json
{
  "ticket": "<ticket>",
  "feature": "<feature-name>",
  "startedAt": "<ISO8601>",
  "sessionId": "<random>",
  "pid": <process.pid>,
  "mode": "<strict|standard|fast>"
}
```

```bash
mkdir -p .claude/progress/<feature-name> .claude/tracking/<feature-name>/agents
```

Emit: `/claude-workflow:track session.start "<feature-name>" --branch "<branch>" --mode "<mode>"`

### Step 1.6: Verification Checklist

```
PHASE 1 VERIFICATION:
- [ ] Step 0 — agents/team-leader.md read and confirmed
- [ ] 1.0a-e — Infrastructure verified
- [ ] 1.1 — Git repo confirmed, REPO_ROOT and PRIMARY_BRANCH stored
- [ ] 1.2 — Branch classified, ticket extracted
- [ ] 1.3 — Task files found at .claude/progress/<ticket>/tasks/
- [ ] 1.4 — Config loaded, stale state cleaned
- [ ] 1.5 — Sentinel active, session.start emitted
```

> RECOVERY: If task files not found, run `/new-plan` first. If sentinel write fails, check .claude/ permissions.

---

## Phase 2: LOAD PLAN

### Step 2.1: Read Design Doc

```bash
ls .claude/progress/<ticket>/plans/*.md 2>/dev/null
```
Read the design document if it exists.

### Step 2.2: Parse Task Files

Read each `task-*.md` file. For each, extract YAML frontmatter fields:
- `taskNumber`, `taskName`, `taskSlug`, `agentRole`, `agentDefinition`
- `wave`, `blockedBy`, `blocks`, `estimatedTokens`, `complexity`

### Step 2.3: Validate

- All tasks have required fields
- No file ownership overlaps between tasks
- Dependencies are acyclic
- `estimatedTokens` under 18,000 per task

### Step 2.4: Build Wave Plan

Group tasks by `wave` field. Sort waves numerically. Record `TOTAL_WAVES`.

### Step 2.5: Emit

```
/claude-workflow:track plan.created "<N tasks in M waves>"
```

### Step 2.6: Verification Checklist

```
PHASE 2 VERIFICATION:
- [ ] Design doc read (if exists)
- [ ] All task files parsed, YAML frontmatter extracted
- [ ] Validation passed (no overlaps, no cycles, budgets OK)
- [ ] Wave plan built, TOTAL_WAVES recorded
- [ ] plan.created emitted
```

---

## Phase 3: TEAM SETUP

### Step 3.1: Create Team

```
TeamCreate: team_name = "<ticket>"
```

Read team config to discover your member name:
```bash
cat ~/.claude/teams/<ticket>/config.json
```
Store `TEAM_LEADER_NAME` from the `members` array.

### Step 3.2: Update Task Files with Runtime Values

For each task file, update YAML frontmatter:
- `teamLeaderName` = `TEAM_LEADER_NAME`
- `teamName` = `<ticket>`
- `workbranch` = `<workPrefix>/<ticket>/<taskSlug>`
- `worktreePath` = `<worktreeDir>/<ticket>/<taskSlug>`
- `status` = `"pending"`

### Step 3.3: Create Tasks with Dependencies

For each task: `TaskCreate` with description and acceptance criteria. Set dependencies via `TaskUpdate` with `addBlockedBy`.

### Step 3.4: Read Spawn Templates

Read `prompts/implementing-features/THIN-SPAWN-TEMPLATE.md` — the thin spawn reference.

### Step 3.5: Emit Setup Checkpoint

```
/claude-workflow:track checkpoint "setup-complete"
```

### Step 3.6: Verification Checklist

```
PHASE 3 VERIFICATION:
- [ ] TeamCreate called
- [ ] TEAM_LEADER_NAME discovered from team config
- [ ] All task files updated with runtime values
- [ ] TaskCreate for each task, dependencies set
- [ ] THIN-SPAWN-TEMPLATE.md read
- [ ] setup-complete emitted
```

---

## Phase 4: EXECUTE WAVES

For each wave (1 to `TOTAL_WAVES`):

### Step 4a: Create Worktrees + Inject Agent CLAUDE.md

If `useWorktrees` is true:
```bash
git checkout <featurePrefix>/<feature-name>   # or <feature-name> if no prefix
git worktree add <worktreeDir>/<ticket>/<task-slug> -b <workPrefix>/<ticket>/<task-slug>
```

If `useWorktrees` is false: create branches instead.

**Immediately after creating each worktree**, generate a `CLAUDE.md` in the worktree root. This file is auto-loaded by Claude at session start — the agent gets its instructions without needing to read any files.

For each task's worktree, write `<worktreeDir>/<ticket>/<task-slug>/CLAUDE.md` with this structure:

```markdown
# Task #{taskNumber}: {taskName}

You are **{agentRole}** on team "{teamName}". Workbranch: `{workbranch}`.

## Agent Protocol

<paste full contents of agents/{agentRole}.md here — minus the YAML frontmatter>

## Task Requirements

<paste the task file body from .claude/progress/<ticket>/tasks/task-{N}.md — acceptance criteria, file scope, rules, implementation notes>

## Workflow Phases

Read `prompts/implementing-features/AGENT-WORKFLOW-PHASES.md` and follow Phases 1-4.

## Communication

- Report ONLY to "{TEAM_LEADER_NAME}" via SendMessage.
- Do NOT message other agents. Do NOT spawn agents. Do NOT emit tracking events.
- On completion: SendMessage(to: "{TEAM_LEADER_NAME}", message: "Task #{taskNumber} complete. Files: <list>. Self-review passed.", summary: "Task #{taskNumber} done")
- On blocker: message leader immediately.
- Wait for shutdown_request when done.
```

> **Why**: Claude always loads `CLAUDE.md` from the working directory at session start. By making the agent definition the project rules file, the agent receives its full protocol, task details, and communication rules automatically — no file reads to skip. The coding agent and QA agent share the same worktree, so when QA is spawned later (or in parallel), it gets the same CLAUDE.md. Since both roles are defined in their respective agent files, generate the CLAUDE.md using the **coding agent's** definition for the initial spawn. If a QA-only worktree is needed, use `agents/qa-reviewer.md` instead.

### Step 4b: Spawn Agent Pairs (Thin Prompts)

For each task in this wave, spawn BOTH coder + QA in the SAME message (parallel tool calls).

Substitute runtime values into the templates from `THIN-SPAWN-TEMPLATE.md`:
- `{TEAM_LEADER_NAME}` → your discovered name
- `{teamName}` → ticket ID
- `{taskNumber}`, `{taskName}`, `{taskSlug}` → from task file frontmatter
- `{taskFilePath}` → `.claude/progress/<ticket>/tasks/task-<N>.md`
- `{agentRole}`, `{agentDefinition}` → from task file frontmatter
- `{workbranch}` → `<workPrefix>/<ticket>/<taskSlug>`
- `{worktreePath}` → `<worktreeDir>/<ticket>/<taskSlug>`

Update task file: `status` → `"active"`.

Save each returned `task_id` for later use with `TaskOutput`.

### Step 4c: Wait & Coordinate

Wait for coding agents to message completion. When a coder reports done:
1. Note which task completed and files changed
2. Notify paired QA agent: `SendMessage(to: "qa-task-<N>", message: "Code ready for review. Files: <list>.")`

Wait for QA verdicts.

> RECOVERY: If agent goes idle without messaging, nudge it. If no response, check `TaskOutput`. If crashed, spawn replacement on same worktree.

### Step 4d: Handle QA Verdict

**On QA PASS (5 steps in order):**
1. Emit: `/claude-workflow:track qa.passed "Task #<N>" --task <N> --branch <workbranch>`
2. Rebase + Merge:
   ```bash
   git -C <worktreePath> rebase <featureBranch>
   git checkout <featureBranch>
   git merge --no-ff <workbranch> -m "Merge <task-slug>: <summary>"
   ```
3. Emit: `/claude-workflow:track branch.merged "<task-slug> to <featureBranch>"`
4. Cleanup: `git worktree remove <path>` then `git branch -d <workbranch>`
5. Shut down both: `SendMessage(to: "coder-task-<N>", message: {type: "shutdown_request"})` and QA

**On QA FAIL (round < 3):**
1. Forward to coder: `SendMessage(to: "coder-task-<N>", message: "QA FAIL round <R>. Fix: <issues>")`
2. Wait for coder to fix and message back
3. Spawn NEW QA: `name: "qa-task-<N>-r<round>"`. Shut down previous QA.
4. Wait for new verdict. Repeat.

**On QA FAIL (round 3 — escalation):**
1. Emit: `/claude-workflow:track qa.failed "Task #<N> failed 3 rounds"`
2. Inform user. Ask: (a) manual fix, (b) skip QA, (c) abort.

### Step 4e: Wave Fence

After ALL tasks in wave merged:
- **Strict**: full verification (lint, typecheck, test, build) on feature branch
- **Standard**: lint only
- **Fast**: skip

```
/claude-workflow:track checkpoint "wave-<N>-complete"
```

When ALL waves complete:
```
/claude-workflow:track checkpoint "all-waves-complete"
```

### Step 4f: Verification Checklist (per wave)

```
WAVE <N> VERIFICATION:
- [ ] Worktrees created for each task
- [ ] Coder + QA spawned together with thin prompts
- [ ] Coder messaged completion, QA notified
- [ ] QA verdict handled per protocol
- [ ] For each PASS: qa.passed → merge → branch.merged → cleanup → shutdown
- [ ] Wave fence passed
- [ ] Wave checkpoint emitted
```

---

## Phase 5: GUARDIAN & FINALIZE

### Step 5a: Pre-Guardian Checkpoint

```
/claude-workflow:track checkpoint "pre-guardian"
```

### Step 5b: Spawn Guardian

**Fast mode:** Skip Guardian — emit guardian-passed directly.

**Strict/standard:** Use Guardian template from `THIN-SPAWN-TEMPLATE.md`. Guardian runs on the feature branch (NOT in a worktree).

### Step 5c: Handle Guardian Verdict

**On PASS:**
1. Emit: `/claude-workflow:track checkpoint "guardian-passed"`
2. Final verification on feature branch
3. If PR requested: push + `gh pr create`

**On FAIL:**
1. Spawn coding agent to fix findings on new workbranch
2. Merge fix, spawn Guardian again (`guardian-r2`)
3. Repeat until PASS

### Step 5d: Cleanup

> MANDATORY: Shut down agents BEFORE session.end.

1. Shut down all agents: `SendMessage(to: "<agent>", message: {type: "shutdown_request"})`
2. Remove sentinel file: delete `.claude/.workflow-active`
3. Emit: `/claude-workflow:track session.end "Feature complete"`
4. Clean stale worktrees: `git worktree list` → remove remaining
5. `TeamDelete`
6. Update `history.json` with completion entry
7. Report to user: summary, files changed, branch name

### Step 5e: Verification Checklist

```
PHASE 5 VERIFICATION:
- [ ] Guardian spawned (strict/standard) or skipped (fast)
- [ ] Guardian PASS received (or fast mode skip)
- [ ] guardian-passed emitted
- [ ] All agents shut down
- [ ] Sentinel file removed
- [ ] session.end emitted AFTER agents stopped
- [ ] No remaining worktrees or workbranches
- [ ] TeamDelete completed
- [ ] User informed with summary
```

---

## Quick Reference — Branching

```bash
# Feature branch (from base)
git checkout <baseBranch> && git checkout -b <featurePrefix>/<name>

# Worktree per task (from feature HEAD)
git checkout <featurePrefix>/<name>
git worktree add <worktreeDir>/<ticket>/<task> -b <workPrefix>/<ticket>/<task>

# Pre-merge rebase
git -C <worktreeDir>/<ticket>/<task> rebase <featurePrefix>/<name>

# Merge workbranch
git checkout <featurePrefix>/<name>
git merge --no-ff <workPrefix>/<ticket>/<task> -m "Merge <task>: <summary>"

# Cleanup
git worktree remove <worktreeDir>/<ticket>/<task>
git branch -d <workPrefix>/<ticket>/<task>
```
