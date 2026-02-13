# Wave Fence Protocol

> Ensures each wave is fully complete and verified before the next wave begins. Agents within a wave run in parallel; the fence is the synchronization point between waves.

---

## Concept

```
Wave 1: [Agent A] [Agent B] [Agent C]     ← parallel within wave
              │         │         │
              ▼         ▼         ▼
         ┌─────────────────────────────┐
         │     WAVE FENCE — VERIFY     │   ← all must pass before proceeding
         │  QA pass? Merged? Build OK? │
         └─────────────────────────────┘
              │
              ▼
Wave 2: [Agent D] [Agent E]               ← parallel within wave
              │         │
              ▼         ▼
         ┌─────────────────────────────┐
         │     WAVE FENCE — VERIFY     │
         └─────────────────────────────┘
              │
              ▼
Wave 3: [Agent F]
```

**Within a wave**: agents that touch different files run in parallel.
**Between waves**: the fence blocks until all tasks in the previous wave are complete, merged, and verified.

---

## Fence Check Procedure

After all agents in a wave complete and their workbranches are merged:

### Strict Mode — Full Verify

```bash
# 1. Verify all workbranches from this wave are merged and deleted
git branch --list "work/<feature>/*"    # should show NO branches from this wave

# 2. Verify feature branch is clean
git checkout feature/<feature-name>
git status                               # should be clean

# 3. Run full verification
<lint command>
<typecheck command>
<test command>
<build command>
```

All checks must pass. If any fail, investigate and fix before starting the next wave.

### Standard Mode — Quick Verify

```bash
# 1. Verify workbranches merged
git branch --list "work/<feature>/*"

# 2. Run lint only
git checkout feature/<feature-name>
<lint command>
```

Lint must pass. Skip full test/build between waves (run at the end).

### Fast Mode — No Fence

Skip wave fence entirely. Merge and proceed immediately to the next wave.

---

## Wave Status Table

The Team Leader maintains a wave status table in the progress file:

```markdown
## Wave Status

| Wave | Tasks | Agents Spawned | QA Complete | Merged | Fence Check | Status |
|------|-------|---------------|-------------|--------|-------------|--------|
| 1 | #1, #2 | 2 | 2/2 | 2/2 | PASS | COMPLETE |
| 2 | #3, #4 | 2 | 1/2 | 1/2 | — | IN_PROGRESS |
| 3 | #5 | 0 | 0/1 | 0/1 | — | BLOCKED |
```

### Status Values

| Status | Meaning |
|--------|---------|
| PENDING | Wave has not started yet |
| IN_PROGRESS | Agents are working or in QA |
| FENCE_CHECK | All tasks complete, running fence verification |
| COMPLETE | Fence passed, next wave can start |
| BLOCKED | Waiting for previous wave to complete |

---

## Fence Failure Protocol

If the fence check fails:

### Lint/Typecheck Failure

1. Identify which merged task introduced the issue
2. Fix on the feature branch directly (small fixes)
3. Or create a fix task, assign to the responsible agent, and re-run the fence

### Test Failure

1. Determine if the failure is from a newly introduced test or an existing test
2. If new test: the task's QA should have caught it — investigate QA gap
3. If existing test broke: likely a cross-module issue from merging multiple tasks
4. Fix on the feature branch, commit as `fix: resolve wave N fence failure`

### Build Failure

1. Usually caused by missing imports or type mismatches across merged modules
2. Fix on the feature branch directly
3. This is exactly the kind of issue the fence is designed to catch — better now than at PR time

---

## Team Leader Protocol

### Starting a New Wave

1. Verify the previous wave's fence check is COMPLETE
2. Update the wave status table: new wave → IN_PROGRESS
3. Create workbranches from the updated `feature/` HEAD
4. Spawn agents for the new wave
5. Update the progress file

### Completing a Wave

1. Wait for all agents in the wave to report QA PASS
2. Merge all workbranches sequentially (one at a time)
3. Delete merged workbranches
4. Run the fence check (based on workflow mode)
5. Update the wave status table
6. If fence passes: proceed to next wave
7. If fence fails: follow the Fence Failure Protocol

---

## Crash Recovery with Waves

When recovering from a crash, the wave status table tells the new session exactly where to resume:

- **Wave COMPLETE**: skip, already done
- **Wave IN_PROGRESS**: check which tasks are complete, resume incomplete ones
- **Wave FENCE_CHECK**: re-run the fence check
- **Wave BLOCKED/PENDING**: wait for previous wave

The wave status table complements the branch status table — together they provide full recovery context.
