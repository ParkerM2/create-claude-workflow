# Workflow Modes

> Three modes control how much ceremony the workflow applies. The Team Leader reads the active mode and adjusts behavior accordingly. Other agents do not need to know the mode.

---

## Mode Definitions

| | Strict | Standard | Fast |
|---|--------|----------|------|
| **Planning gate** | Required | Required | Required |
| **Pre-flight checks** | Yes | No | No |
| **QA rounds (max)** | 3 | 2 | 1 |
| **Codebase Guardian** | Yes | Yes (auto-fix trivial) | No |
| **Performance logging** | Yes | No | No |
| **Wave fence** | Full verify | Quick verify | No fence |
| **Context budget check** | Yes | Yes | No |
| **Doc updates on QA PASS** | Yes | Yes | Yes |

> **Note**: The Planning Gate (Phase 1: Write Plan) is ALWAYS required in every mode. It is the core enforcement mechanism and cannot be disabled.

---

## Setting the Mode

### Project-Wide Default

Set in `the project rules file`:

```markdown
## Workflow Mode
Mode: standard
```

Valid values: `strict`, `standard`, `fast`

If no mode is specified, the default is `strict`.

### Per-Invocation Override

When invoking `/new-feature`, `/new-hotfix`, or `/new-refactor`, the user can specify a mode:

```
/new-feature "Add user settings" — mode: fast
```

The per-invocation mode overrides the project default for that feature only.

---

## Mode Details

<mode name="strict">

### Strict Mode (Default)

Use for: production features, critical paths, regulated environments.

```
Planning gate:       REQUIRED — full Phase 1 plan with rule citations
Pre-flight checks:   RUN — build/lint/test/typecheck must pass before spawning agents
QA rounds:           MAX 3 — full QA checklist, all sections
Guardian:            RUN — full 7-check structural review
Performance logging: ON — QA appends entry after every report
Wave fence:          FULL — verify build/lint/test between waves
Context budget:      CHECK — estimate context, split if over threshold
```

**Team Leader behavior in strict mode**:
1. Run pre-flight checks before spawning any agents (see `PRE-FLIGHT-CHECKS.md`)
2. Use the full QA checklist for every task
3. Require QA PASS before merge (up to 3 rounds)
4. Run wave fence verification after each wave merge
5. Spawn Codebase Guardian after all waves complete
6. Instruct QA to append performance log entries

</mode>

<mode name="standard">

### Standard Mode

Use for: normal development, day-to-day feature work.

```
Planning gate:       REQUIRED — full Phase 1 plan with rule citations
Pre-flight checks:   SKIP
QA rounds:           MAX 2 — full QA checklist, all sections
Guardian:            RUN — auto-fix trivial issues without reporting back
Performance logging: SKIP
Wave fence:          QUICK — verify lint only between waves
Context budget:      CHECK — estimate context, split if over threshold
```

**Team Leader behavior in standard mode**:
1. Skip pre-flight checks — trust that the codebase is healthy
2. Use the full QA checklist but set max rounds to 2
3. Tell Guardian to auto-fix trivial issues (missing exports, import order) and only report non-trivial issues
4. Skip performance log entries
5. Wave fence: run lint only (skip full test/build between waves)

</mode>

<mode name="fast">

### Fast Mode

Use for: prototyping, spikes, small changes, non-critical code, `/new-hotfix`.

```
Planning gate:       REQUIRED — abbreviated plan (task summary + files + steps only)
Pre-flight checks:   SKIP
QA rounds:           MAX 1 — abbreviated checklist (automated checks + critical items only)
Guardian:            SKIP
Performance logging: SKIP
Wave fence:          SKIP — no inter-wave verification
Context budget:      SKIP
```

**Team Leader behavior in fast mode**:
1. Skip pre-flight checks
2. Use abbreviated QA checklist: automated checks (lint/typecheck/test/build) + critical items only (security, scope violations)
3. One QA round only — if FAIL, fix and merge without re-running QA
4. Skip Codebase Guardian entirely
5. Skip wave fence — merge and proceed immediately
6. Skip performance logging

</mode>

---

## Mode Comparison — Scenario Examples

### Scenario: "Add user authentication" — use `strict`
- Critical feature touching many files
- Security implications require thorough QA
- Worth the extra time for confidence

### Scenario: "Add a new settings page" — use `standard`
- Normal feature, multiple agents
- Standard QA is sufficient
- Guardian catches structural issues

### Scenario: "Fix typo in error message" — use `fast`
- Single file, minimal risk
- One agent, one QA round
- No need for Guardian or wave fences

### Scenario: "/new-hotfix critical security bug" — use `fast` (default for /new-hotfix)
- Urgency requires speed
- Still enforces planning gate (even urgent fixes need a plan)
- Single QA round for safety
- Skip ceremony that doesn't add value for a 1-file fix

---

## Team Leader Mode Resolution

When the Team Leader starts a feature, it resolves the mode in this priority order:

1. **Per-invocation override** — if the user specified a mode, use it
2. **`the project rules file` setting** — if a `Workflow Mode` section exists, use it
3. **Default** — `strict`

The resolved mode is recorded in the progress file:

```markdown
**Workflow Mode**: standard (from CLAUDE.md)
```

This ensures crash recovery sessions use the same mode.
