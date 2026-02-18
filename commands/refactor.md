---
description: "Safe restructuring with mandatory baseline verification, wave execution, and before/after comparison"
---

# /refactor — Structured Codebase Refactoring

> Invoke this skill to refactor code with safety guarantees. Establishes a baseline, proposes a plan, executes in waves, and verifies no regressions. All existing tests must pass before AND after the refactoring.

---

## When to Use

- Reorganizing directory structure (moving files, splitting modules)
- Extracting shared utilities from duplicated code
- Changing architectural patterns (e.g., class-based → functional)
- Renaming and restructuring across multiple files
- Any restructuring that must preserve existing behavior

## When NOT to Use

- Adding new functionality → use `/implement-feature`
- Fixing a bug → use `/hotfix`
- Small rename in 1-2 files → just do it directly

---

## Phase 1: Load Context

### Pre-Validation

1. **Git repo check**: Verify git repo exists and has commits.
2. **Primary branch detection**: Detect main/master and use consistently.
3. **Branching config**: Read branching configuration from `<workflow-config>`. If `baseBranch` is `"auto"`, use the detected primary branch.
4. **Progress directory**: Create the progress directory if it doesn't exist.
5. **Branch check**: If `refactor/<name>` already exists, warn user.

Read these files:

```
1. the project rules file                                              — Project rules
2. the architecture file                                               — System architecture
3. prompts/implementing-features/README.md                     — Playbook
4. prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md      — Spawn templates
5. prompts/implementing-features/PRE-FLIGHT-CHECKS.md          — Pre-flight reference
6. prompts/implementing-features/WORKFLOW-MODES.md             — Mode reference
```

Determine workflow mode. Default for refactoring is `strict` (pre-flight is critical for refactors).

---

## Phase 2: Pre-Flight Baseline (MANDATORY — All Modes)

> **Pre-flight is mandatory for /refactor regardless of workflow mode.** Refactoring on a broken codebase is dangerous — you won't know if breakage is from your changes or pre-existing.

Run the full baseline:

```bash
# Record current branch and commit
git branch --show-current
git rev-parse HEAD

# Run all checks on the current state
npm run lint          # or equivalent
npm run typecheck     # or equivalent
npm run test          # or equivalent
npm run build         # or equivalent
```

**If any check fails**: STOP. Do not proceed with refactoring.

```
⚠ PRE-FLIGHT FAILED — Cannot refactor on a broken baseline.

  lint:      PASS
  typecheck: FAIL (3 errors)
  tests:     PASS (142 passing)
  build:     FAIL

Fix these issues first, then re-run /refactor.
```

**If all checks pass**: Record the baseline:

```
PRE-FLIGHT BASELINE:
  Branch:    main (commit abc1234)
  Lint:      PASS (0 violations)
  Typecheck: PASS (0 errors)
  Tests:     PASS (142 passing, 0 failing, 0 skipped)
  Build:     PASS
```

This baseline is the contract: after refactoring, all these checks must still pass with the same or better results.

---

## Phase 3: Analyze Current Structure

Analyze the code targeted for refactoring:

1. **Map the files** — list all files involved in the refactoring scope
2. **Map dependencies** — which files import from which, who depends on the code being changed
3. **Identify consumers** — code outside the refactoring scope that imports from it
4. **Identify risk areas** — dynamic imports, runtime string references, config files pointing to paths

```
Refactoring Scope Analysis:
  Files in scope:     <count>
  Internal imports:   <count> (within scope)
  External consumers: <count> (outside scope, import from in-scope files)
  Risk areas:
    - src/config/routes.ts references file paths as strings
    - package.json "main" field points to src/index.ts
    - CI config references specific test file paths
```

---

## Phase 4: Propose Refactoring Plan

Present a detailed refactoring plan to the user for approval:

```
═══════════════════════════════════════════════════════════
  REFACTORING PLAN
═══════════════════════════════════════════════════════════

  Scope:     <description of what is being refactored>
  Approach:  <high-level strategy>
  Risk:      LOW / MEDIUM / HIGH

  ─── Changes ────────────────────────────────────────────

  Wave 1: Foundation
    - Move src/utils/auth.ts → src/services/auth/utils.ts
    - Move src/utils/user.ts → src/services/user/utils.ts
    - Create barrel exports at src/services/auth/index.ts

  Wave 2: Update Consumers
    - Update imports in src/components/LoginForm.tsx
    - Update imports in src/routes/auth.ts
    - Update imports in src/middleware/auth.ts

  Wave 3: Cleanup
    - Remove old src/utils/auth.ts
    - Remove old src/utils/user.ts
    - Update the architecture file

  ─── Risk Mitigation ───────────────────────────────────

  - Pre-flight baseline recorded (142 passing tests)
  - Each wave verified before proceeding
  - External consumers updated explicitly (not relying on aliases)
  - Old files removed only after all imports updated

═══════════════════════════════════════════════════════════

Proceed with this plan?
```

