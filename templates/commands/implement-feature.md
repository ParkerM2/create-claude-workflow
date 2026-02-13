# /implement-feature — Team Workflow Orchestrator

> Invoke this skill to implement a feature using Claude Agent Teams with branch-per-task isolation, per-task QA with doc updates, crash-safe progress tracking, and a final Codebase Guardian check.

---

## When to Use

- Implementing a new feature that touches multiple files or modules
- Refactoring an existing feature across multiple files
- Any task requiring 2+ specialist agents working in coordination

---

## Phase 1: Load Context

Before anything else, read these files to understand the system:

```
MANDATORY READS:
1. {{PROJECT_RULES_FILE}}                                              — Project rules
2. {{ARCHITECTURE_FILE}}                                               — System architecture
3. .claude/prompts/implementing-features/README.md                     — THE FULL PLAYBOOK
4. .claude/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md      — How to spawn agents
5. .claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md      — QA checklist per task
6. .claude/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md     — Progress tracking format
7. .claude/prompts/implementing-features/WORKFLOW-MODES.md             — Workflow mode definitions
```

If a design document or spec exists for this feature, read it too.

### Resolve Workflow Mode

Determine the active workflow mode (see `WORKFLOW-MODES.md`):
1. Check if the user specified a mode with this invocation
2. Check `{{PROJECT_RULES_FILE}}` for a `Workflow Mode` section
3. Default to `strict` if not specified

Record the resolved mode — it affects pre-flight, QA rounds, Guardian, and wave fences.

### Pre-Flight Checks (Strict Mode Only)

If workflow mode is `strict`, run pre-flight checks before proceeding (see `PRE-FLIGHT-CHECKS.md`):
- Verify build, lint, typecheck, and tests pass on the base branch
- Record the baseline in the progress file
- If baseline is broken: warn the user and do not proceed until resolved

---

## Phase 2: Check for Existing Progress

Check if this feature was already started by a previous (possibly crashed) session:

```bash
# Check for existing progress file
ls {{PROGRESS_DIR}}/

# Check for existing workbranches
git branch --list "work/*"

# Check for existing feature branches
git branch --list "feature/*"

# Check for existing teams
ls ~/.claude/teams/
```

If a progress file exists for this feature:
1. Read it to understand current state
2. Check branch status table — which tasks are done, which are in progress
3. Resume from the first non-COMPLETE task
4. Update the "Last Updated" and "Updated By" fields
5. Skip to the appropriate phase below

---

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

---

## Phase 4: Create Feature Branch & Progress File

```bash
# Create feature branch from main
git checkout main
git checkout -b feature/<feature-name>
```

Create `{{PROGRESS_DIR}}/<feature-name>-progress.md` using the template from `PROGRESS-FILE-TEMPLATE.md`.

This file is your **crash-recovery artifact**. Update it after EVERY state change.

---

## Phase 5: Set Up Team & Tasks

```
1. TeamCreate — team_name: "<feature-name>"
2. TaskCreate — one per task, with full description + acceptance criteria
3. TaskUpdate — set addBlockedBy dependencies for each task
4. Update progress file with task list + dependency graph
```

---

## Phase 6: Execute Waves (Core Loop)

For each wave, in dependency order:

### 6a. Create Workbranches

```bash
# Create workbranch from feature branch HEAD
git checkout feature/<feature-name>
git checkout -b work/<feature-name>/<task-slug>
```

Create one workbranch per task in this wave.

### 6b. Spawn Agents

Use the templates from `AGENT-SPAWN-TEMPLATES.md`. Every agent MUST receive:

- Full initialization protocol (project rules, architecture, agent definition, playbook)
- Task description + acceptance criteria
- File scope (what to create/modify)
- Filled QA checklist (use `QA-CHECKLIST-AUTO-FILL-RULES.md` to pre-select sections by role)
- Context budget note (see `CONTEXT-BUDGET-GUIDE.md` — estimate before spawning, split if over threshold)
- Instructions to commit on workbranch and spawn QA when done

### 6c. Monitor & Collect Results

- Track agent completion messages
- On QA PASS: proceed to merge
- On QA FAIL (round < 3): agent handles re-work automatically
- On QA FAIL (round 3): escalate to user

### 6d. Merge Completed Workbranches

For each workbranch with QA PASS (one at a time, sequentially):

```bash
# Rebase workbranch on latest feature HEAD
git checkout work/<feature-name>/<task-slug>
git rebase feature/<feature-name>

# Merge to feature branch
git checkout feature/<feature-name>
git merge --no-ff work/<feature-name>/<task-slug> \
  -m "Merge work/<feature-name>/<task-slug>: <summary>"

# Delete workbranch
git branch -d work/<feature-name>/<task-slug>
```

Update progress file: branch status, merge log, task status.

### 6e. Wave Fence & Next Wave

After all workbranches in the current wave are merged, run the wave fence check (see `WAVE-FENCE-PROTOCOL.md`):
- **Strict mode**: full verify — lint, typecheck, test, build must all pass
- **Standard mode**: quick verify — lint only
- **Fast mode**: skip fence, proceed immediately

If the fence check passes:
- Update the wave status table in the progress file
- Create next wave's workbranches from updated `feature/` HEAD
- Spawn next wave's agents

---

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

## Phase 9: Completion & Cleanup

1. **Update progress file** — status: COMPLETE
2. **Update design doc** — status: IMPLEMENTED (if applicable)
3. **Shut down all agents** — send shutdown requests
4. **Delete the team** — `TeamDelete`
5. **Report to user** — summary of what was built, files changed, branch name
6. **Create PR** — if requested:
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
# Feature branch (once)
git checkout main && git checkout -b feature/<name>

# Workbranch (per task)
git checkout feature/<name> && git checkout -b work/<name>/<task>

# Pre-merge rebase
git checkout work/<name>/<task> && git rebase feature/<name>

# Merge workbranch
git checkout feature/<name> && git merge --no-ff work/<name>/<task> -m "Merge ..."

# Cleanup
git branch -d work/<name>/<task>

# List workbranches
git branch --list "work/<name>/*"

# PR
git push -u origin feature/<name>
gh pr create --title "..." --body "..."
```
