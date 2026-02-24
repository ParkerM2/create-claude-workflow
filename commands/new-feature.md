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

## Phase 1: Load Context

### Pre-Validation (before reading any files)

1. **Git repo check**: Run `git rev-parse --git-dir`. If this fails, inform the user: "This directory is not a git repository. Initialize one with `git init` and make an initial commit before running /new-feature."
2. **Primary branch detection**: Detect the primary branch name (main/master/other) and store it. Use this throughout instead of hardcoding `main`.
3. **Branching config**: Read branching configuration from `<workflow-config>`. Use configured `baseBranch` (resolve `"auto"` to detected primary branch), `featurePrefix`, `workPrefix`, `worktreeDir`.
4. **Progress directory**: Create `.claude/progress/<feature-name>/` directory if it doesn't exist.
5. **Branch check**: If `feature/<feature-name>` already exists, inform the user and suggest `/resume` instead of creating a duplicate.

First, check if a design document exists for this feature (created by `/new-plan`):

```bash
ls the progress directory/*-design.md
```

### Path A: Design Doc Exists (lightweight reads)

If a design doc exists, it already contains the consolidated task breakdown, wave plan, file ownership,
context budgets, QA strategy, and extracted rules. Read only what the doc doesn't contain:

```
READS (Path A — design doc exists):
1. prompts/implementing-features/PHASE-GATE-PROTOCOL.md  — Gate state machine (always needed)
2. The design doc itself                                   — Contains everything consolidated
3. prompts/implementing-features/WORKFLOW-MODES.md        — Only if mode not specified in design doc
```

**Skip**: README.md, QA-CHECKLIST-TEMPLATE.md, PROGRESS-FILE-TEMPLATE.md, project rules, architecture file — all consolidated into the design doc.

**Defer**: AGENT-SPAWN-TEMPLATES.md → Phase 6, QA-CHECKLIST-TEMPLATE.md → Phase 6 (only if expansion needed).

Use the design doc as your decomposition plan in Phase 3 instead of planning from scratch.

### Path B: No Design Doc (lazy-load pattern)

If no design doc exists, load context incrementally by phase:

```
PHASE 1 READS (before planning):
1. prompts/implementing-features/PHASE-GATE-PROTOCOL.md  — Gate state machine
2. the project rules file                                  — Project rules
3. the architecture file                                   — System architecture
4. prompts/implementing-features/WORKFLOW-MODES.md        — Workflow mode definitions

PHASE 3 READS (when building QA checklists):
5. prompts/implementing-features/README.md                — The full playbook
6. prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md — QA checklist per task
7. prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md — Auto-fill rules

PHASE 4 READS (when creating progress file):
8. prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md — Progress tracking format

PHASE 6 READS (when spawning agents):
9. prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md  — Spawn templates
10. prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md  — Context budget guide
```

Do NOT read deferred files upfront. Read each one at the moment its phase begins.

### Resolve Workflow Mode

Determine the active workflow mode (see `WORKFLOW-MODES.md`):
1. Check if the user specified a mode with this invocation
2. Check the project rules file for a `Workflow Mode` section
3. Default to `strict` if not specified

Record the resolved mode — it affects pre-flight, QA rounds, Guardian, and wave fences.

### Pre-Flight Checks (Strict Mode Only)

If workflow mode is `strict`, run pre-flight checks before proceeding (see `PRE-FLIGHT-CHECKS.md`):
- Verify build, lint, typecheck, and tests pass on the base branch
- Record the baseline in the progress file
- If baseline is broken: warn the user and do not proceed until resolved

**Phase 1 transition is automatic** — the `session.start` event (emitted in Phase 4) initializes the FSM in `plan` phase.

---

## Phase 2: Check for Existing Progress

Check if this feature was already started by a previous (possibly crashed) session:

```bash
# Check for existing progress file
ls the progress directory/

# Check for existing workbranches
git branch --list "work/*"

# Check for existing feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/
```

