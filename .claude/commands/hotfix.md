---
description: "Streamlined single-agent urgent fix with automatic QA verification"
---

# /hotfix — Streamlined Urgent Fix Workflow

> Invoke this skill for urgent, small-scope fixes that don't need full team orchestration. Single agent, single QA round, minimal ceremony. Still enforces the planning gate — even urgent fixes need a plan.

---

## When to Use

- Fixing a bug that touches 1–3 files
- Urgent production issue that needs a quick turnaround
- Any fix too small for `/implement-feature` but too important to skip QA

## When NOT to Use

- Fix touches more than 3 files → use `/implement-feature` instead
- Fix requires multiple specialist agents → use `/implement-feature` instead
- Fix involves restructuring or refactoring → use `/refactor` instead

---

## Phase 1: Load Context

### Pre-Validation

1. **Git repo check**: Verify git repo exists and has commits.
2. **Primary branch detection**: Detect main/master and use consistently.
3. **Progress directory**: Create the progress directory if it doesn't exist.

Read these files:

```
1. the project rules file                                              — Project rules
2. the architecture file                                               — System architecture
3. prompts/implementing-features/README.md                     — Playbook reference
4. prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md      — Spawn template
5. prompts/implementing-features/WORKFLOW-MODES.md             — Mode reference
```

Hotfix uses **fast mode** by default (1 QA round, no Guardian, no pre-flight). The user can override to `standard` or `strict` if needed.

---

## Phase 2: Assess Fix Scope

Analyze the fix request to determine scope:

1. Identify which files need to change
2. Count the files

### Scope Check

```
If files to change ≤ 3:
  → Proceed with hotfix workflow

If files to change > 3:
  → Warn the user:
    "This fix touches <N> files, which is beyond hotfix scope (max 3).
     Consider using /implement-feature instead for better coordination."
  → Ask user to confirm proceeding as hotfix or switching to /implement-feature
```

3. Identify which agent role is best suited for this fix
4. Check `.claude/agents/` for an agent whose scope covers the affected files

---

## Phase 3: Create Branch & Progress File

```bash
# Create hotfix branch from main (or current branch)
git checkout main
git checkout -b hotfix/<fix-name>
```

Create a minimal progress file in the progress directory:

```markdown
# Hotfix: <Fix Name>

**Status**: IN_PROGRESS
**Type**: hotfix
**Workflow Mode**: fast
**Branch**: hotfix/<fix-name>
**Started**: <YYYY-MM-DD HH:MM>
**Last Updated**: <YYYY-MM-DD HH:MM>

## Task

- **Description**: <fix description>
- **Files**: <list of files to change>
- **Agent**: <agent role>
- **QA Status**: PENDING
- **QA Round**: 0/1

## Fix Summary

<to be filled after completion>
```

---

## Phase 4: Spawn Single Agent

Spawn one coding agent using the Standard Coding Agent template from `AGENT-SPAWN-TEMPLATES.md`.

The agent follows the full phased workflow:
- Phase 0: Load rules
- Phase 1: Write plan (abbreviated in fast mode — task summary + files + steps)
- Phase 2: Execute plan
- Phase 3: Self-review
- Phase 4: Spawn QA

Key differences from `/implement-feature`:
- **No team creation** — single agent, no team overhead
- **No wave planning** — single task, single wave
- **Workbranch is the hotfix branch itself** — no separate workbranch needed

The agent works directly on `hotfix/<fix-name>`.

---

## Phase 5: QA Gate

The agent spawns QA after completing the fix. In fast mode:

- **Max 1 QA round** — abbreviated checklist
- QA checks: automated checks (lint/typecheck/test/build) + critical items only (security, scope violations)
- If QA PASS: QA updates docs (if applicable) and reports approval
- If QA FAIL: agent fixes issues and commits (no second QA round in fast mode)

### QA PASS

Update progress file:
```markdown
**Status**: COMPLETE
**QA Status**: PASS
**QA Round**: 1/1
```

### QA FAIL (fast mode)

Agent fixes the reported issues, commits, and the fix is considered done:
```markdown
**Status**: COMPLETE
**QA Status**: FAIL → FIXED (no re-review in fast mode)
**QA Round**: 1/1
```

> In `standard` or `strict` mode, a second QA round would run after fixes.

---

## Phase 6: Verify & Complete

### Verification

```bash
# Verify on the hotfix branch
git checkout hotfix/<fix-name>

# Run full checks
npm run lint
npm run typecheck
npm run test
npm run build
```

All must pass.

### Update Progress File

```markdown
**Status**: COMPLETE

## Fix Summary
- **Files Changed**: <list>
- **Root Cause**: <brief description>
- **Fix Applied**: <brief description>
- **Tests**: <added/modified/none>
- **Verified**: lint ✓ | typecheck ✓ | test ✓ | build ✓
```

### Create PR (if requested)

```bash
git push -u origin hotfix/<fix-name>
gh pr create --title "hotfix: <fix description>" --body "<summary>"
```

### Cleanup

```
Report to user:
  ✔ Hotfix complete: <fix description>
  Branch: hotfix/<fix-name>
  Files changed: <list>
  QA: PASS
  PR: <url> (if created)
```
