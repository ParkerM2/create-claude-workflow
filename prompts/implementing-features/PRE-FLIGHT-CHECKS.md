# Pre-Flight Checks

> Run before spawning any agents to verify the codebase baseline is healthy. Only applies in `strict` mode. If the baseline is broken, agents will waste cycles on pre-existing failures.

---

## When to Run

- **Strict mode**: Always run before spawning the first agent
- **Standard mode**: Skip
- **Fast mode**: Skip

See [`WORKFLOW-MODES.md`](./WORKFLOW-MODES.md) for mode details.

---

## Check Sequence

Run these on the base branch (before creating the feature branch):

```bash
# 1. Ensure working directory is clean
git status

# 2. Run lint
<lint command>    # e.g., npm run lint, ruff check, golangci-lint run

# 3. Run type checker
<typecheck command>    # e.g., npx tsc --noEmit, mypy, go vet

# 4. Run tests
<test command>    # e.g., npm run test, pytest, go test ./...

# 5. Run build
<build command>   # e.g., npm run build, cargo build, go build
```

Adapt commands to the project's actual toolchain.

---

## Result Handling

### All Checks Pass

```
PRE-FLIGHT: PASS
══════════════════
Baseline verified on branch: main
  - lint:      PASS
  - typecheck: PASS
  - tests:     PASS (N passing)
  - build:     PASS

Proceeding to feature branch creation and agent spawning.
```

Record the baseline in the progress file:

```markdown
## Pre-Flight Baseline
- Branch: main (commit: <short hash>)
- Lint: PASS
- Typecheck: PASS
- Tests: PASS (<N> passing)
- Build: PASS
```

### One or More Checks Fail

```
PRE-FLIGHT: FAIL
══════════════════
Baseline broken on branch: main
  - lint:      PASS
  - typecheck: FAIL (3 errors)
  - tests:     PASS
  - build:     FAIL

⚠ WARNING: Spawning agents on a broken baseline will cause false QA failures.
```

**Team Leader options when pre-flight fails**:

1. **Stop and warn the user** (recommended):
   ```
   Pre-flight checks failed. The codebase has existing issues:
   - typecheck: 3 errors in src/types/user.ts, src/services/auth.ts
   - build: fails due to typecheck errors

   Fix these before starting the feature, or switch to standard/fast mode to skip pre-flight.
   ```

2. **Record as known failures and continue** (if user approves):
   ```markdown
   ## Pre-Flight Baseline
   - Branch: main (commit: <short hash>)
   - Lint: PASS
   - Typecheck: FAIL (3 known errors — user approved)
   - Tests: PASS
   - Build: FAIL (due to typecheck — user approved)

   Known Failures:
   - src/types/user.ts:15 — TS2322: Type mismatch (pre-existing)
   - src/types/user.ts:28 — TS2322: Type mismatch (pre-existing)
   - src/services/auth.ts:42 — TS2345: Argument type error (pre-existing)
   ```

   QA reviewers should ignore these known failures when running automated checks. Include the known failures list in each agent's spawn template.

---

## Pre-Flight in the Progress File

The pre-flight results are recorded in the progress file so crash recovery sessions know the baseline state:

```markdown
## Pre-Flight Baseline

| Check | Result | Details |
|-------|--------|---------|
| Clean working directory | PASS | No uncommitted changes |
| Lint | PASS | 0 violations |
| Typecheck | PASS | 0 errors |
| Tests | PASS | 142 passing, 0 failing |
| Build | PASS | Compiled successfully |
| Baseline commit | — | abc1234 on main |
```

---

## Post-Feature Comparison

After the feature is complete (Phase 8 of `/implement-feature`), compare against the pre-flight baseline:

- **Tests**: Should have the same count or more (new tests added)
- **Lint/typecheck**: Should still be clean (no regressions)
- **Build**: Should still succeed

This comparison is particularly useful for `/refactor` — verifying that restructuring didn't break anything that was working before.