If a feature directory exists in the progress directory with an `events.jsonl` file:
1. Read events.jsonl to understand current state — scan for last checkpoint, task states, errors
2. Check for `session.end` event — if missing, previous session was interrupted
3. Read `current.md` for quick state overview
4. Suggest `/resume` instead of starting fresh
5. Skip to the appropriate phase below

---

```
═══════════════════════════════════════════
PHASE CHECK: Verify context loaded before proceeding
Required:
  Path A (design doc): PHASE-GATE-PROTOCOL.md read, design doc read
  Path B (no design doc): PHASE-GATE-PROTOCOL.md read, project rules file read, architecture file read
  - Workflow mode resolved (strict/standard/fast) and recorded
  - Branching config read from <workflow-config>
═══════════════════════════════════════════
```

## Phase 3: Plan & Decompose

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

**After completing Phase 3, emit:** `/claude-workflow:track plan.created "<summary>"`
This transitions the FSM from `plan` → `setup`.

---

```
═══════════════════════════════════════════
PHASE CHECK: Verify plan complete before proceeding
Required:
  - Written decomposition plan produced (feature summary, rules cited, task list)
  - Each task has: agent role, file scope, acceptance criteria, QA checklist
  - Dependency map defined (which tasks block which)
  - Wave plan finalized (tasks grouped by dependency layer)
  - Context budget checked per task (8,000 + files × 1,000 + 3,000)
  - `plan.created` event emitted
═══════════════════════════════════════════
```

## Phase 4: Create Feature Branch & Progress File

```bash
# Create feature branch from configured base
git checkout <base-branch>
git checkout -b <featurePrefix>/<feature-name>
```

Create the feature's progress directory and initialize tracking:
1. Create `.claude/progress/<feature-name>/` directory
2. Initialize `workflow-state.json` in the progress directory
3. Emit `session.start` event to `events.jsonl` via `/claude-workflow:track session.start`
4. The `current.md` file is rendered when `/claude-workflow:track` is called for significant events

The `events.jsonl` file is your **crash-recovery artifact**. Events are appended via `/claude-workflow:track` commands at key checkpoints.

**After completing Phase 4 + Phase 5 (branch, team, tasks ready), emit:**
`/claude-workflow:track checkpoint "setup-complete"`
This transitions the FSM from `setup` → `wave` and sets `setupComplete=true`.

---

```
═══════════════════════════════════════════
PHASE CHECK: Verify setup complete before spawning agents
Required:
  - Feature branch created from configured base branch
  - TeamCreate called with feature name
  - TaskCreate called for ALL tasks with full descriptions and blockedBy dependencies
  - Progress file initialized: .claude/progress/<feature>/events.jsonl exists
  - session.start event emitted via /claude-workflow:track
  - checkpoint "setup-complete" emitted
═══════════════════════════════════════════
```

## Phase 5: Set Up Team & Tasks

```
1. TeamCreate — team_name: "<feature-name>"
2. TaskCreate — one per task, with full description + acceptance criteria
3. TaskUpdate — set addBlockedBy dependencies for each task
4. Update progress file with task list + dependency graph
```

---

## Phase 6: Execute Waves (Core Loop)

Read `AGENT-SPAWN-TEMPLATES.md` NOW (deferred until needed — this reduces initial context consumption).

For each wave, in dependency order:

### 6a. Create Workbranches

```bash
# Create worktree with workbranch from feature branch HEAD
git checkout <featurePrefix>/<feature-name>
git worktree add <worktreeDir>/<feature-name>/<task-slug> -b <workPrefix>/<feature-name>/<task-slug>
```

Create one worktree per task in this wave.

### 6b. Spawn Agents

Use the templates from `AGENT-SPAWN-TEMPLATES.md`. Every agent MUST receive:

- Task description + acceptance criteria
- File scope (what to create/modify)
- Pre-digested rules (5-10 rules from project rules + architecture that apply to this task)
- Filled QA checklist (use `QA-CHECKLIST-AUTO-FILL-RULES.md` to pre-select sections by role)
- Context budget note (see `CONTEXT-BUDGET-GUIDE.md` — estimate before spawning, split if over threshold)
- Instructions to commit on workbranch and spawn QA when done
- Worktree path: `<worktreeDir>/<feature-name>/<task-slug>` — agent must work from this directory
- Instructions: "Your working directory is `<worktreeDir>/<feature-name>/<task-slug>`. Run all commands from this directory."

