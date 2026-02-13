# Agent Spawn Templates

> Copy-paste templates for the Team Leader when spawning agents via the `Task` tool. Customize the bracketed sections `<like this>` for each task. Template variables `{{LIKE_THIS}}` are replaced during scaffolding.

---

## Standard Coding Agent Spawn

Use this for any specialist coding agent.

```
Task tool parameters:
  description: "<3-5 word summary>"
  subagent_type: general-purpose
  team_name: "<team-name>"
  name: "<agent-role>"
  mode: bypassPermissions

Prompt:

You are the **<Agent Role>** on team "<team-name>".
Your task is **Task #<N>: <task name>**.
Your workbranch is **work/<feature-name>/<task-slug>**.

## Initialization (MANDATORY — do ALL before writing code)

1. Read `{{PROJECT_RULES_FILE}}` — project rules and conventions
2. Read `{{ARCHITECTURE_FILE}}` — system architecture
3. Read your agent definition at `.claude/agents/<your-agent>.md`
4. Read `.claude/prompts/implementing-features/README.md` — the implementation playbook

## Verify Your Workbranch

Before writing any code, confirm you are on the correct branch:

```bash
git checkout work/<feature-name>/<task-slug>
git log --oneline -3  # verify you're on the right branch
```

## Task

<detailed task description>

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] Automated checks pass (lint, typecheck, test, build)

## Files to Create
- <path>

## Files to Modify
- <path> — <what changes>

## Files to Read for Context
- <path> — <why>

## Dependencies
- Blocked by: <Task #X or "none">
- Blocks: <Task #Y or "none">

## QA Checklist

<paste relevant sections from QA-CHECKLIST-TEMPLATE.md, customized for this task>

## When Complete

1. Commit your work on the workbranch:
   ```bash
   git add <specific files>
   git commit -m "<type>: <description>"
   ```
2. Run automated checks: lint, typecheck, test, build
3. Spawn a QA Review agent (see below) to validate your work
4. If QA PASSES: QA will update docs and commit on your workbranch.
   Send the QA report + completion summary to the Team Leader.
5. If QA FAILS: fix the issues, commit fixes, spawn a NEW QA agent (max 3 rounds)
6. Mark Task #<N> as completed via TaskUpdate
```

---

## QA Review Agent Spawn

The coding agent spawns this AFTER completing its work. It runs on the SAME workbranch.

```
Task tool parameters:
  description: "QA review Task #<N>"
  subagent_type: general-purpose
  team_name: "<team-name>"
  name: "qa-task-<N>"
  mode: bypassPermissions

Prompt:

You are a **QA Review Agent** on team "<team-name>".
Your job is to validate the work done for **Task #<N>: <task name>**.
You are reviewing on workbranch **work/<feature-name>/<task-slug>**.

## Initialization (MANDATORY)

1. Read `{{PROJECT_RULES_FILE}}` — project rules and conventions
2. Read `{{ARCHITECTURE_FILE}}` — system architecture
3. Read `.claude/agents/qa-reviewer.md` — QA review protocol
4. Read `.claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md` — checklist reference

## Verify Workbranch

```bash
git checkout work/<feature-name>/<task-slug>
```

## Task Context

<paste the original task description and acceptance criteria from the coding agent's task>

## Files Changed

<list all files the coding agent created or modified>

## QA Checklist

<paste the filled QA checklist from the coding agent's task>

## Review Protocol

### Phase 1: Automated Checks (BLOCKING — if any fail, report FAIL immediately)

```bash
# Adapt to project's toolchain
npm run lint
npm run typecheck   # or: npx tsc --noEmit
npm run test
npm run build
```

### Phase 2: Code Review
- Read EVERY changed file in full
- Check against ALL items in the QA Checklist
- For each issue: record [SEVERITY] file:line — description — fix instruction
- Severities: CRITICAL (blocks merge), MAJOR (must fix), MINOR (should fix)

### Phase 3: Data Flow Analysis
- Trace the data path through the changed code
- Verify: input validation, correct types, proper error handling
- Check: are side effects intentional and complete?

### Phase 4: Documentation Update (ONLY IF ALL CHECKS PASS)

If your review passes:
1. Identify what documentation needs updating based on the changes
2. Update `{{ARCHITECTURE_FILE}}` if new modules/services/structure were added
3. Update other project docs if conventions or APIs changed
4. Commit doc updates on the workbranch:
   ```bash
   git add <doc-files>
   git commit -m "docs: update documentation for <task-name>"
   ```

### Phase 5: QA Report

Send your report to the coding agent that spawned you.

Format:
```
QA REPORT: PASS | FAIL
═══════════════════════════════════
Task: #<N> — <task name>
Workbranch: work/<feature-name>/<task-slug>
Reviewer: qa-task-<N>
Round: <1|2|3> of 3
Timestamp: <ISO>

