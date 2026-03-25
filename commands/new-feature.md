---
name: new-feature
description: Full multi-agent feature implementation with branch-per-task isolation, QA cycles, and Codebase Guardian verification
---

# /new-feature — Team Workflow Orchestrator (v3)

CRITICAL: Execute this workflow step by step. Do NOT skip, combine, or abbreviate any step. Do NOT write application code yourself — spawn coding agents. The phase checklists are your enforcement — complete every item before advancing.

## Architecture: Hub-and-Spoke with Parallel Agent Pairs

**Communication model — Team Leader is the hub. Agents do NOT talk to each other.**

```
For each task:
  Leader spawns coder + QA together (parallel)
  Coder works -> coder messages leader "done"
  QA prepares review plan while coder works
  Leader notifies QA that code is ready -> QA reviews -> QA messages leader "PASS/FAIL"
  If FAIL: leader messages coder "fix: ..." -> coder fixes -> leader spawns NEW QA
  If PASS: leader emits qa.passed -> merges -> shuts down both agents
```

**Enforcement is checklist-driven.** Each phase has a verification checklist. Complete every item before advancing. The safety-guard.js hook blocks destructive git commands. The state file protection in proof-gate.js prevents direct writes to tracking files.

---

## Phase 1: SETUP & VALIDATE

> MANDATORY: Execute every step in order. Each step produces outputs that later phases depend on. Skipping any step WILL cause silent failures.

### Step 1.0: Pre-Flight Infrastructure Check

Verify plugin infrastructure exists and is healthy before anything else.

**1.0a — Plugin hook files (halt if missing).** Determine plugin root from `<workflow-config>` system context (`Plugin root:` line). Verify these exist: `hooks/config.js`, `hooks/tracker.js`, `hooks/tracking.js`, `hooks/proof-ledger.js`, `hooks/proof-gate.js`, `hooks/safety-guard.js`, `hooks/hooks.json`. If ANY missing: halt — _"Plugin installation corrupt. Reinstall claude-workflow."_ Load-test: `node -e "require('<plugin-root>/hooks/config.js')"` (repeat for proof-ledger.js, proof-gate.js). If any throws: halt.

**1.0b — Required prompt files (halt if missing).** Verify: `prompts/implementing-features/WORKFLOW-MODES.md`, `QA-CHECKLIST-TEMPLATE.md`, `AGENT-SPAWN-TEMPLATES.md`, `PROGRESS-FILE-TEMPLATE.md`, `EVENT-SCHEMA.md`.

**1.0c — Agent Teams tools (halt if unavailable).** Verify available: **TeamCreate**, **SendMessage**, **Agent** (or Task). If ANY missing: halt — _"Agent Teams tools not available."_

**1.0d — Project config.** Check `.claude/workflow.json`: valid JSON = read config; malformed = halt with error; missing = apply defaults (Step 1.3).

**1.0e — Core directories (create if missing):**
```bash
mkdir -p .claude/progress .claude/tracking
```
If `useWorktrees` is true: also `mkdir -p <worktreeDir>` (default: `.worktrees`)

### Step 1.1: Git Validation

Run `git rev-parse --git-dir` (halt if not a repo) and `git rev-parse --show-toplevel` (store as `REPO_ROOT`). Detect primary branch: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'` — fall back to checking if `main` or `master` exists. Store as `PRIMARY_BRANCH`.

