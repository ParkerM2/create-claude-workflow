---
description: "Full multi-agent feature implementation with branch-per-task isolation, QA cycles, and Codebase Guardian verification"
---

# /new-feature — Team Workflow Orchestrator

> Invoke this skill to implement a feature using Claude Agent Teams with branch-per-task isolation, per-task QA with doc updates, crash-safe progress tracking, and a final Codebase Guardian check.

---

## When to Use

- Implementing a new feature that touches multiple files or modules
- Refactoring an existing feature across multiple files
- Any task requiring 2+ specialist agents working in coordination

---

## Phase 1: Initialize & Validate Environment

> **⚠️ MANDATORY EXECUTION RULES — READ BEFORE PROCEEDING**
>
> You MUST execute every numbered step in this phase sequentially. Do NOT skip, reorder, combine, or abbreviate any step. Do NOT assume a prior session already completed these steps. Each step exists because a hook or gate depends on its output — skipping any step WILL cause silent failures in later phases.
>
> Follow this workflow **word for word**. When a step says "create", create it. When it says "run", run it. When it says "read", read it. Do not summarize or paraphrase the instructions to yourself — execute them literally.

### Step 1.0: Pre-Flight Infrastructure Audit

**Before any other step, verify that the entire plugin infrastructure exists and is healthy.** This step discovers, validates, and creates everything the workflow depends on — in one pass — so that no later phase ever fails due to a missing file or directory.

Run every check below. For each item: if it exists, confirm its path. If it does NOT exist and it CAN be created, create it. If it CANNOT be created (plugin file — must be installed), halt and inform the user.

#### 1.0a — Plugin Root & Hook Files (MUST exist — cannot be created)

Determine the plugin root path from the `<workflow-config>` system context (the `Plugin root:` line). All plugin files are relative to this path.

```
PLUGIN FILES (required — halt if any missing):
  <plugin-root>/hooks/config.js
  <plugin-root>/hooks/tracker.js
  <plugin-root>/hooks/tracking.js
  <plugin-root>/hooks/activity-logger.js
  <plugin-root>/hooks/compact-reinject.js
  <plugin-root>/hooks/config-guard.js
  <plugin-root>/hooks/safety-guard.js
  <plugin-root>/hooks/enforcement-gate.js
  <plugin-root>/hooks/workflow-gate.js
  <plugin-root>/hooks/team-leader-gate.js
  <plugin-root>/hooks/tracking-emitter.js
  <plugin-root>/hooks/session-start.js
  <plugin-root>/hooks/quality-gate.js
  <plugin-root>/hooks/hooks.json
```

Verify each exists. If ANY is missing → halt: _"Plugin installation is corrupt — missing `<file>`. Reinstall the claude-workflow plugin."_

Then load-test the 3 core modules:
```bash
node -e "require('<plugin-root>/hooks/config.js')" 2>&1
node -e "require('<plugin-root>/hooks/tracker.js')" 2>&1
node -e "require('<plugin-root>/hooks/tracking.js')" 2>&1
```
If any throws → halt with the error.

#### 1.0b — Prompt Files (MUST exist — cannot be created)

```
REQUIRED PROMPTS (halt if missing):
  <plugin-root>/prompts/implementing-features/PHASE-GATE-PROTOCOL.md
  <plugin-root>/prompts/implementing-features/WORKFLOW-MODES.md
  <plugin-root>/prompts/implementing-features/README.md
  <plugin-root>/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
  <plugin-root>/prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md
  <plugin-root>/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md
  <plugin-root>/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md
  <plugin-root>/prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md

REQUIRED SKILLS (halt if missing):
  <plugin-root>/skills/using-workflow/SKILL.md
  <plugin-root>/commands/track.md
```

Verify each exists. If ANY is missing → halt: _"Plugin installation is incomplete — missing `<file>`. Reinstall the claude-workflow plugin."_

#### 1.0c — Project Configuration File

Check if `.claude/workflow.json` exists:
- If it exists → **validate it parses as valid JSON.** If malformed:
  - Show the parse error to the user
  - Halt: _"Fix `.claude/workflow.json` syntax or delete it to use defaults."_
- If it exists and is valid → read and store all config values (see Step 1.4 for the full key list)
- If it does NOT exist → inform the user, apply defaults (see Step 1.4)

#### 1.0d — Project-Specific Files (optional — warn if missing)

```
OPTIONAL PROJECT FILES (warn, do not halt):
  <projectRulesFile>       (default: CLAUDE.md)
  <architectureFile>       (default: .claude/docs/ARCHITECTURE.md)
```

If missing → note: _"Optional file `<path>` not found. The workflow will proceed without it."_

#### 1.0e — Core Directories (create if missing)

These directories are required by hooks at runtime. If they don't exist, **create them now**.

```bash
# Progress tracking root (used by: tracker.js, activity-logger.js, all gates)
mkdir -p .claude/progress

# Unified tracking root (used by: tracking.js, tracking-emitter.js)
mkdir -p .claude/tracking

# Worktree root — only if useWorktrees is true in config (used by: enforcement-gate.js, agent spawns)
# Default: .worktrees
mkdir -p <worktreeDir>
```

After creation, confirm each exists:
```bash
ls -d .claude/progress .claude/tracking <worktreeDir>
```

#### 1.0f — Agent Teams Capability

Verify these tools are available in the current session:
- **TeamCreate** — required Phase 3
- **Agent** — required Phase 4
- **SendMessage** — required Phase 4
- **TaskOutput** — required Phase 4

