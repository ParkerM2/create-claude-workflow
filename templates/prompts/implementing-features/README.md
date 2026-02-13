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

For the QA Checklist Template, see: [`QA-CHECKLIST-TEMPLATE.md`](./QA-CHECKLIST-TEMPLATE.md)
For the Progress File Template, see: [`PROGRESS-FILE-TEMPLATE.md`](./PROGRESS-FILE-TEMPLATE.md)
For Agent Spawn Templates, see: [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md)

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
  │         │            {{PROGRESS_DIR}}/<feature>-progress.md
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
main/master
  └── feature/<feature-name>                         ← Team Leader creates from main
       ├── work/<feature-name>/schema-design         ← Wave 1 agent
       ├── work/<feature-name>/api-service           ← Wave 2 agent
       ├── work/<feature-name>/ui-components         ← Wave 3 agent
       └── ...
```

### Rules

1. **`feature/<name>`** is created from `main`/`master` at the start of the feature
2. **`work/<feature-name>/<task-slug>`** is created from `feature/<name>` HEAD for each task
3. Agents work exclusively on their workbranch — no direct commits to `feature/`
4. After QA passes on a workbranch, the Team Leader merges it to `feature/<name>`
5. Next wave's workbranches are created from the UPDATED `feature/<name>` HEAD
6. Workbranches are deleted after successful merge

### Why Branches (Not Worktrees)

- Universally compatible — works on all systems, CI environments, and git hosting
- Simpler mental model — one repo, one working directory
- Sequential merges enforce clean, linear history per wave
- No path confusion or cross-worktree file access issues

### Creating Branches

```bash
# Create feature branch (once, at start)
git checkout main
git checkout -b feature/<feature-name>

# Create workbranch (per task, from feature HEAD)
git checkout feature/<feature-name>
git checkout -b work/<feature-name>/<task-slug>
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

**Location**: `{{PROGRESS_DIR}}/<feature-name>-progress.md`

**Template**: See [`PROGRESS-FILE-TEMPLATE.md`](./PROGRESS-FILE-TEMPLATE.md)

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

## 6. Agent Initialization Protocol

### Mandatory Initialization for EVERY Agent

When spawning any agent, the prompt MUST include:

```
## Initialization (MANDATORY — do these BEFORE any code)

1. Read `{{PROJECT_RULES_FILE}}` — project rules
2. Read `{{ARCHITECTURE_FILE}}` — system architecture
3. Read your agent definition at `.claude/agents/<your-role>.md`
4. Read `.claude/prompts/implementing-features/README.md` — this playbook
```

### Providing Task Context

Every agent spawn MUST include:

```
## Task
<clear description of what to build/modify>

## Acceptance Criteria
- [ ] <specific, testable criterion>
- [ ] <specific, testable criterion>
- [ ] Automated checks pass (lint, typecheck, test, build)

## Files to Create
- <exact path>

## Files to Modify
- <exact path> (describe what changes)

## Files to Read for Context
- <paths to existing code the agent needs to understand>

## Dependencies
- Blocked by: Task #X (<what must exist before this agent starts>)
- Blocks: Task #Y (<what depends on this agent's output>)

## QA Checklist
<include the filled-out QA-CHECKLIST-TEMPLATE.md>
```

### Full spawn templates: See [`AGENT-SPAWN-TEMPLATES.md`](./AGENT-SPAWN-TEMPLATES.md)

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
     │   │   QA updates docs ───────────────▶├─ updates {{ARCHITECTURE_FILE}}
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

### Detecting a Crashed Session

A new Team Leader session should check for existing progress:

```bash
# Check for progress files
ls {{PROGRESS_DIR}}/

# Check for workbranches
git branch --list "work/*"

# Check for feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/
```

### Recovery Protocol

1. **Read the progress file** — it contains the full state of the feature
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
5. Next wave starts from updated `feature/` HEAD