### Step 1.2: Branch Scenario Classification

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
```

Classify `CURRENT_BRANCH`:

| Scenario | Condition | Action |
|----------|-----------|--------|
| **ON-FEATURE** | Matches `<featurePrefix>/*` | Adopt branch, extract FEATURE_NAME by stripping prefix |
| **ON-BASE** | Equals PRIMARY_BRANCH or baseBranch | FEATURE_NAME from user args; create branch in Phase 2 |
| **WRONG-BRANCH** | Anything else | If protected: warn, branch from baseBranch. If unknown: ask user |

**Dirty working tree:** Run `git status --porcelain`. ON-FEATURE with changes: note and continue. ON-BASE/WRONG-BRANCH with changes: halt until user commits or stashes.

### Step 1.3: Read Configuration

Resolve from `.claude/workflow.json` (or defaults): `projectRulesFile` (CLAUDE.md), `architectureFile` (.claude/docs/ARCHITECTURE.md), `progressDir` (.claude/progress), `featurePrefix` (feature), `workPrefix` (work), `worktreeDir` (.worktrees), `useWorktrees` (true), `protectedBranches` (["main","master"]), `baseBranch` ("auto" = PRIMARY_BRANCH).

Resolve workflow mode: per-invocation override > project rules file setting > default `strict`.

### Step 1.4: Initialize Tracking

**First, check for existing progress** (before creating anything):
```bash
ls .claude/progress/<feature-name>/events.jsonl 2>/dev/null
git branch --list "<workPrefix>/<feature-name>/*"
```
- events.jsonl exists with no session.end: suggest `/resume`
- events.jsonl exists with session.end: ask user if starting new work
- Stale workbranches or worktrees: clean up aggressively before starting:
  ```bash
  # Remove stale worktrees for this feature
  git worktree list --porcelain | grep -A2 "worktree.*<worktreeDir>/<feature-name>" | grep "^worktree " | sed 's/worktree //' | while read wt; do git worktree remove --force "$wt" 2>/dev/null; done
  # Remove stale work branches for this feature
  git branch --list "<workPrefix>/<feature-name>/*" | xargs -r git branch -D 2>/dev/null
  ```

**Then initialize:**
```bash
mkdir -p .claude/progress/<feature-name> .claude/tracking/<feature-name>/agents
```
Emit: `/claude-workflow:track session.start "<feature-name>" --branch "<branch>" --mode "<mode>"`

This creates `workflow-state.json` and `events.jsonl` via hooks. Do NOT write these files directly.

### Step 1.5: Verification Checklist

```
PHASE 1 VERIFICATION:
- [ ] 1.0a — Hook files exist and core modules load
- [ ] 1.0b — Required prompt files exist
- [ ] 1.0c — Agent Teams tools available (TeamCreate, SendMessage, Agent)
- [ ] 1.0d — Config loaded or defaults applied
- [ ] 1.0e — Progress and tracking directories exist
- [ ] 1.1  — Git repo confirmed, REPO_ROOT and PRIMARY_BRANCH stored
- [ ] 1.2  — BRANCH_SCENARIO classified, FEATURE_NAME determined
- [ ] 1.3  — All config values resolved, workflow mode set
- [ ] 1.4  — session.start emitted, tracking initialized
```

> RECOVERY: If any item fails, fix it or halt. Do NOT proceed to Phase 2 with missing infrastructure.

---

**PHASE CHECK**: Before proceeding, confirm all Phase 1 items checked.

---

## Phase 2: PLAN & DECOMPOSE

### Step 2.1: Load Context Files

<lazy-load purpose="Defer reading large files until needed">

**Read NOW:** (1) `<projectRulesFile>` — project conventions, (2) `<architectureFile>` — system architecture, (3) `WORKFLOW-MODES.md` — mode reference. Skip any that are missing.

**Check for design doc:** `ls .claude/progress/<feature-name>/*-design.md 2>/dev/null` — if exists, use as primary planning source.

**DEFERRED (do NOT read yet):** `AGENT-SPAWN-TEMPLATES.md` (Phase 3), `QA-CHECKLIST-TEMPLATE.md` (Phase 4), `CONTEXT-BUDGET-GUIDE.md` (Phase 4).

</lazy-load>

### Step 2.2: Decompose into Tasks

Each task MUST have: (1) one assigned agent role from `.claude/agents/`, (2) scoped files with no overlap between tasks, (3) specific acceptance criteria, (4) estimated complexity. If design doc exists, adopt its decomposition.

### Step 2.3: Plan Waves

Group tasks into dependency layers: Wave 1 (foundation: types, schemas), Wave 2 (logic: services), Wave 3 (integration: handlers, state), Wave 4 (presentation: components). Tasks within a wave run in parallel. Record `TOTAL_WAVES`.

### Step 2.4: Emit Plan

```
/claude-workflow:track plan.created "<summary of N tasks in M waves>"
```

### Step 2.5: Verification Checklist

```
PHASE 2 VERIFICATION:
- [ ] Context files read (project rules, architecture, or design doc)
- [ ] Tasks decomposed: each has ONE agent, scoped files, acceptance criteria
- [ ] No file overlap between any two tasks
- [ ] Dependencies mapped, waves planned, TOTAL_WAVES recorded
- [ ] plan.created emitted
```

> RECOVERY: If decomposition is unclear, ask the user for clarification. Do NOT guess at task boundaries.

---

**PHASE CHECK**: Before proceeding, confirm all Phase 2 items checked.

---

## Phase 3: TEAM SETUP

### Step 3.1: Create Team and Discover Your Name

```
TeamCreate: team_name = "<feature-name>"
```

Immediately after TeamCreate, read the team config to discover your own member name:
```bash
cat ~/.claude/teams/<feature-name>/config.json
```
Find your entry in the `members` array and store the `name` field as `TEAM_LEADER_NAME`. Use this value in ALL agent spawn prompts to replace `<TEAM_LEADER_NAME>`.

### Step 3.2: Create Tasks

For each task from the plan:
```
TaskCreate:
  description = "<task name>: <summary>"
  team_name = "<feature-name>"
```

Set dependencies via TaskUpdate with `addBlockedBy` for tasks that depend on prior waves.

### Step 3.3: Emit Setup Checkpoint

```
/claude-workflow:track checkpoint "setup-complete"
```

This sets `setupComplete=true` and records `totalWaves` in workflow state.

### Step 3.4: Read Spawn Templates

<lazy-load purpose="Defer template loading until agents are about to be spawned">

Read NOW:
- `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` — copy-paste templates for coding and QA agents
- `prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md` — estimate context per agent, split if over threshold

</lazy-load>

### Step 3.5: Verification Checklist

```
PHASE 3 VERIFICATION:
- [ ] TeamCreate called with correct team_name
- [ ] One TaskCreate per task with description and acceptance criteria
- [ ] Dependencies set via TaskUpdate
- [ ] setup-complete checkpoint emitted (workflow-state shows setupComplete: true)
- [ ] AGENT-SPAWN-TEMPLATES.md read and templates ready
```

> RECOVERY: If TeamCreate fails, check if a stale team exists from a prior session. Note it and retry — TeamCreate will overwrite stale teams.

---

**PHASE CHECK**: Before proceeding, confirm all Phase 3 items checked.

---

## Phase 4: EXECUTE WAVES

> MANDATORY: This is the core execution loop. For EACH wave, execute steps 4a through 4e in order. Do NOT skip the QA step. Do NOT merge without QA passing. Do NOT write application code yourself.

For each wave (1 to TOTAL_WAVES):

### Step 4a: Create Worktrees

Check `useWorktrees` from the config loaded in Step 1.3.

**If `useWorktrees` is true (default):** For each task in this wave:
```bash
git checkout <featurePrefix>/<feature-name>
git worktree add <worktreeDir>/<feature-name>/<task-slug> -b <workPrefix>/<feature-name>/<task-slug>
```

**If `useWorktrees` is false:** Create branches instead: `git checkout -b <workPrefix>/<feature-name>/<task-slug>` then switch back to feature branch.

### Step 4b: Spawn Agent Pairs (Coder + QA Together)

> MANDATORY: Use the FULL template from AGENT-SPAWN-TEMPLATES.md. Do NOT abbreviate.

For each task, spawn BOTH agents in the SAME message (parallel tool calls):

**Coding agent:** `description: "<summary>"`, `subagent_type: general-purpose`, `model: "sonnet"`, `team_name: "<feature-name>"`, `name: "coder-task-<N>"`, `mode: bypassPermissions`, `run_in_background: true`.

**QA agent:** `description: "QA review Task #<N>"`, `subagent_type: general-purpose`, `model: "haiku"`, `team_name: "<feature-name>"`, `name: "qa-task-<N>"`, `mode: bypassPermissions`, `run_in_background: true`.

Every coding agent prompt MUST include:
```
COMMUNICATION RULES:
- You are on team "<feature-name>". Your team leader is "<TEAM_LEADER_NAME>".
- On completion: SendMessage(to: "<TEAM_LEADER_NAME>", message: "Task #<N> complete. Files: <list>. Self-review passed.", summary: "Task #<N> complete")
- On blocker: message Team Leader immediately.
- Do NOT communicate with other coding agents or QA agents. Do NOT spawn agents. Do NOT emit tracking events.
- Wait for further instructions or shutdown_request when done.
```

Every QA agent prompt MUST include: task description, acceptance criteria, expected files, worktree path, pre-filled QA checklist from QA-CHECKLIST-TEMPLATE.md, and:
```
QA COMMUNICATION RULES:
- You are a QA reviewer on team "<feature-name>". Leader: "<TEAM_LEADER_NAME>".
- You were spawned at the same time as the coding agent. Prepare your review plan while you wait.
- The Team Leader will notify you when the code is ready for review.
- On QA PASS: message Team Leader "QA PASS Task #<N>" with full report.
- On QA FAIL: message Team Leader "QA FAIL Task #<N>" with issue list.
- Do NOT message the coding agent directly. Do NOT spawn agents.
```

Save each `task_id` for later use with `TaskOutput(task_id=<id>)`.

### Step 4c: Wait for Verdicts and Handle Results

**Wait for coding agents to message completion.** When a coder reports done:
1. Note which task completed and the files changed
2. Notify the paired QA agent: `SendMessage(to: "qa-task-<N>", message: "Code ready for review. Files changed: <list>. Coder reports self-review passed.")`

**Wait for QA agents to send verdicts.** The QA agent reviews the committed code and messages you with PASS or FAIL.

> RECOVERY: If an agent goes idle without messaging, send it a nudge. If no response, check TaskOutput for errors. If agent crashed, spawn a replacement on the same worktree.

### Step 4d: Handle QA Verdict

**On QA PASS — execute ALL 5 steps in order:**

1. Emit: `/claude-workflow:track qa.passed "Task #<N>" --task <N> --branch <workPrefix>/<feature-name>/<task-slug>`
2. Merge:
   ```bash
   git -C <worktreeDir>/<feature-name>/<task-slug> rebase <featurePrefix>/<feature-name>
   git checkout <featurePrefix>/<feature-name>
   git merge --no-ff <workPrefix>/<feature-name>/<task-slug> -m "Merge <task-slug>: <summary>"
   ```
3. Emit: `/claude-workflow:track branch.merged "<task-slug> to <featurePrefix>/<feature-name>"`
4. Cleanup: `git worktree remove <path>` then `git branch -d <workPrefix>/<feature-name>/<task-slug>`
5. Shut down both: `SendMessage(to: "coder-task-<N>", message: {type: "shutdown_request"})` and same for qa-task-N

**On QA FAIL (round < 3):**
1. Forward issues to coder: `SendMessage(to: "coder-task-<N>", message: "QA FAIL round <R>. Fix: <issues>")`
2. Wait for coder to message back with fixes.
3. Spawn NEW QA agent: `name: "qa-task-<N>-r<round>"` (same template as 4d). Shut down previous QA.
4. Wait for new verdict. Repeat until PASS or round 3.

**On QA FAIL (round 3 — escalation):**
1. Emit: `/claude-workflow:track qa.failed "Task #<N> failed 3 rounds"`
2. Inform user with full failure history. Ask: (a) fix and retry, (b) skip QA, (c) abort.

> RECOVERY: If QA agent crashes or goes unresponsive, spawn a replacement QA agent on the same worktree. If coder agent crashes mid-fix, spawn a replacement coder on the same worktree with the fix instructions.

### Step 4f: Wave Fence

After ALL tasks in the current wave are merged:

- **Strict mode**: Run full verification (lint, typecheck, test, build) on the feature branch
- **Standard mode**: Run lint only
- **Fast mode**: Skip fence

If fence passes:
```
/claude-workflow:track checkpoint "wave-<N>-complete"
```

Then create next wave's worktrees and spawn next wave's agents.

When ALL waves complete:
```
/claude-workflow:track checkpoint "all-waves-complete"
```

### Step 4f: Verification Checklist (per wave)

```
WAVE <N> VERIFICATION:
- [ ] Worktree created for each task
- [ ] Coder + QA agent pair spawned together for each task (with full template, NOT abbreviated)
- [ ] Coding agent messaged completion, QA agent notified
- [ ] QA verdict received: PASS or FAIL handled per protocol
- [ ] For each PASS: qa.passed emitted, branch merged, branch.merged emitted, worktree cleaned, agents shut down
- [ ] Wave fence passed (mode-appropriate check)
- [ ] Wave checkpoint emitted
```

**After ALL waves:**

```
PHASE 4 FINAL VERIFICATION:
- [ ] All waves completed and checkpointed
- [ ] All worktrees removed (git worktree list confirms)
- [ ] All workbranches deleted (git branch --list "<workPrefix>/<feature-name>/*" returns empty)
- [ ] all-waves-complete checkpoint emitted
```

> RECOVERY: If a merge has conflicts, resolve them on the feature branch. If wave fence fails, spawn a coding agent to fix the issues before proceeding to the next wave.

---

**PHASE CHECK**: Before proceeding, confirm all Phase 4 items checked.

---

## Phase 5: GUARDIAN & FINALIZE

### Step 5a: Emit Pre-Guardian Checkpoint

```
/claude-workflow:track checkpoint "pre-guardian"
```

### Step 5b: Spawn Guardian Agent

**Fast mode:** Check the workflow mode from `workflow-state.json`. If mode is `fast`, skip Guardian — emit guardian-passed directly and proceed to Step 5c.

**Strict/standard:** Spawn with `description: "Codebase Guardian"`, `model: "sonnet"`, `team_name: "<feature-name>"`, `name: "guardian"`, `mode: bypassPermissions`, `run_in_background: true`. Guardian runs on the feature branch (NOT in a worktree). Prompt includes: all files changed, project rules, architecture, 7 structural checks, communication rules (message leader with PASS/FAIL).

### Step 5c: Handle Guardian Verdict

**On PASS:**
1. Emit: `/claude-workflow:track checkpoint "guardian-passed"` (sets guardianPassed=true, unblocks shutdown)
2. Run final verification on feature branch (lint, typecheck, test, build)
3. If PR requested: `git push -u origin <featurePrefix>/<feature-name>` then `gh pr create`

**On FAIL:**
1. Spawn coding agent on new workbranch to fix findings, merge fix, spawn Guardian again (`guardian-r2`). Repeat until PASS.

> RECOVERY: If Guardian crashes, spawn replacement. If unfixable, escalate to user.

### Step 5d: Cleanup

> MANDATORY: Shut down agents BEFORE emitting session.end. Gates relax after session.end.

1. Shut down all agents: `SendMessage(to: "<agent>", message: {type: "shutdown_request", reason: "Feature complete"})` — wait for each to acknowledge.
2. Emit: `/claude-workflow:track session.end "Feature complete"`
3. Clean up stragglers: `git worktree list` then `git worktree remove` for any remaining.
4. `TeamDelete` (unblocked because guardianPassed=true).
5. Report to user: summary, files changed, branch name.

### Step 5e: Verification Checklist

```
PHASE 5 VERIFICATION:
- [ ] Guardian spawned (strict/standard) or skipped (fast)
- [ ] Guardian PASS received (or fast mode skip)
- [ ] guardian-passed emitted (guardianPassed = true in workflow state)
- [ ] Final verification suite passed on feature branch
- [ ] All agents shut down (each acknowledged shutdown_request)
- [ ] session.end emitted AFTER all agents stopped
- [ ] No remaining worktrees or workbranches
- [ ] TeamDelete completed
- [ ] User informed with summary
- [ ] PR created (if requested)
```

> RECOVERY: If TeamDelete is blocked, check that guardian-passed was emitted. If agents refuse shutdown, check their status with TaskOutput.

---

## Quick Reference — Branching

```bash
# Feature branch (from base)
git checkout <baseBranch> && git checkout -b <featurePrefix>/<name>

# Worktree per task (from feature HEAD)
git checkout <featurePrefix>/<name>
git worktree add <worktreeDir>/<name>/<task> -b <workPrefix>/<name>/<task>

# Pre-merge rebase
git -C <worktreeDir>/<name>/<task> rebase <featurePrefix>/<name>

# Merge workbranch
git checkout <featurePrefix>/<name>
git merge --no-ff <workPrefix>/<name>/<task> -m "Merge <task>: <summary>"

# Cleanup
git worktree remove <worktreeDir>/<name>/<task>
git branch -d <workPrefix>/<name>/<task>
```

## Quick Reference — Agent Roles

| Agent | File Scope | When |
|-------|-----------|------|
| Schema/type designer | Types, schemas, contracts | New data models |
| Service engineer | Business logic, services | Backend work |
| API/handler engineer | Routes, controllers | Endpoints |
| Component engineer | UI components, pages | Frontend |
| Database engineer | Migrations, queries | DB changes |
| QA reviewer | READ ONLY (+docs on PASS) | Per-task review |
| Codebase Guardian | Feature branch (structural) | Final check |

See `.claude/agents/` for all specialist definitions.

## Quick Reference — Active Guards

| Guard | What it does | Hook file |
|-------|-------------|-----------|
| **State file protection** | Blocks direct Write/Edit to events.jsonl, workflow-state.json, proof-ledger.jsonl | proof-gate.js |
| **Destructive guard** | Blocks `git push --force`, `rm -rf`, `git reset --hard`, `git branch -D` | safety-guard.js |
| **Branch guard** | Warns on commits/pushes to protected branches (main, master) | safety-guard.js |
| **Config guard** | Blocks agents from modifying .claude/ workflow files during execution | config-guard.js |

All other enforcement is checklist-driven. Follow each phase's verification checklist before advancing.