**Model routing** (see `CONTEXT-BUDGET-GUIDE.md` for cost details):
- Coding agents: `model: "sonnet"` — focused file-scope work
- QA agents: `model: "haiku"` — read-only review work
- Guardian: `model: "sonnet"` — cross-module analysis

**Background execution**: Spawn coding agents with `run_in_background: true`. The Team Leader continues coordinating (setting up next worktrees, updating progress) while agents work. Check results via agent messages or `TaskOutput`.

### 6c. Monitor & Collect Results

- Track agent completion messages
- On QA PASS: proceed to merge
- On QA FAIL (round < 3): agent handles re-work automatically
- On QA FAIL (round 3): escalate to user

### 6d. Merge Completed Workbranches

For each workbranch with QA PASS (one at a time, sequentially):

```bash
# Rebase workbranch on latest feature HEAD (from worktree)
git -C <worktreeDir>/<feature-name>/<task-slug> rebase <featurePrefix>/<feature-name>

# Merge to feature branch
git checkout <featurePrefix>/<feature-name>
git merge --no-ff <workPrefix>/<feature-name>/<task-slug> \
  -m "Merge <workPrefix>/<feature-name>/<task-slug>: <summary>"

# Emit merge tracking event
/claude-workflow:track branch.merged "Merged <task-slug> to <featurePrefix>/<feature-name>"

# Remove worktree
git worktree remove <worktreeDir>/<feature-name>/<task-slug>

# Delete workbranch
git branch -d <workPrefix>/<feature-name>/<task-slug>
```

Update progress file: branch status, merge log, task status.

### 6e. Wave Fence & Next Wave

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

---

```
═══════════════════════════════════════════
PHASE CHECK: Verify all waves complete before Guardian
Required:
  - All wave checkpoints emitted (wave-1-complete, wave-2-complete, etc.)
  - checkpoint "all-waves-complete" emitted
  - No open workbranches: git branch --list "work/<feature>/*" returns empty
  - Feature branch contains all merged work and is stable
═══════════════════════════════════════════
```

## Phase 7: Codebase Guardian Check

When ALL tasks have QA PASS and all workbranches are merged:

1. Spawn Codebase Guardian on `feature/<feature-name>` (see `AGENT-SPAWN-TEMPLATES.md`)
2. Guardian runs 7 structural integrity checks
3. If PASS: proceed to Phase 8
4. If FAIL: fix issues (Guardian may fix trivial ones), re-run Guardian

---

## Phase 8: Final Verification

Run full verification on the merged feature branch:

```bash
git checkout feature/<feature-name>

# Run all project checks (adapt to actual toolchain)
npm run lint
npm run typecheck    # or: npx tsc --noEmit
npm run test
npm run build
```

All must pass. If any fail, investigate and fix before proceeding.

---

```
═══════════════════════════════════════════
PHASE CHECK: Verify Guardian passed before completion
Required:
  - Codebase Guardian spawned on <featurePrefix>/ branch
  - Guardian completed all 7 structural integrity checks
  - Guardian reported PASS (or trivial fixes committed and re-verified)
  - Full verification run: lint, typecheck, test, build all pass
  - checkpoint "guardian-passed" emitted (sets guardianPassed=true)
═══════════════════════════════════════════
```

## Phase 9: Completion & Cleanup

1. **Emit session.end** — `/claude-workflow:track session.end "Feature complete"`
2. **Update design doc** — status: IMPLEMENTED (if applicable)
3. **Shut down all agents** — send shutdown requests
4. **Clean up worktrees** — Remove any remaining worktrees: `git worktree list` and `git worktree remove` for each
5. **Delete the team** — `TeamDelete`
6. **Report to user** — summary of what was built, files changed, branch name
7. **Create PR** — if requested:
   ```bash
   git push -u origin feature/<feature-name>
   gh pr create --title "<feature title>" --body "<summary>"
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