If ANY is unavailable → halt: _"Agent Teams tools not available. The /new-feature workflow requires TeamCreate, Agent, SendMessage, and TaskOutput. Ensure Claude Code has Agent Teams enabled."_

Store `TEAM_LEADER_NAME` for use in agent communication instructions.

#### Step 1.0 Verification

```
PRE-FLIGHT INFRASTRUCTURE AUDIT:
[ ] 1.0a — All 14 hook files exist and 3 core modules load without error
[ ] 1.0b — All 8 required prompt files exist, both required skills exist
[ ] 1.0c — workflow.json valid JSON (or defaults applied)
[ ] 1.0d — Project files checked (present or warned)
[ ] 1.0e — .claude/progress/ exists
[ ] 1.0e — .claude/tracking/ exists
[ ] 1.0e — <worktreeDir>/ exists (if useWorktrees = true)
[ ] 1.0f — Agent Teams tools available (TeamCreate, Agent, SendMessage, TaskOutput)
[ ] 1.0f — TEAM_LEADER_NAME stored
```

If ANY item fails → fix it or halt before proceeding. Do NOT continue to Step 1.1 with missing infrastructure.

---

### Step 1.1: Git Repository Validation

1. Run `git rev-parse --git-dir`. If this fails → stop and tell the user: _"This directory is not a git repository. Initialize one with `git init` and make an initial commit before running /new-feature."_
2. Run `git rev-parse --show-toplevel` and store the result as `REPO_ROOT`. All paths below are relative to this root.

### Step 1.2: Primary Branch Detection

1. Detect the primary branch name: try `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'`, fall back to checking if `main` or `master` exists.
2. Store the result as `PRIMARY_BRANCH`. Use this throughout — never hardcode `main`.

### Step 1.3: Detect Current Branch & Starting Position