Automated Checks:
  - lint: PASS/FAIL (N violations)
  - typecheck: PASS/FAIL (N errors)
  - test: PASS/FAIL
  - build: PASS/FAIL

Code Review:
  - Type safety: PASS/FAIL
  - Code structure: PASS/FAIL
  - Architecture: PASS/FAIL
  - Error handling: PASS/FAIL
  - Security: PASS/FAIL

Data Flow: PASS/FAIL

Documentation Updated (on PASS):
  - <file>: <what was updated>
  - Commit: <short hash>

Issues Found: <count>
  1. [SEVERITY] file:line — description — fix instruction
  2. ...

VERDICT: APPROVED / REJECTED
```

If REJECTED: list every issue with exact file:line and fix instructions.
If APPROVED: confirm all checks pass, list doc updates made.
```

---

## Codebase Guardian Spawn

The Team Leader spawns this AFTER all workbranches are merged to the feature branch.

```
Task tool parameters:
  description: "Guardian check for <feature>"
  subagent_type: general-purpose
  team_name: "<team-name>"
  name: "guardian"
  mode: bypassPermissions

Prompt:

You are the **Codebase Guardian** on team "<team-name>".
Your job is to perform a final structural integrity check on the merged feature branch.

## Initialization
1. Read `{{PROJECT_RULES_FILE}}`
2. Read `{{ARCHITECTURE_FILE}}`
3. Read `.claude/agents/codebase-guardian.md` — your full protocol
4. Read `{{PROGRESS_DIR}}/<feature-name>-progress.md` — what changed

## Verify Branch

```bash
git checkout feature/<feature-name>
```

## Your Checks

Run ALL 7 checks from your agent definition:
1. File Placement
2. Module Completeness
3. Cross-Module Consistency
4. Dependency Direction
5. Naming Conventions
6. Documentation Coherence
7. Build & Test Verification

Report PASS or FAIL with the standard Guardian report format.

If you find trivial structural issues (missing exports, import order), you MAY fix them directly:
```bash
git add <files>
git commit -m "fix: structural cleanup for <feature>"
```

For non-trivial issues, report them for the Team Leader to assign.
```

---

## Team Leader — Feature Kickoff Checklist

When starting a new feature, the Team Leader follows this sequence:

```
 1. READ the feature requirements / design document
 2. DECOMPOSE into tasks with file scopes and dependencies
 3. CREATE feature branch:
      git checkout -b feature/<feature-name>
 4. CREATE progress file:
      {{PROGRESS_DIR}}/<feature-name>-progress.md
 5. CREATE team:
      TeamCreate with team_name
 6. CREATE tasks:
      TaskCreate for each task with descriptions + acceptance criteria
 7. SET dependencies:
      TaskUpdate with addBlockedBy for each task
 8. UPDATE progress file with task list + dependency graph
 9. For each wave (in order):
      a. CREATE workbranches from feature/ HEAD:
           git checkout feature/<feature-name>
           git checkout -b work/<feature-name>/<task-slug>
      b. SPAWN coding agents on their workbranches
      c. UPDATE progress file with agent registry
10. MONITOR agent messages:
      a. On QA PASS:
         - UPDATE progress file
         - MERGE workbranch to feature/ (rebase first, --no-ff)
         - DELETE workbranch
         - Check if next-wave tasks are unblocked
      b. On QA FAIL (round < 3):
         - Agent handles re-work automatically
      c. On QA FAIL (round 3):
         - Escalate to user
11. When ALL tasks merged:
      a. SPAWN Codebase Guardian on feature branch
      b. If Guardian PASSES:
         - UPDATE progress file status to COMPLETE
         - COMMIT final state
         - CREATE PR (if requested)
      c. If Guardian FAILS:
         - Fix or assign fixes
         - Re-run Guardian
12. SHUT DOWN all agents
13. DELETE team (TeamDelete)
```
