# /generate-tests — Focused Test Generation Workflow

> Invoke this skill to generate tests for specific files or coverage gaps. Spawns a test-engineer agent, then QA verifies test quality and coverage.

---

## When to Use

- Backfilling tests on existing code that lacks coverage
- Generating tests for files changed in a recent feature
- Ensuring new modules have comprehensive test suites
- Improving coverage metrics before a release

---

## Phase 1: Load Context

Read these files:

```
1. {{PROJECT_RULES_FILE}}                                              — Project rules
2. {{ARCHITECTURE_FILE}}                                               — System architecture
3. .claude/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md      — Spawn templates
4. .claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md      — QA checklist
```

Identify the project's testing framework:

```bash
# Check for test config files
ls jest.config* vitest.config* pytest.ini setup.cfg pyproject.toml .mocharc* 2>/dev/null

# Check package.json for test dependencies
grep -E "jest|vitest|mocha|chai|testing-library|playwright|cypress|pytest|unittest" package.json 2>/dev/null

# Check for existing test files
find . -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" | head -10
```

Record:
- Test framework (Jest, Vitest, pytest, etc.)
- Test file naming convention (`.test.ts`, `.spec.ts`, `test_*.py`, etc.)
- Test directory structure (`__tests__/`, `tests/`, co-located, etc.)
- Assertion library (built-in, chai, expect, etc.)
- Mocking approach (jest.mock, vi.mock, unittest.mock, etc.)

---

## Phase 2: Identify Test Targets

Determine what needs tests through one of three methods:

### Method A: User-Specified Targets

If the user specifies files or modules:
```
Target: src/services/auth-service.ts
Target: src/components/LoginForm.tsx
```

Read each target file to understand what needs testing.

### Method B: Recently Changed Files

If the user says "test recent changes" or similar:

```bash
# Get files changed since last release/tag
git diff --name-only main...HEAD

# Or files changed in last N commits
git diff --name-only HEAD~10
```

Filter to source files (exclude tests, docs, configs).

### Method C: Coverage Gaps

If the user says "improve coverage" or similar:

```bash
# Run coverage report
npm run test -- --coverage 2>/dev/null
# or: pytest --cov --cov-report=term-missing
# or: go test -cover ./...
```

Identify files with low coverage (<80%) or no tests at all.

### Build Target List

For each target file, note:
- File path
- What it exports (functions, classes, components)
- Dependencies it uses (for mocking)
- Existing tests (if any — to avoid duplicating)
- Complexity level (simple utils vs complex services)

---

## Phase 3: Plan Test Generation

For each target file, plan what tests are needed:

```
Test Plan:
  src/services/auth-service.ts
    Exports: login(), logout(), refreshToken(), getCurrentUser()
    Existing tests: NONE
    Tests to generate:
      - login: success, invalid credentials, network error, rate limited
      - logout: success, already logged out, session expired
      - refreshToken: success, expired token, invalid token
      - getCurrentUser: authenticated, unauthenticated

  src/components/LoginForm.tsx
    Exports: LoginForm component
    Existing tests: login-form.test.tsx (2 tests — render only)
    Tests to add:
      - Form submission with valid data
      - Form validation errors
      - Loading state during submission
      - Error state on failed login
      - Redirect on successful login
```

Present the plan to the user for approval before proceeding.

---

## Phase 4: Spawn Test Engineer Agent

Spawn a test-engineer agent (or a coding agent with test-writing focus) using the Standard Coding Agent template from `AGENT-SPAWN-TEMPLATES.md`.

```
Task: Generate tests for the following targets:
<target list with test plans from Phase 3>

Testing framework: <detected framework>
Test file convention: <detected convention>
Test directory: <detected directory>

You MUST:
- Follow existing test patterns in the codebase (read 2-3 existing test files as examples)
- Use the project's mocking approach
- Write meaningful assertions (not just "renders without crashing")
- Cover happy path, error cases, and edge cases
- Each test should test ONE thing with a clear description
- Use descriptive test names that explain the expected behavior

You MUST NOT:
- Modify the source files being tested
- Add unnecessary dependencies
- Write tests that depend on implementation details (test behavior, not internals)
- Write tests that are flaky or timing-dependent
```

The agent:
1. Reads existing test files for patterns
2. Writes a plan citing test patterns and conventions
3. Generates test files following the plan
4. Runs the tests to verify they pass
5. Spawns QA

---

## Phase 5: QA Verification

QA verifies the generated tests:

### Test Quality Checks
- [ ] Tests follow project conventions (naming, structure, patterns)
- [ ] Tests cover happy path, error cases, and edge cases
- [ ] Tests are independent (no shared mutable state)
- [ ] Tests have meaningful assertions (not just "no errors")
- [ ] Test descriptions clearly explain expected behavior
- [ ] Mocking is appropriate (not over-mocking, not under-mocking)
- [ ] No hardcoded values that should be fixtures/factories
- [ ] Tests do not depend on execution order

### Coverage Checks
- [ ] All exported functions/components have at least one test
- [ ] Error paths are tested (invalid input, network failures, etc.)
- [ ] Edge cases are covered (empty, null, boundary values)
- [ ] Integration points are tested (API calls, DB queries, etc.)

### Reliability Checks
- [ ] Tests pass consistently (run 2-3 times)
- [ ] Tests do not depend on timing or external state
- [ ] Tests clean up after themselves (no side effects)

---

## Phase 6: Report & Complete

### Coverage Delta

```bash
# Run coverage again after adding tests
npm run test -- --coverage

# Compare before and after
```

Present the results:

```
═══════════════════════════════════════════════════════════
  TEST GENERATION REPORT
═══════════════════════════════════════════════════════════

  Targets:         <count> files
  Tests generated: <count> test files, <count> test cases
  QA:             PASS ✓

  ─── Coverage Delta ─────────────────────────────────────

  | File | Before | After | Change |
  |------|--------|-------|--------|
  | src/services/auth-service.ts | 0% | 92% | +92% |
  | src/components/LoginForm.tsx | 25% | 88% | +63% |
  | Overall | 64% | 78% | +14% |

  ─── Files Created ──────────────────────────────────────

  - src/services/__tests__/auth-service.test.ts (12 tests)
  - src/components/__tests__/LoginForm.test.tsx (8 tests)

═══════════════════════════════════════════════════════════
```

### Commit

```bash
git add <test files>
git commit -m "test: add tests for <targets summary>"
```

### Cleanup

Report to user with the coverage delta and list of generated test files.