Use AskUserQuestion:
- "Yes, proceed" → continue
- "Modify the plan" → let user provide feedback, revise, re-present

Do NOT proceed without user approval.

---

## Phase 5: Create Branch & Progress File

```bash
# Create refactor branch from configured base (read baseBranch from <workflow-config>)
git checkout <base-branch>
git checkout -b refactor/<scope-name>
```

Create a progress file in the progress directory:

```markdown
# Refactor: <Scope Name>

**Status**: IN_PROGRESS
**Type**: refactor
**Workflow Mode**: strict
**Branch**: refactor/<scope-name>
**Baseline Commit**: <hash> on main
**Started**: <YYYY-MM-DD HH:MM>

## Pre-Flight Baseline

| Check | Result | Count |
|-------|--------|-------|
| Lint | PASS | 0 violations |
| Typecheck | PASS | 0 errors |
| Tests | PASS | 142 passing |
| Build | PASS | — |

## Refactoring Plan

<approved plan from Phase 4>

## Wave Status

| Wave | Tasks | Status | Fence Check |
|------|-------|--------|-------------|
| 1 | Foundation | PENDING | — |
| 2 | Update Consumers | PENDING | — |
| 3 | Cleanup | PENDING | — |
```

---

## Phase 6: Execute Waves

Follow the same wave execution pattern as `/implement-feature` Phase 6:

1. **Create workbranches** from `refactor/<scope-name>` HEAD
2. **Spawn agents** using the Standard Coding Agent template
3. **QA review** each agent's work
4. **Merge** workbranches to `refactor/<scope-name>`
5. **Wave fence** — verify lint/typecheck/test/build pass after each wave

Key refactoring-specific rules for agents:

```
REFACTORING RULES:
- You are restructuring, NOT adding features
- All existing tests must still pass after your changes
- If you move a file, update ALL imports that reference it
- If you rename an export, update ALL consumers
- Do NOT change behavior — only change structure
- If you discover a bug during refactoring, REPORT it — do not fix it
  (fixing bugs during refactoring masks what changed behavior)
```

### Wave Fence — Extra Strict for Refactors

After each wave merge, run the full baseline comparison:

```bash
npm run lint       # must pass
npm run typecheck  # must pass
npm run test       # must pass with same count or more
npm run build      # must pass
```

Compare test count against baseline:
- **Same or more tests passing**: proceed
- **Fewer tests passing**: investigate — a refactoring should not break existing tests

---

## Phase 7: Post-Refactor Verification

After all waves complete, run the full verification and compare against the Phase 2 baseline:

```bash
git checkout refactor/<scope-name>

npm run lint
npm run typecheck
npm run test
npm run build
```

### Before/After Comparison

```
═══════════════════════════════════════════════════════════
  REFACTORING VERIFICATION
═══════════════════════════════════════════════════════════

  | Check      | Before (baseline) | After (refactored) | Status |
  |------------|------------------|--------------------|--------|
  | Lint       | PASS (0)         | PASS (0)           | ✓      |
  | Typecheck  | PASS (0)         | PASS (0)           | ✓      |
  | Tests      | 142 passing      | 145 passing        | ✓ (+3) |
  | Build      | PASS             | PASS               | ✓      |

  Structural Changes:
  - Files moved:    5
  - Files created:  2 (barrel exports)
  - Files deleted:  3 (old locations)
  - Imports updated: 12

  VERIFICATION: PASS ✓ — No regressions detected
═══════════════════════════════════════════════════════════
```

If verification fails, investigate and fix before completing.

---

## Phase 8: Complete & Report

### Update Progress File

```markdown
**Status**: COMPLETE
```

### Update Architecture Docs

If the refactoring changed the project structure, update the architecture file to reflect the new layout.

### Create PR (if requested)

```bash
git push -u origin refactor/<scope-name>
gh pr create --title "refactor: <scope description>" --body "$(cat <<'EOF'
## Refactoring Summary

<what was restructured and why>

## Before/After

<structural comparison>

## Verification

- All pre-existing tests pass (142 → 145)
- Lint, typecheck, build all pass
- No behavioral changes introduced
EOF
)"
```

### Report to User

```
✔ Refactoring complete: <scope description>
  Branch: refactor/<scope-name>
  Files changed: <count> moved, <count> created, <count> deleted
  Tests: <before> → <after> (no regressions)
  PR: <url> (if created)
```
