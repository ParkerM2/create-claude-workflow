# Implementing Features — Team Leader Playbook

> The definitive guide for Team Leader agents orchestrating feature implementation using Claude Agent Teams. Every feature — new, refactor, or bug fix — follows this playbook.

---

## Table of Contents

1. [Lifecycle Overview](#1-lifecycle-overview)
2. [Branching Strategy](#2-branching-strategy)
3. [Progress Tracking (Crash-Safe)](#3-progress-tracking-crash-safe)
4. [Task Decomposition](#4-task-decomposition)
5. [Agent Teams Setup](#5-agent-teams-setup)
6. [Agent Initialization Protocol](#6-agent-initialization-protocol)
7. [QA Verification Workflow](#7-qa-verification-workflow)
8. [Merge Protocol](#8-merge-protocol)
9. [Codebase Guardian — Final Gate](#9-codebase-guardian--final-gate)
10. [Crash Recovery](#10-crash-recovery)
11. [Workflow Modes](#11-workflow-modes)
12. [Wave Fence Protocol](#12-wave-fence-protocol)
13. [Pre-Flight Checks](#13-pre-flight-checks)
14. [Context Budget Management](#14-context-budget-management)

For the QA Checklist Template, see: [`QA-CHECKLIST-TEMPLATE.md`](./QA-CHECKLIST-TEMPLATE.md)
For the Progress File Template, see: [`PROGRESS-FILE-TEMPLATE.md`](./PROGRESS-FILE-TEMPLATE.md)
For Agent Spawn Templates, see: [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md)
For Workflow Modes, see: [`WORKFLOW-MODES.md`](./WORKFLOW-MODES.md)
For Wave Fence Protocol, see: [`WAVE-FENCE-PROTOCOL.md`](./WAVE-FENCE-PROTOCOL.md)
For Pre-Flight Checks, see: [`PRE-FLIGHT-CHECKS.md`](./PRE-FLIGHT-CHECKS.md)
For Context Budget Guide, see: [`CONTEXT-BUDGET-GUIDE.md`](./CONTEXT-BUDGET-GUIDE.md)
For QA Auto-Fill Rules, see: [`QA-CHECKLIST-AUTO-FILL-RULES.md`](./QA-CHECKLIST-AUTO-FILL-RULES.md)
For Performance Logging, see: [`AGENT-PERFORMANCE-LOG-TEMPLATE.md`](./AGENT-PERFORMANCE-LOG-TEMPLATE.md)

---

## 1. Lifecycle Overview

Every feature passes through these phases. No phase may be skipped.

```
PLAN ──▶ BRANCH ──▶ TRACK ──▶ ASSIGN ──▶ BUILD ──▶ QA ──▶ MERGE ──▶ GUARDIAN ──▶ PR
  │         │         │          │          │        │        │          │           │
  │         │         │          │          │        │        │          │           └─ Create PR from
  │         │         │          │          │        │        │          │              feature/ to main
  │         │         │          │          │        │        │          │
  │         │         │          │          │        │        │          └─ Codebase Guardian
  │         │         │          │          │        │        │             runs on merged
  │         │         │          │          │        │        │             feature branch
  │         │         │          │          │        │        │
  │         │         │          │          │        │        └─ Rebase workbranch
  │         │         │          │          │        │           on feature/, merge
  │         │         │          │          │        │           --no-ff, delete branch
  │         │         │          │          │        │
  │         │         │          │          │        └─ QA reviews code on
  │         │         │          │          │           workbranch. On PASS:
  │         │         │          │          │           updates docs, commits.
  │         │         │          │          │
  │         │         │          │          └─ Agent works + commits
  │         │         │          │             on workbranch
  │         │         │          │
  │         │         │          └─ TeamCreate, TaskCreate,
  │         │         │             spawn agents on workbranches
  │         │         │
  │         │         └─ Create progress file at
  │         │            the progress directory/<feature>-progress.md
  │         │
  │         └─ Create feature/<name> from main
  │
  └─ Read requirements, decompose into
     tasks, map dependencies, plan waves
```

---

## 2. Branching Strategy

### Branch Hierarchy

```
<base-branch> (configurable — default: auto-detected main/master)
  └── <featurePrefix>/<feature-name>                    ← Team Leader creates from base
       ├── Worktree: <worktreeDir>/<feature>/task-1     ← Wave 1 agent (isolated)
       ├── Worktree: <worktreeDir>/<feature>/task-2     ← Wave 2 agent (isolated)
       ├── Worktree: <worktreeDir>/<feature>/task-3     ← Wave 3 agent (isolated)
       └── ...
```

### Rules

1. **`<featurePrefix>/<name>`** is created from the configured base branch at the start of the feature
2. For each task, create a worktree: `git worktree add <worktreeDir>/<feature>/<task-slug> -b <workPrefix>/<feature>/<task-slug>`
3. Agents work exclusively in their worktree directory — no direct commits to `<featurePrefix>/`
4. After QA passes on a workbranch, the Team Leader merges it to `<featurePrefix>/<name>` from the main repo
5. Remove worktree after merge: `git worktree remove <worktreeDir>/<feature>/<task-slug>`
6. Next wave's worktrees are created from the UPDATED `<featurePrefix>/<name>` HEAD
7. Workbranches are deleted after successful merge

All prefixes (`featurePrefix`, `workPrefix`, `worktreeDir`) are configurable in `.claude/workflow.json`. Read them from `<workflow-config>` at session start.

### Why Worktrees

- **True parallel execution** — agents in the same wave work in isolated directories with no checkout conflicts
- **No switching overhead** — each agent stays in its worktree for its entire lifecycle
- **Clean state** — each worktree has its own working directory, index, and HEAD
- **Configurable** — set `useWorktrees: false` in config to fall back to the shared-directory model

### Creating Branches

```bash
# Create feature branch (once, at start)
git checkout <base-branch>
git checkout -b <featurePrefix>/<feature-name>

# Create worktree per task (from feature HEAD)
git checkout <featurePrefix>/<feature-name>
git worktree add <worktreeDir>/<feature-name>/<task-slug> -b <workPrefix>/<feature-name>/<task-slug>
```

### Conflict Prevention (5 Layers)

| Layer | Mechanism | How It Works |
|-------|-----------|-------------|
| 1 | File scoping | No two agents edit the same file |
| 2 | Wave ordering | Dependency-based execution: schema → service → UI |
| 3 | Pre-merge rebase | Workbranch rebased on `feature/` before merge |
| 4 | Sequential merges | One workbranch merged at a time, never parallel |
| 5 | Escalation | Unresolvable conflicts surfaced to user |

---

## 3. Progress Tracking (Crash-Safe)

### Why This Exists

Claude Code sessions can terminate unexpectedly (terminal close, timeout, process kill). The progress file is a **crash-recovery artifact** — when a new session picks up the work, it reads this file to understand exactly where things left off.

### The Progress File

**Location**: `.claude/progress/<feature-name>/events.jsonl` (source of truth)

**Rendered summaries**:
- `.claude/progress/<feature-name>/current.md` — active task state
- `.claude/progress/<feature-name>/history.md` — full timeline
- `.claude/progress/index.md` — dashboard across all features

**Template**: See [`PROGRESS-FILE-TEMPLATE.md`](./PROGRESS-FILE-TEMPLATE.md) for the current.md format

**Event Schema**: See [`EVENT-SCHEMA.md`](./EVENT-SCHEMA.md) for the JSONL event type reference

The Team Leader MUST create this file BEFORE spawning any agents.

### When to Update

Update the progress file after EVERY significant state change:

| Event | What to Update |
|-------|---------------|
| Team + tasks created | Task list, dependency graph |
| Workbranch created | Branch status table, agent registry |
| Agent completes work | Task status, files created/modified |
| QA cycle (pass/fail) | QA results section, task QA status |
| Workbranch merged | Branch status (Merged = YES), merge log |
| Integration complete | Overall status → COMPLETE |

Events are emitted via `/track` commands or automatically by PostToolUse hooks (tracker.js, git-tracker.js).

### Branch Status Table

The progress file includes a **branch status table** — the key crash-recovery data:

```markdown
| Branch | Task | Agent | Status | Merged to Feature? |
|--------|------|-------|--------|---------------------|
| work/<feature>/schema | #1 | schema-designer | COMPLETE | YES |
| work/<feature>/service | #2 | service-eng | QA_PASS | NO |
| work/<feature>/ui | #3 | component-eng | IN_PROGRESS | NO |
```

This tells a recovering session exactly which branches exist, what state they're in, and which still need to be merged.

---

## 4. Task Decomposition

### Principles

Each task MUST:
- Be assignable to exactly ONE agent
- Have a clear file scope (specific files to create/modify)
- Have explicit acceptance criteria
- Have NO file-level overlap with any other task
- Include a filled QA checklist (from `QA-CHECKLIST-TEMPLATE.md`)

### Wave Planning

Group tasks into waves based on dependencies:

```
Wave 1: Foundation         — types, schemas, contracts, database migrations
Wave 2: Business logic     — services, domain logic, data processing
Wave 3: Integration layer  — API routes, handlers, middleware, state management
Wave 4: Presentation       — UI components, pages, styling
Wave 5: (automatic)        — QA handles doc updates per workbranch
```

**Within a wave**: tasks that touch DIFFERENT files may run in parallel.
**Across waves**: strictly sequential — each wave waits for the previous to complete and merge.

### Dependency Mapping Example

```
Task #1: Define types and API schemas     [Wave 1, no blockers]
Task #2: Implement business service       [Wave 2, blocked by #1]
Task #3: Create API route handlers        [Wave 3, blocked by #2]
Task #4: Create state management          [Wave 3, blocked by #2]
Task #5: Build UI components              [Wave 4, blocked by #3, #4]
```

---

## 5. Agent Teams Setup

### Creating the Team

```
TeamCreate:
  team_name: "<feature-name>"
  description: "Implementing <feature description>"
```

### Creating Tasks with Dependencies

```
TaskCreate:
  subject: "Define types and schemas"
  description: "<detailed description + acceptance criteria + file list>"
  activeForm: "Defining types and schemas"

TaskCreate:
  subject: "Implement auth service"
  description: "<detailed description>"
  activeForm: "Implementing auth service"

TaskUpdate:
  taskId: "2"
  addBlockedBy: ["1"]   # Service depends on types
```

### Standard Dependency Chain

```
#1 Types/schemas (no blockers)        → Schema agent
#2 Business logic (blocked by #1)     → Service agent
#3 API handlers (blocked by #2)       → Handler agent
#4 State management (blocked by #1)   → Store agent
#5 Data hooks (blocked by #3, #4)     → Hook agent
#6 UI components (blocked by #5)      → Component agent
#7 Guardian check (blocked by all)    → Codebase Guardian
```

Parallel-safe tasks (can run simultaneously if they touch different files):
- Types (#1) + Database migrations (#1b)
- State (#4) + Service (#2) — different files, both depend on types
- Multiple UI components (#6a, #6b) — different component files

---

## 6. Agent Enforcement Protocol

### The Problem

Agents tend to:
1. Receive their prompt and immediately start coding (skipping planning)
2. Hit an error and chase it down rabbit holes, forgetting their original task
3. Run out of context and lose track of rules and guidelines
4. Produce work that doesn't follow project conventions because they never internalized them

### The Solution: Mandatory Phased Workflow

Every agent — coding, QA, and Guardian — operates under a **mandatory phased workflow** with blocking gates between phases. This is enforced through the spawn templates in [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md).

```
PHASE 0: LOAD RULES     ← Read all required files. Do not skim.
         │                 [BLOCKING — cannot proceed until complete]
         ▼
PHASE 1: WRITE PLAN      ← Produce a written plan that cites specific rules.
         │                 [BLOCKING — no code until plan is complete]
         ▼
PHASE 2: EXECUTE PLAN    ← Follow the plan step by step.
         │                 State each step before executing.
         │                 On error → ERROR RECOVERY PROTOCOL
         ▼
PHASE 3: SELF-REVIEW     ← Verify work against Phase 1 plan.
         │                 Re-read plan. Check every criterion.
         ▼
PHASE 4: SPAWN QA        ← Include Phase 1 plan so QA can verify
                           the agent followed it.
```

### Why Written Plans Work

1. **Forces rule internalization** — agents must cite specific rules by name, proving they read and understood them
2. **Creates a context anchor** — when agents drift, they re-read their own plan to snap back
3. **Makes QA verifiable** — QA can compare the agent's work against their stated plan
4. **Survives context loss** — the plan is output as text early, so it remains visible even as context fills up

### Error Recovery Protocol

Every agent has an embedded Error Recovery Protocol that fires when ANY error occurs:

```
1. STOP — do not continue fixing blindly
2. RE-READ Phase 1 plan — this is the context anchor
3. CLASSIFY — is this error in my scope?
   - In scope, my file → fix (max 2 attempts)
   - In scope, not my file → report to Team Leader
   - Out of scope → ignore, continue plan
4. NEVER:
   - Modify files outside scope
   - Refactor unrelated code
   - Abandon plan for tangential investigation
   - Spend more than 2 attempts on one error
```

This prevents the "adventure" behavior where agents see an error and spend 20 minutes chasing it through unrelated files.

### Spawning Agents — ALWAYS Use Full Templates

The Team Leader MUST use the complete spawn templates from [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md). These templates embed the phased workflow and error recovery directly into the agent's prompt.

**NEVER** spawn an agent with a minimal prompt like:
```
"Implement the auth service in src/services/auth.ts"
```

**ALWAYS** use the full template which includes:
- All 4 phases with blocking gates
- Error Recovery Protocol
- Task context (description, acceptance criteria, file scope)
- QA checklist
- Instructions for spawning QA

### What Each Agent Type Plans

| Agent Type | Phase 1 Plan Includes |
|---|---|
| **Coding Agent** | Task summary, applicable rules (cited by section), files to create/modify/avoid, step-by-step implementation order, acceptance criteria mapping, risk assessment |
| **QA Reviewer** | What to review, specific rules to enforce (cited by section), review order per file, automated checks to run, coding agent's plan (for verification) |
| **Codebase Guardian** | Feature scope (all changed files), structural rules to enforce (cited by section), check mapping (which files for each of the 7 checks) |

### Full spawn templates: See [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md)

### 6.5 Defensive Defaults

These guards apply to ALL agents and ALL commands. Follow them automatically.

#### File Existence
- Before reading `the project rules file`: if it doesn't exist, warn the user and continue with project conventions you can infer from the codebase. Do NOT stop.
- Before reading `the architecture file`: if it doesn't exist, skip it. Infer architecture from the codebase directly.
- Before reading any `prompts/` file: if it doesn't exist, the workflow is not fully installed. Warn the user and continue with defaults.

#### Git State
- Before any branch operation, detect the primary branch:
  `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|.*/||'` — if this fails, try `git branch -l main master 2>/dev/null | head -1 | tr -d '* '` — if both fail, ask the user.
- Before `git checkout -b <branch>`: check if the branch already exists with `git branch --list "<branch>"`. If it exists, ask the user whether to resume or overwrite.
- Before any git operation: verify the repo is initialized (`git rev-parse --git-dir`) and has at least one commit (`git log -1`). If not, inform the user.

#### Progress Directory
- Before writing to `the progress directory/`: create it if it doesn't exist (`mkdir -p the progress directory`).

#### Tool Detection
- Do NOT assume `npm run lint`, `npm run test`, etc. exist.
- In Phase 0, determine the project's toolchain: check for `package.json` (npm/yarn/pnpm/bun), `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.
- Adapt all check commands to the detected toolchain. If no toolchain is detected, skip automated checks and note this in the progress file.
- If a check command fails with "command not found" or "script not found", skip that check and log a warning — do NOT treat it as a test failure.

---

## 7. QA Verification Workflow

### Per-Task QA (Not End-of-Pipeline)

Each coding agent is responsible for spawning its own QA reviewer. QA happens on the SAME workbranch, immediately after the coding agent finishes.

### The Flow

```
Coding Agent                           QA Review Agent
     │                                       │
     ├─ works on workbranch                  │
     ├─ commits code                         │
     ├─ runs self-review                     │
     ├─ spawns QA Review Agent ─────────────▶│
     │   (same workbranch)                   ├─ reads task + QA checklist
     │                                       ├─ runs automated checks
     │                                       ├─ reviews every changed file
     │                                       ├─ traces data flow
     │                                       ├─ if FAIL: returns issues
     │◀── QA report ────────────────────────┤
     │                                       │
     ├─ if FAIL:                             │
     │   ├─ fixes issues, commits            │
     │   ├─ spawns NEW QA agent ────────────▶│  (max 3 rounds)
     │                                       │
     ├─ if PASS:                             │
     │   │   QA updates docs ───────────────▶├─ updates the architecture file
     │   │   on workbranch                   ├─ updates other project docs
     │   │                                   ├─ commits doc updates
     │   │                                   │
     │◀── APPROVED report ──────────────────┤
     │                                       │
     ├─ notifies Team Leader                 │
     │   "Task #N QA PASS, ready to merge"   │
     │                                       │
     └─ Team Leader merges workbranch        │
```

### Why QA Updates Docs

- QA just reviewed the code — it has the deepest understanding of the changes
- The workbranch becomes self-contained: code + QA verdict + doc updates
- When the workbranch merges, incremental doc updates come with it
- No separate doc agent needed per task (Codebase Guardian handles final coherence)

### QA Round Limits

- **Maximum 3 QA rounds** per task
- If a task fails QA 3 times, the coding agent reports to the Team Leader
- The Team Leader may reassign, intervene directly, or escalate to the user

### QA Checklist

Every task includes a filled QA checklist from [`QA-CHECKLIST-TEMPLATE.md`](./QA-CHECKLIST-TEMPLATE.md). The Team Leader fills in the feature-specific sections. The QA agent validates every item.

---

## 8. Merge Protocol

### When to Merge

Merge a workbranch to `feature/` when:
1. The coding agent reports QA PASS
2. QA has committed doc updates on the workbranch
3. No other merge is in progress (sequential only)

### Merge Steps

```bash
# 1. Ensure feature branch is up to date
git checkout feature/<feature-name>

# 2. Rebase workbranch on latest feature HEAD (conflict prevention layer 3)
git checkout work/<feature-name>/<task-slug>
git rebase feature/<feature-name>

# 3. Handle rebase conflicts
#    - If trivial (whitespace, import order): resolve and continue
#    - If non-trivial: escalate to user
#    - NEVER force through conflicts silently

# 4. Merge with --no-ff for clear history
git checkout feature/<feature-name>
git merge --no-ff work/<feature-name>/<task-slug> \
  -m "Merge work/<feature-name>/<task-slug>: <brief summary>"

# 5. Verify the merge
git log --oneline -5    # confirm merge commit
npm run lint            # quick sanity check (adapt to project)

# 6. Delete workbranch
git branch -d work/<feature-name>/<task-slug>
```

### Merge Order

- Merge workbranches **one at a time**, in wave order
- Within a wave, merge in task-number order
- After each merge, the next workbranch's rebase picks up the merged changes
- Update the progress file merge log after each merge

### If Merge Fails

1. **Rebase conflict**: Try to resolve. If non-trivial, escalate to user.
2. **Build breaks after merge**: Revert the merge (`git revert -m 1 <merge-commit>`), investigate, fix on workbranch, re-merge.
3. **Test failures after merge**: Same as build break — revert, investigate, fix.

---

## 9. Codebase Guardian — Final Gate

### When to Run

After ALL workbranches are merged to `feature/<name>` and the branch is stable.

### What It Does

The Codebase Guardian runs on the fully-merged feature branch and checks:

1. **File placement** — all new files in correct directories
2. **Module completeness** — no missing exports, tests, types
3. **Cross-module consistency** — types match across modules, contracts are consistent
4. **Dependency direction** — no forbidden imports
5. **Naming conventions** — consistent naming across all changes
6. **Documentation coherence** — per-task doc updates are consistent when combined
7. **Build & test** — full verification on merged branch

### Guardian vs Per-Task QA

| | Per-Task QA | Codebase Guardian |
|---|---|---|
| **Scope** | One workbranch | Entire feature branch |
| **Runs when** | After each task | After all tasks merged |
| **Catches** | Code quality, bugs, missing tests | Cross-cutting issues, structural problems |
| **Modifies files** | Docs only | May fix trivial structural issues |
| **Required** | Yes, per task | Yes, once per feature |

### Spawn template: See [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md)

---

## 10. Crash Recovery

> See also: [`RESUME-PROTOCOL.md`](./RESUME-PROTOCOL.md) for the full JSONL-based recovery flow.

### Detecting a Crashed Session

A new Team Leader session should check for existing progress:

```bash
# Check for progress files
ls the progress directory/*/events.jsonl 2>/dev/null

# Check for workbranches
git branch --list "work/*"

# Check for feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/
```

### Recovery Protocol

1. **Read the JSONL event log** — `events.jsonl` contains the complete event history. Read `current.md` for a quick summary.
2. **Check branch status** — which workbranches exist, which are merged
3. **Check team state** — does the team still exist? Use `TaskList` for task status
4. **Resume from first non-COMPLETE task**:
   - If workbranch exists + has commits → check if QA ran → resume from appropriate step
   - If workbranch exists + no commits → agent hasn't started → re-spawn agent
   - If workbranch doesn't exist + task not merged → create workbranch + spawn agent
5. **Update progress file** — add recovery timestamp, update "Updated By"

### What Makes This Crash-Safe

- **Progress file on disk** — survives terminal close, process kill
- **Git branches persist** — all work is committed, nothing lost
- **Idempotent operations** — re-running a merge that already happened is a no-op
- **Task status in team** — if team exists, `TaskList` shows current state
- **Sequential merges** — partially-merged features have a clear resume point

---

## Quick Reference — Wave Execution

```
┌──────────────────────────────────────────────────────┐
│  WAVE 1: Foundation (no blockers)                     │
│  Create workbranches → spawn agents → QA → merge      │
├──────────────────────────────────────────────────────┤
│  WAVE 2: Business Logic (blocked by Wave 1)           │
│  Create from updated feature/ → spawn → QA → merge    │
├──────────────────────────────────────────────────────┤
│  WAVE 3: Integration (blocked by Wave 2)              │
│  Create from updated feature/ → spawn → QA → merge    │
├──────────────────────────────────────────────────────┤
│  WAVE 4: Presentation (blocked by Wave 3)             │
│  Create from updated feature/ → spawn → QA → merge    │
├──────────────────────────────────────────────────────┤
│  FINAL: Codebase Guardian                             │
│  Runs on merged feature/ → structural check → PR      │
└──────────────────────────────────────────────────────┘
```

Each wave:
1. Team Leader creates workbranches from `feature/` HEAD
2. Agents work + commit on workbranches
3. Agents spawn QA → QA reviews → QA updates docs → QA approves
4. Team Leader rebases workbranch on `feature/` → merges → deletes branch
5. **Wave fence check** — verify the feature branch is stable before proceeding
6. Next wave starts from updated `feature/` HEAD

---

## 11. Workflow Modes

Three modes control ceremony level. The Team Leader resolves the mode at feature start and records it in the progress file.

| Mode | QA Rounds | Guardian | Pre-Flight | Wave Fence |
|------|-----------|----------|------------|------------|
| **strict** (default) | 3 | Yes | Yes | Full verify |
| **standard** | 2 | Yes (auto-fix trivial) | No | Lint only |
| **fast** | 1 | No | No | Skip |

**Resolution priority**: per-invocation override → `the project rules file` setting → default (strict).

Full details: [`WORKFLOW-MODES.md`](./WORKFLOW-MODES.md)

---

## 12. Wave Fence Protocol

The wave fence is a synchronization check between waves — it verifies the feature branch is stable before the next wave starts. Fence strictness follows the workflow mode (full verify / lint only / skip).

Full details: [`WAVE-FENCE-PROTOCOL.md`](./WAVE-FENCE-PROTOCOL.md)

---

## 13. Pre-Flight Checks

In `strict` mode, verify the codebase baseline (lint, typecheck, test, build) before spawning agents. Mandatory for `/refactor` regardless of mode.

Full details: [`PRE-FLIGHT-CHECKS.md`](./PRE-FLIGHT-CHECKS.md)

---

## 14. Context Budget Management

Before spawning each agent, estimate context usage: `8,000 base + (files × 1,000) + 3,000 margin`. If a task touches 13+ files, split it.

Full details: [`CONTEXT-BUDGET-GUIDE.md`](./CONTEXT-BUDGET-GUIDE.md)