The user's current branch determines how Phase 3 will handle branch creation. Detect it now.

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)
```

Classify `CURRENT_BRANCH` into one of three cases and store `BRANCH_SCENARIO`:

**Case A — Already on a feature branch** (most common):
The user is already on a branch matching `<featurePrefix>/*` (e.g., `feature/ES-12004-auth-refactor`). This is the typical workflow — the user created or checked out their ticket branch and then invoked `/new-feature`.
- Set `BRANCH_SCENARIO = "on-feature"`
- Extract the feature name from the branch: `FEATURE_NAME = CURRENT_BRANCH` with the `<featurePrefix>/` prefix stripped
- This branch will be ADOPTED as the feature branch in Phase 3 — no new branch creation needed

**Case B — On the base branch** (starting fresh):
The user is on `PRIMARY_BRANCH` or whatever `baseBranch` resolves to (e.g., `main`, `master`, `develop`).
- Set `BRANCH_SCENARIO = "on-base"`
- `FEATURE_NAME` must come from the user's invocation arguments or prompt
- Phase 3 will create a new `<featurePrefix>/<feature-name>` branch from here

**Case C — On a protected or unrelated branch** (needs redirect):
The user is on a branch that is neither a feature branch nor the base branch — e.g., `production`, `staging`, `release/v2`, `hotfix/urgent`, or a detached HEAD.
- Set `BRANCH_SCENARIO = "wrong-branch"`
- Check if `CURRENT_BRANCH` is in `protectedBranches` — if so, warn: _"You're on protected branch `<CURRENT_BRANCH>`. I'll branch from `<baseBranch>` instead."_
- If it's an unrecognized branch, ask the user: _"You're on `<CURRENT_BRANCH>` which isn't a feature branch or the base branch. Should I branch from `<baseBranch>`, or use this branch as the starting point?"_
- Phase 3 will handle the checkout accordingly

### Step 1.4: Apply Configuration Values

Configuration was already read and validated in Step 1.0c. Now resolve derived values:

1. Resolve `baseBranch`: if set to `"auto"`, replace with `PRIMARY_BRANCH`.
2. Store all config values for use throughout the workflow:
   - `projectRulesFile` (default: `CLAUDE.md`)
   - `architectureFile` (default: `.claude/docs/ARCHITECTURE.md`)
   - `progressDir` (default: `.claude/progress`)
   - `featurePrefix` (default: `feature`)
   - `workPrefix` (default: `work`)
   - `worktreeDir` (default: `.worktrees`)
   - `enforce` (default: `warn`)
   - `protectedBranches` (default: `["main", "master"]`)
   - `useWorktrees` (default: `true`)

> Note: Directories, hooks, prompts, and Agent Teams tools were already validated in Step 1.0. Do NOT re-check them here.

### Step 1.5: Dirty Working Tree Check

Before any branch operations, check for uncommitted work:

```bash
git status --porcelain
```

If there are uncommitted changes:
- If `BRANCH_SCENARIO = "on-feature"` → this is fine, the user's work-in-progress is on their feature branch. Note it and continue — Phase 3 will not change branches.
- If `BRANCH_SCENARIO = "on-base"` or `"wrong-branch"` → warn the user: _"You have uncommitted changes on `<CURRENT_BRANCH>`. Commit or stash them before proceeding — switching branches would lose this work."_ Do NOT proceed until the working tree is clean or the user stashes/commits.

### Step 1.6: Branch Collision & Existing Progress Check

This step combines branch collision detection with crash recovery checks. There is no separate "Phase 2" — all progress detection happens here.

1. Determine the target feature branch name:
   - If `BRANCH_SCENARIO = "on-feature"` → target is `CURRENT_BRANCH` (already exists, will be adopted)
   - If `BRANCH_SCENARIO = "on-base"` or `"wrong-branch"` → target is `<featurePrefix>/<feature-name>`

2. **Check for existing progress artifacts:**
   ```bash
   # Existing progress tracking
   ls .claude/progress/<feature-name>/events.jsonl 2>/dev/null

   # Existing workbranches from a prior session
   git branch --list "<workPrefix>/<feature-name>/*"

   # Existing team from a prior session
   ls ~/.claude/teams/<feature-name>/config.json 2>/dev/null
   ```

3. **For `"on-base"` and `"wrong-branch"` scenarios:** check if the target branch already exists: `git branch --list "<featurePrefix>/<feature-name>"`
   - If it exists with events → inform the user: _"Feature branch and progress data already exist. Use `/resume` to continue the previous session, or provide a different feature name."_
   - If it exists without events → inform the user: _"Feature branch exists but has no progress tracking. Use `/resume` to adopt it, or delete the branch and re-run."_
   - If it does NOT exist → proceed (Phase 2 will create it).

4. **For `"on-feature"` scenario:** check for existing progress data:
   - If `events.jsonl` exists with no `session.end` → suggest `/resume`: _"Found interrupted progress for this feature. Use `/resume` to continue, or confirm you want to start fresh (existing progress will be archived)."_
   - If `events.jsonl` exists with `session.end` → feature was previously completed. Ask: _"This feature was previously completed. Start a new phase of work on this branch?"_
   - If no events → proceed (fresh start on existing branch).

5. **Stale team/worktree cleanup:** If prior workbranches or a stale team exist but the user chose to start fresh:
   ```bash
   # Remove stale worktrees
   git worktree list  # identify any under <worktreeDir>/<feature-name>/
   git worktree remove <path> --force  # for each stale one

   # Delete stale workbranches (use -d not -D — safety-guard.js blocks -D as destructive)
   git branch -d <workPrefix>/<feature-name>/<task>  # for each stale one
   # If -d fails because branch is not fully merged, ask user to confirm before using -D
   ```
   Note: Do NOT delete the team here — `TeamDelete` is blocked by enforcement-gate unless `guardianPassed` or `phase=done`. If a stale team exists, note it and it will be overwritten by `TeamCreate` in Phase 3.

### Step 1.7: Check for Design Document

Check if a prior `/new-plan` session produced a design doc:

```bash
ls .claude/progress/<feature-name>/*-design.md 2>/dev/null
```

Store the result as `HAS_DESIGN_DOC` (true/false). This determines the context loading path below.

### Step 1.8: Load Context Files

> Note: All prompt files were already validated in Step 1.0b. Project-specific files were checked in Step 1.0d.

**Path A — Design Doc Exists** (`HAS_DESIGN_DOC = true`):

The design doc consolidates rules, architecture, task breakdown, wave plan, and QA strategy. Read only what it doesn't contain:

```
READS (Path A):
1. prompts/implementing-features/PHASE-GATE-PROTOCOL.md  — Gate state machine (always needed)
2. The design doc itself                                   — Contains consolidated plan
3. prompts/implementing-features/WORKFLOW-MODES.md        — Only if mode not specified in design doc
```

**Skip** in Path A: README.md, QA-CHECKLIST-TEMPLATE.md, PROGRESS-FILE-TEMPLATE.md, project rules, architecture file — all consolidated into the design doc.

**Defer** to later phases: AGENT-SPAWN-TEMPLATES.md → Phase 4, QA-CHECKLIST-TEMPLATE.md → Phase 4 (only if expansion needed).

Use the design doc as your decomposition plan in Phase 2b instead of planning from scratch.

**Path B — No Design Doc** (`HAS_DESIGN_DOC = false`):

Load context incrementally. Read ONLY these files now; defer the rest to the phase that needs them:

```
PHASE 1 READS (now):
1. prompts/implementing-features/PHASE-GATE-PROTOCOL.md  — Gate state machine
2. The project rules file (from config)                    — Project rules (skip if missing, noted in 1.0d)
3. The architecture file (from config)                     — System architecture (skip if missing, noted in 1.0d)
4. prompts/implementing-features/WORKFLOW-MODES.md        — Workflow mode definitions

DEFERRED READS (do NOT read these now — existence already confirmed in Step 1.0b):
Phase 2: README.md, QA-CHECKLIST-TEMPLATE.md, QA-CHECKLIST-AUTO-FILL-RULES.md, PROGRESS-FILE-TEMPLATE.md
Phase 4: AGENT-SPAWN-TEMPLATES.md, CONTEXT-BUDGET-GUIDE.md
```

Do NOT read deferred files now. Read each one at the moment its phase begins.

### Step 1.9: Resolve Workflow Mode

Determine the active workflow mode:
1. Check if the user specified a mode with this invocation (e.g., `--mode fast`)
2. Check the project rules file for a `Workflow Mode` section
3. Default to `strict` if not specified

Store the resolved mode. It affects: pre-flight checks, QA round count, Guardian scope, and wave fence behavior.

### Step 1.10: Pre-Flight Checks (Strict Mode Only)

If workflow mode is `strict`:
1. Pre-flight runs against the base branch. Determine how to access it based on `BRANCH_SCENARIO`:
   - `"on-base"` → already on the right branch, run checks directly
   - `"on-feature"` → stash any uncommitted work (`git stash` if dirty), check out `<baseBranch>`, run checks, then return: `git checkout <CURRENT_BRANCH>` and `git stash pop` if stashed
   - `"wrong-branch"` → working tree is already confirmed clean (Step 1.5), check out `<baseBranch>`, run checks, then return to `<baseBranch>` (Phase 2 will handle the feature branch checkout)
2. Run the project's verification suite (build, lint, typecheck, test)
3. Record pass/fail baseline in memory — this becomes the progress file baseline in Phase 2
4. If baseline is broken → warn the user and **do not proceed** until resolved

If workflow mode is `standard` or `fast` → skip pre-flight entirely.

### Step 1.11: Self-Verification Checklist

**Before leaving Phase 1, iterate through every step above and confirm completion.** This is not optional — check each item and report any that were skipped or failed:

```
PHASE 1 VERIFICATION:
[ ] 1.0  — PRE-FLIGHT INFRASTRUCTURE AUDIT passed (all sub-checks in 1.0a–1.0f)
[ ] 1.1  — git repo confirmed, REPO_ROOT stored
[ ] 1.2  — PRIMARY_BRANCH detected and stored
[ ] 1.3  — CURRENT_BRANCH detected, BRANCH_SCENARIO classified (on-feature | on-base | wrong-branch)
[ ] 1.4  — Config values resolved (baseBranch, featurePrefix, workPrefix, etc.)
[ ] 1.5  — Working tree is clean (or on-feature with noted WIP)
[ ] 1.6  — Branch collision / existing progress check passed; stale artifacts cleaned
[ ] 1.7  — HAS_DESIGN_DOC determined
[ ] 1.8  — Context files read (Path A or Path B)
[ ] 1.9  — Workflow mode resolved and stored
[ ] 1.10 — Pre-flight passed (strict) or skipped (standard/fast)
```

If ANY item is unchecked → go back and complete it before proceeding to Phase 2. Do NOT proceed with a partial Phase 1.

**Phase 1 transition is automatic** — the `session.start` event (emitted in Phase 2 after branch creation) initializes the FSM in `plan` phase.

---

---

**PHASE CHECK**: Environment validated? → All hooks and gates have their prerequisites. Proceed to Phase 2.

---

## Phase 2: Create Feature Branch & Plan

### 2a. Establish Feature Branch

Branch handling depends on `BRANCH_SCENARIO` (determined in Step 1.3):

**Case A — `"on-feature"` (most common):**
You are already on the feature branch. No branch creation needed.
```bash
# Already on feature/<feature-name> — just confirm
git symbolic-ref --short HEAD   # should match <featurePrefix>/<FEATURE_NAME>
```

**Case B — `"on-base"`:**
Create the feature branch from the current base branch.
```bash
# Already on <baseBranch>
git checkout -b <featurePrefix>/<feature-name>
```

**Case C — `"wrong-branch"`:**
Switch to base branch first, then create the feature branch.
```bash
git checkout <baseBranch>
git checkout -b <featurePrefix>/<feature-name>
```

### 2b. Initialize Progress & Tracking

Create the feature's progress directory:

```bash
mkdir -p .claude/progress/<feature-name>
```

> **⚠️ ENFORCEMENT GATE WARNING:** `enforcement-gate.js` V1 blocks ALL direct Edit/Write/Bash writes to files ending in `events.jsonl` or `workflow-state.json`. You MUST use the `/claude-workflow:track` skill to emit events — never write these files directly. The unified tracking system (`tracking.js`) handles its own file creation internally via hooks.

**Initialize progress tracking (via /track skill):**

1. Emit `session.start` event via `/claude-workflow:track session.start` — this automatically creates `workflow-state.json` and `events.jsonl` (do NOT write either directly). This initializes the FSM in `plan` phase.
2. The `current.md` file is rendered when `/claude-workflow:track` is called for significant events.

**Initialize unified tracking (via tracking.js hooks):**

The unified tracking system initializes automatically when tracking events are emitted. The `tracking-emitter.js` hook calls `initTracking()` from `tracking.js` which creates:
- `.claude/tracking/<feature-name>/manifest.json`
- `.claude/tracking/<feature-name>/events.jsonl`
- `.claude/tracking/<feature-name>/agents/` directory

Do NOT create these files manually — the hooks create them. If you need to force initialization before the first tracking event, create only the directory:

```bash
mkdir -p .claude/tracking/<feature-name>/agents
```

Then emit the first tracking event which triggers full initialization.

The `events.jsonl` files are your **crash-recovery artifacts**. Events are appended via `/claude-workflow:track` commands at key checkpoints.

### 2c. Plan & Decompose

1. **Understand the feature** — Read requirements, design docs, and all referenced files
2. **Decompose into tasks** — Each task must be:
   - Assignable to exactly ONE specialist agent (from `.claude/agents/`)
   - Scoped to specific files (no two agents editing the same file)
   - Have clear acceptance criteria
   - Have a filled QA checklist (from `QA-CHECKLIST-TEMPLATE.md`)
3. **Map dependencies** — Identify which tasks block which
4. **Plan waves** — Group tasks by dependency layer:
   ```
   Wave 1: Foundation    — types, schemas, database migrations (no blockers)
   Wave 2: Logic         — services, business logic (depends on Wave 1)
   Wave 3: Integration   — handlers, state, hooks (depends on Wave 2)
   Wave 4: Presentation  — components, pages, routes (depends on Wave 3)
   ```
5. **Identify parallel opportunities** — Tasks within a wave that touch different files
6. **Record total wave count** — Store `TOTAL_WAVES` (the number of waves in the plan). This value is passed with the `setup-complete` checkpoint in Phase 3 so the FSM knows the expected wave count and prevents phantom wave creation after the last real wave.

**After completing Phase 2c, emit:** `/claude-workflow:track plan.created "<summary>"`
This transitions the FSM from `plan` → `setup`.

### Phase 2 Completion Checklist

**Before proceeding to Phase 3, verify every item. Do NOT skip any.**

```
PHASE 2 VERIFICATION:
[ ] 2a — On the correct feature branch (git symbolic-ref --short HEAD confirms)
[ ] 2b — .claude/progress/<feature-name>/ directory exists
[ ] 2b — session.start emitted via /track (NOT written directly — enforcement-gate blocks direct writes)
[ ] 2b — workflow-state.json exists with phase: "plan" (created by /track, not by you)
[ ] 2b — .claude/tracking/<feature-name>/ directory exists with agents/ subdirectory
[ ] 2b — Unified tracking initialized (manifest.json exists — created by hooks, not direct write)
[ ] 2c — Tasks decomposed: each has ONE agent, scoped files, acceptance criteria, QA checklist
[ ] 2c — No file overlap between any two tasks
[ ] 2c — Dependencies mapped, wave plan created
[ ] 2c — TOTAL_WAVES count recorded
[ ] 2c — plan.created event emitted via /track (workflow-state.json now shows phase: "setup")
```

If ANY item is unchecked → go back and complete it. The workflow-gate.js will BLOCK agent spawns if `plan.created` was not emitted.

---

---

**PHASE CHECK**: Plan complete? → workflow-gate.js blocks spawns until plan.created emitted.

---

## Phase 3: Set Up Team & Tasks

```
1. TeamCreate — team_name: "<feature-name>"
2. TaskCreate — one per task, with full description + acceptance criteria
3. TaskUpdate — set addBlockedBy dependencies for each task
4. Update progress file with task list + dependency graph
```

**After completing Phase 3 (team and tasks ready), emit:**
`/claude-workflow:track checkpoint "setup-complete"`
This transitions the FSM from `setup` → `wave`, sets `setupComplete=true`, and records `totalWaves`.

> **Important:** The `setup-complete` checkpoint initializes wave tracking. If you planned 3 waves, the state records `totalWaves: 3` so the wave-complete handler knows when to stop. Without this, phantom waves can be created after the last real wave.

### Phase 3 Completion Checklist

**Before proceeding to Phase 4, verify every item. Do NOT skip any.**

```
PHASE 3 VERIFICATION:
[ ] TeamCreate called with team_name: "<feature-name>"
[ ] One TaskCreate per task — each has description + acceptance criteria
[ ] TaskUpdate called for each task with correct addBlockedBy dependencies
[ ] Progress file updated with task list + dependency graph
[ ] setup-complete checkpoint emitted (workflow-state.json now shows phase: "wave", setupComplete: true)
[ ] totalWaves recorded in workflow state
```

If ANY item is unchecked → go back and complete it. The workflow-gate.js will BLOCK all agent spawns if `setupComplete` is not true.

---

---

**PHASE CHECK**: Setup complete? → workflow-gate.js blocks agent spawns until setupComplete = true.

---

## Phase 4: Execute Waves (Core Loop)

Read `AGENT-SPAWN-TEMPLATES.md` NOW (deferred until needed — this reduces initial context consumption).

For each wave, in dependency order:

### 4a. Create Workbranches

```bash
# Create worktree with workbranch from feature branch HEAD
git checkout <featurePrefix>/<feature-name>
git worktree add <worktreeDir>/<feature-name>/<task-slug> -b <workPrefix>/<feature-name>/<task-slug>
```

Create one worktree per task in this wave.

### 4b. Spawn Coding Agents

Use the templates from `AGENT-SPAWN-TEMPLATES.md`. Every coding agent MUST receive:

- Task description + acceptance criteria
- File scope (what to create/modify)
- Pre-digested rules (5-10 rules from project rules + architecture that apply to this task)
- Filled QA checklist (use `QA-CHECKLIST-AUTO-FILL-RULES.md` to pre-select sections by role)
- Context budget note (see `CONTEXT-BUDGET-GUIDE.md` — estimate before spawning, split if over threshold)
- Worktree path: `<worktreeDir>/<feature-name>/<task-slug>` — agent must work from this directory
- Instructions: "Your working directory is `<worktreeDir>/<feature-name>/<task-slug>`. Run all commands from this directory."

**Critical — Agent Communication Instructions:**

Every coding agent prompt MUST include these exact instructions for communicating back to the team leader:

```
COMMUNICATION RULES:
- You are a member of team "<feature-name>".
- Your team leader's name is "<TEAM_LEADER_NAME>" (from Step 1.7).
- When you complete your work, send a completion report via:
    SendMessage(to: "<TEAM_LEADER_NAME>", message: "<your report>", summary: "Task <N> complete")
- Do NOT attempt to spawn QA agents or any other agents — you cannot. Only the Team Leader spawns agents.
- Do NOT use SendMessage to contact other coding agents — communicate only with the Team Leader.
- If you encounter a blocking issue, message the Team Leader immediately — do not silently fail.
```

**What coding agents must NOT be told:**
- ~~"spawn QA when done"~~ — they CANNOT spawn teammates. `workflow-gate.js` will block it.
- ~~"contact peer agents"~~ — they should only communicate with the team leader.

**Model routing** (see `CONTEXT-BUDGET-GUIDE.md` for cost details):
- Coding agents: `model: "sonnet"` — focused file-scope work
- QA agents: `model: "haiku"` — read-only review work
- Guardian: `model: "sonnet"` — cross-module analysis

**Background execution**: Spawn coding agents with `run_in_background: true` and `team_name: "<feature-name>"`. The Agent tool returns a `task_id` for each spawned agent — **save this ID**. Use `TaskOutput` with the saved `task_id` to check agent results when needed.

### 4c. Monitor & Spawn QA (Team Leader Responsibility)

> **⚠️ The Team Leader (YOU) owns the entire QA lifecycle.** Coding agents cannot spawn QA agents. They can only report completion back to you via SendMessage. You MUST spawn QA for each completed task.

**Communication flow:**

```
Coding Agent                    Team Leader (you)                QA Agent
     |                                |                              |
     |-- SendMessage: "done" -------->|                              |
     |                                |-- Spawn QA agent ----------->|
     |                                |                              |-- reviews code
     |                                |<-- SendMessage: "QA PASS" ---|
     |                                |                              |
     |                                |-- /track qa.passed --------->| (emit event!)
     |                                |-- proceed to merge           |
     |                                |                              |
     |                        --- OR if QA FAIL ---                  |
     |                                |<-- SendMessage: "QA FAIL" ---|
     |                                |                              |
     |                                |-- /track qa.failed --------->| (emit event!)
     |<-- SendMessage: "fix these" ---|                              |
     |-- fixes code                   |                              |
     |-- SendMessage: "done" -------->|                              |
     |                                |-- Spawn NEW QA agent ------->|
```

**Step-by-step:**

1. **Wait for coding agent completion.** Coding agents send completion messages via SendMessage. You will receive these automatically — do NOT poll worktree directories (the `team-leader-gate.js` worktree polling gate will block `ls`, `cat`, `git log` etc. on worktree paths).

2. **Spawn QA agent for each completed task.** When a coding agent reports complete:
   - Use the QA template from `AGENT-SPAWN-TEMPLATES.md`
   - Spawn with `team_name: "<feature-name>"` so the QA agent joins the team
   - Include in the QA prompt: the coding agent's reported plan, files changed, the pre-filled QA checklist
   - QA agent prompt MUST include:
     ```
     COMMUNICATION RULES:
     - You are a QA reviewer on team "<feature-name>".
     - Send your review result to the Team Leader via:
         SendMessage(to: "<TEAM_LEADER_NAME>", message: "<full report>", summary: "QA PASS Task #<N>" or "QA FAIL Task #<N>")
     - You CANNOT spawn agents or contact coding agents directly.
     ```

3. **On QA PASS:**
   - **Emit the tracking event:** `/claude-workflow:track qa.passed` with `task` and `branch` data. **This is REQUIRED** — the `team-leader-gate.js` merge gate checks `events.jsonl` for a `qa.passed` event before allowing any merge. Without this event, the merge will be blocked with: _"Branch does not have a QA pass."_
   - Proceed to merge (Phase 4d).

4. **On QA FAIL:**
   - **Emit the tracking event:** `/claude-workflow:track qa.failed` with the failure details.
   - Forward the QA report to the coding agent via `SendMessage(to: "<coding-agent-name>", message: "<QA report with fix instructions>")`.
   - Wait for the coding agent to send a new completion message after fixes.
   - Spawn a NEW QA agent (do not reuse the previous one — spawn a fresh instance).
   - Maximum QA rounds: 3. After 3 failures, escalate to the user.

5. **On QA FAIL (max rounds exceeded):**
   - Inform the user with the full QA report history.
   - Ask whether to: (a) manually fix and retry, (b) skip QA for this task, (c) abort the feature.

### 4d. Merge Completed Workbranches

For each workbranch with QA PASS **and a `qa.passed` event in events.jsonl** (one at a time, sequentially):

```bash
# Rebase workbranch on latest feature HEAD (from worktree)
git -C <worktreeDir>/<feature-name>/<task-slug> rebase <featurePrefix>/<feature-name>

# Merge to feature branch
git checkout <featurePrefix>/<feature-name>
git merge --no-ff <workPrefix>/<feature-name>/<task-slug> \
  -m "Merge <workPrefix>/<feature-name>/<task-slug>: <summary>"

# Emit merge tracking event — REQUIRED for merge gate bookkeeping
/claude-workflow:track branch.merged "Merged <task-slug> to <featurePrefix>/<feature-name>"

# Remove worktree
git worktree remove <worktreeDir>/<feature-name>/<task-slug>

# Delete workbranch
git branch -d <workPrefix>/<feature-name>/<task-slug>
```

> **Gate dependency:** `team-leader-gate.js` checks that a `qa.passed` event exists for the branch being merged AND that no `branch.merged` event has already been recorded for it. If you skip the `/track qa.passed` in step 4c, this merge WILL be blocked.

Update progress file: branch status, merge log, task status.

### 4e. Wave Fence & Next Wave

After all workbranches in the current wave are merged, run the wave fence check (see `WAVE-FENCE-PROTOCOL.md`):
- **Strict mode**: full verify — lint, typecheck, test, build must all pass
- **Standard mode**: quick verify — lint only
- **Fast mode**: skip fence, proceed immediately

If the fence check passes:
- Emit: `/claude-workflow:track checkpoint "wave-N-complete"` (where N is the completed wave number)
- Create next wave's workbranches from updated `feature/` HEAD
- Spawn next wave's agents

When ALL waves are complete:
- Emit: `/claude-workflow:track checkpoint "all-waves-complete"`
  This transitions the FSM from `wave` → `guardian`.

### Phase 4 Completion Checklist (per wave)

**After EACH wave, verify every item before starting the next wave. Do NOT skip any.**

```
WAVE <N> VERIFICATION:
[ ] 4a — Worktree created for each task in this wave (git worktree list confirms)
[ ] 4b — Each coding agent spawned with: team_name, COMMUNICATION RULES block, worktree path, file scope
[ ] 4b — Each coding agent prompt does NOT contain "spawn QA" instructions
[ ] 4b — Each coding agent's task_id saved for tracking
[ ] 4c — For EACH completed task:
    [ ] Coding agent sent completion via SendMessage (received by team leader)
    [ ] QA agent spawned BY TEAM LEADER (not by coding agent) with team_name + COMMUNICATION RULES
    [ ] QA result received via SendMessage
    [ ] If QA PASS: /track qa.passed emitted with task + branch data
    [ ] If QA FAIL: /track qa.failed emitted, fix instructions forwarded to coding agent, new QA spawned
[ ] 4d — For EACH QA-passed task:
    [ ] Rebase completed without conflicts
    [ ] Merge completed with --no-ff
    [ ] /track branch.merged emitted
    [ ] Worktree removed
    [ ] Workbranch deleted
[ ] 4e — Wave fence check passed (strict: full verify, standard: lint, fast: skip)
[ ] 4e — /track checkpoint "wave-<N>-complete" emitted
```

**After ALL waves are complete:**

```
PHASE 4 FINAL VERIFICATION:
[ ] All waves completed and checkpointed
[ ] All worktrees removed (git worktree list shows none under <worktreeDir>/<feature-name>/)
[ ] All workbranches deleted (git branch --list "<workPrefix>/<feature-name>/*" returns empty)
[ ] /track checkpoint "all-waves-complete" emitted (workflow-state.json shows phase: "guardian")
```

If ANY item is unchecked → go back and complete it. The workflow-gate.js will BLOCK Guardian spawn if phase is not `guardian`.

---

---

**PHASE CHECK**: All waves complete? → workflow-gate.js blocks Guardian spawn until phase = guardian.

---

## Phase 5: Codebase Guardian Check

When ALL tasks have QA PASS and all workbranches are merged:

1. Spawn Codebase Guardian on `feature/<feature-name>` (see `AGENT-SPAWN-TEMPLATES.md`)
   - Guardian runs on the main repo (NOT in a worktree) on the feature branch
   - Include `team_name: "<feature-name>"` so Guardian joins the team
2. Guardian runs 7 structural integrity checks
3. **On PASS:**
   - **Emit:** `/claude-workflow:track checkpoint "guardian-passed"`
   - This sets `state.guardianPassed = true` — **REQUIRED** to unblock Phase 7 (shutdown, TeamDelete)
   - Proceed to Phase 6
4. **On FAIL:** fix issues (Guardian may fix trivial ones), re-run Guardian. Do NOT emit `guardian-passed` until Guardian passes.

> **⚠️ BRANCH GUARD NOTE:** If the Guardian needs to commit fixes on the feature branch, `safety-guard.js` branch guard will **warn** (enforce: `warn`) or **block** (enforce: `block`) the commit. If enforce is `block`, the Guardian prompt should instruct it to note the needed fixes and report back rather than committing directly — the team leader can then spawn a coding agent on a workbranch to apply the fix.

> **Gate dependency:** Without the `guardian-passed` checkpoint:
> - `team-leader-gate.js` blocks ALL `SendMessage` shutdown requests: _"Cannot shut down agents before Guardian passes."_
> - `team-leader-gate.js` blocks ALL `TaskStop` calls: _"Cannot stop background agents before Guardian passes."_
> - `enforcement-gate.js` blocks `TeamDelete`: _"TeamDelete blocked until Guardian passes."_
> The workflow is **permanently stuck** if you skip this event.

### Phase 5 Completion Checklist

**Before proceeding to Phase 6, verify every item. Do NOT skip any.**

```
PHASE 5 VERIFICATION:
[ ] Guardian spawned on feature branch (NOT in a worktree) with team_name
[ ] Guardian completed all 7 structural integrity checks
[ ] Guardian result is PASS (if FAIL: issues fixed and Guardian re-run until PASS)
[ ] /track checkpoint "guardian-passed" emitted (workflow-state.json shows guardianPassed: true)
```

If `guardianPassed` is not true → team-leader-gate.js will block ALL shutdown requests, TaskStop calls, and TeamDelete. You CANNOT proceed to Phase 7 cleanup.

---

## Phase 6: Final Verification

Run full verification on the merged feature branch:

```bash
git checkout <featurePrefix>/<feature-name>

# Run all project checks (adapt to actual toolchain)
npm run lint
npm run typecheck    # or: npx tsc --noEmit
npm run test
npm run build
```

All must pass. If any fail, you need to fix the issues — but be aware of enforcement-gate V7:

> **⚠️ ENFORCEMENT GATE V7:** The Team Leader CANNOT directly edit app code files while the workflow is active (phase is not `done`) and you're on a feature branch (not a work/ branch). If verification fails and fixes are needed:
> 1. **Preferred:** Spawn a coding agent on a new workbranch to make the fix, QA it, and merge — same as Phase 4.
> 2. **Quick fix:** If the fix is trivial (e.g., import order, lint auto-fix), the Guardian may have already addressed it. Re-run verification first.
> 3. **Override:** If the user explicitly requests it, they can temporarily set `guards.enforcementGate: false` in `.claude/workflow.json` to allow direct edits, then re-enable it after.

### Phase 6 Completion Checklist

**Before proceeding to Phase 7, verify every item. Do NOT skip any.**

```
PHASE 6 VERIFICATION:
[ ] On feature branch (git symbolic-ref --short HEAD confirms <featurePrefix>/<feature-name>)
[ ] Lint passes
[ ] Typecheck passes (if applicable)
[ ] Tests pass
[ ] Build passes (if applicable)
```

If ANY check fails → fix the issue on the feature branch and re-run. Do NOT proceed to cleanup with a broken build.

---

---

**PHASE CHECK**: Guardian passed? → team-leader-gate.js blocks shutdown until guardianPassed = true.

---

## Phase 7: Completion & Cleanup

> **⚠️ ORDER MATTERS.** Shut down agents BEFORE emitting `session.end`. Once `session.end` is emitted, the FSM transitions to `done` and `enforcement-gate.js` stops blocking app code writes — any still-running agents could write files after the session is "ended."

1. **Shut down all agents** — Send shutdown requests to every agent via `SendMessage`:
   ```
   SendMessage(to: "<agent-name>", message: { type: "shutdown_request", reason: "Feature complete" })
   ```
   Wait for each agent to acknowledge the shutdown (approve response). If an agent rejects, investigate why before forcing.

2. **Confirm all agents stopped** — Verify no agents are still running. Check `TaskOutput` for any background tasks that haven't completed.

3. **Emit session.end** — `/claude-workflow:track session.end "Feature complete"`
   This transitions the FSM to `done`.

4. **Update design doc** — status: IMPLEMENTED (if applicable)

5. **Clean up worktrees** — Remove any remaining worktrees:
   ```bash
   git worktree list   # identify any under <worktreeDir>/<feature-name>/
   git worktree remove <path>  # for each remaining one
   ```

6. **Delete the team** — `TeamDelete`
   > This is now unblocked because `guardianPassed = true` (set in Phase 5).

7. **Report to user** — summary of what was built, files changed, branch name

8. **Create PR** — if requested:
   ```bash
   git push -u origin <featurePrefix>/<feature-name>
   gh pr create --title "<feature title>" --body "<summary>"
   ```
   > **⚠️ BRANCH GUARD NOTE:** `safety-guard.js` will **warn** (enforce: `warn`) or **block** (enforce: `block`) `git push` on a feature branch. If enforce is `block`, you must either:
   > - Temporarily set `branching.enforce: "warn"` in `.claude/workflow.json` for the push
   > - Or ask the user to run `git push` manually

### Phase 7 Completion Checklist

**Verify the workflow completed cleanly. Do NOT skip any.**

```
PHASE 7 VERIFICATION:
[ ] All agents shut down — each received shutdown_request and sent approve response
[ ] No background tasks still running (TaskOutput confirms all completed)
[ ] session.end emitted AFTER all agents stopped (workflow-state.json shows phase: "done")
[ ] Design doc updated to IMPLEMENTED (if applicable)
[ ] No remaining worktrees (git worktree list shows only main working tree)
[ ] No remaining workbranches (git branch --list "<workPrefix>/<feature-name>/*" returns empty)
[ ] TeamDelete completed successfully
[ ] User informed with summary: files changed, branch name, what was built
[ ] PR created (if requested by user)
```

---

## Quick Reference — Agent Roles

| Agent | Typical File Scope | When to Use |
|-------|-------------------|-------------|
| Schema/type designer | Types, schemas, contracts | New data models, API contracts |
| Service engineer | Business logic, domain services | Backend functionality |
| API/handler engineer | Routes, controllers, handlers | API endpoints, request handling |
| State engineer | Stores, state management | Client state |
| Hook/data engineer | Data fetching, event hooks | Data layer for UI |
| Component engineer | UI components, pages | Frontend features |
| Router engineer | Routes, navigation, layouts | Page routing |
| Database engineer | Migrations, queries, schemas | Database changes |
| QA reviewer | READ ONLY (+docs on PASS) | Per-task quality gate |
| Codebase Guardian | Feature branch (structural) | Final integrity check |

See `.claude/agents/` for all specialist definitions.

---

## Quick Reference — Branching Commands

```bash
# Feature branch (once, from configured base)
git checkout <base-branch> && git checkout -b <featurePrefix>/<name>

# Worktree per task (from feature branch HEAD)
git checkout <featurePrefix>/<name>
git worktree add <worktreeDir>/<name>/<task> -b <workPrefix>/<name>/<task>

# Pre-merge rebase (from worktree)
git -C <worktreeDir>/<name>/<task> rebase <featurePrefix>/<name>

# Merge workbranch
git checkout <featurePrefix>/<name> && git merge --no-ff <workPrefix>/<name>/<task> -m "Merge ..."

# Cleanup
git worktree remove <worktreeDir>/<name>/<task>
git branch -d <workPrefix>/<name>/<task>

# List worktrees
git worktree list

# List workbranches
git branch --list "<workPrefix>/<name>/*"

# PR
git push -u origin <featurePrefix>/<name>
gh pr create --title "..." --body "..."
```
