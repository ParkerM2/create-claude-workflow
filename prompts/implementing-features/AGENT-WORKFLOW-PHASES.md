# Agent Workflow Phases

> Universal workflow phases for coding agents spawned by `/team-go`. Every coding agent MUST complete each phase sequentially — skipping phases is a CRITICAL VIOLATION.

---

## PHASE 0: LOAD RULES [BLOCKING — do NOT write code yet]

Read these files in order. Do not skim. Do not skip.

1. **Your task file**: `{taskFilePath}` — contains your task description, acceptance criteria, file scope, and rules
2. **Workflow phases**: This file (`prompts/implementing-features/AGENT-WORKFLOW-PHASES.md`)
3. **Agent definition**: `{agentDefinition}` — your role-specific protocol (if specified in task file)
4. **Project rules file**: (if it exists) — project conventions

> **Defensive check**: If any file doesn't exist, note it in your Phase 1 plan and continue — infer what you can from the codebase. Never halt because a reference file is missing.

Then verify your workbranch:
```bash
cd {worktreePath} 2>/dev/null && git log --oneline -3 || git checkout {workbranch} && git log --oneline -3
```

---

## PHASE 1: WRITE EXECUTION PLAN [BLOCKING — do NOT write code yet]

Before writing ANY code, produce a written execution plan. This is your contract.

Your plan MUST include:

### 1a. Task Summary
Restate the task in your own words. Prove you understand what is being asked.

### 1b. Rules That Apply
List SPECIFIC rules from your task file and Phase 0 reads that constrain this task. Cite actual rules — do not say "follow all rules."

### 1c. Files I Will Create
- `<exact path>` — `<purpose>`

### 1d. Files I Will Modify
- `<exact path>` — `<what changes and why>`

### 1e. Files I Will NOT Touch
List files that are adjacent/related but outside your scope.

### 1f. Step-by-Step Implementation Order
Number each step. Be specific. Each step should be a single, verifiable action.

### 1g. Acceptance Criteria Check
Copy the acceptance criteria from your task file and confirm how you will meet each one.

### 1h. Risk Assessment
What could go wrong? How will you handle it?

Output this plan as a message BEFORE proceeding to Phase 2.

---

## PHASE 2: EXECUTE PLAN [now you may write code]

Before creating or modifying ANY file:
1. Verify the file path matches your Phase 1 scope (sections 1c/1d)
2. If modifying an existing file, read the ENTIRE file first
3. If a file you planned to create already exists, read it before overwriting

Follow your Phase 1 plan step by step. For each step:
1. State which step you are executing
2. Execute the step
3. Verify the step succeeded
4. If the step fails: follow the ERROR RECOVERY PROTOCOL below

After ALL steps are complete, commit your work:
```bash
git add <specific files from your plan>
git commit -m "<type>: <description>"
```

Then emit a tracking event:
```
/claude-workflow:track task.completed "Task #{taskNumber}: <summary>" --task {taskNumber} --files <changed-files>
```

---

## PHASE 3: SELF-REVIEW [before reporting to Team Leader]

Before reporting completion, verify your work against your plan:

1. Re-read your Phase 1 plan
2. For each acceptance criterion: verify it is met (run the check, read the file, confirm)
3. For each file in your plan: verify it exists and contains what you planned
4. Run automated checks (adapt to project toolchain):
   ```bash
   # Use the project's actual commands. Examples:
   # JS/TS: npm run lint, npm run typecheck, npm run test
   # Python: ruff check, mypy, pytest
   # Go: golangci-lint run, go vet, go test ./...
   # If a command doesn't exist, skip it and note in self-review
   ```
5. If ANY check fails: fix it BEFORE reporting. Do not pass known failures to QA.

Only after ALL self-review checks pass, proceed to Phase 4.

---

## PHASE 4: REPORT TO TEAM LEADER & AWAIT INSTRUCTIONS

> **Hub-and-spoke model**: You report to the Team Leader. The Team Leader handles QA. You do NOT communicate with QA agents directly.

**Step 1 — Send your completion report:**

```
SendMessage:
  to: "{TEAM_LEADER_NAME}"
  message: |
    Task #{taskNumber} complete. Self-review PASS. Ready for QA.

    Files changed: <list>
    Self-review: All acceptance criteria met, automated checks passed.
    Workbranch: {workbranch}
  summary: "Task #{taskNumber} complete — ready for QA"
```

**Step 2 — Wait for Team Leader response.**

**Step 3 — On QA FAIL (Team Leader forwards failure details):**
1. Read the FULL QA report
2. Re-read your Phase 1 plan (context anchor — prevents drift)
3. Fix ONLY the issues QA identified — do NOT refactor unrelated code
4. Commit fixes:
   ```bash
   git add <fixed files>
   git commit -m "fix: address QA round <N> feedback for Task #{taskNumber}"
   ```
5. Send a new completion report (same format as Step 1)
6. Repeat until QA PASS or 3 rounds exhausted

**Step 4 — On QA PASS:** Wait for shutdown_request. Do NOT exit on your own.

---

## ERROR RECOVERY PROTOCOL

Follow this EVERY TIME you encounter an error during Phase 2.

When you encounter ANY error:

1. **STOP.** Do not continue fixing blindly.
2. **Re-read your Phase 1 plan.** (Context anchor.)
3. **Classify:**
   - YES, in a file I own → fix it (max 2 attempts per error)
   - YES, but in a file I don't own → report to Team Leader, continue with your plan
   - NO, unrelated → ignore it, continue with your plan
4. If the same error persists after 2 attempts:
   - STOP trying to fix it
   - Document the error (file, line, what you tried)
   - Report to Team Leader
   - Continue with the rest of your plan if possible
5. **NEVER:**
   - Modify files outside your scope
   - Refactor unrelated code
   - Abandon your plan for a tangential issue
   - Spend more than 2 attempts on any single error

---

## CONTEXT EXHAUSTION PROTOCOL

If you find yourself running low on context (repeated compactions, losing track of prior work):

1. **STOP coding immediately**
2. **Commit all work done so far:**
   ```bash
   git add <files you've changed>
   git commit -m "wip: {taskSlug} — partial progress, context handoff

   COMPLETED: <steps done>
   REMAINING: <steps left>
   NOTES: <gotchas, edge cases, decisions>"
   ```
3. **Message the Team Leader:**
   ```
   SendMessage:
     to: "{TEAM_LEADER_NAME}"
     message: |
       CONTEXT EXHAUSTION — Task #{taskNumber} partial handoff.
       Completed steps: <list>
       Remaining steps: <list>
       Files changed: <list>
       Commit: <hash>
     summary: "Task #{taskNumber} context exhaustion — needs handoff"
   ```

---

## Placeholder Tokens

These tokens are substituted at spawn time by the Team Leader:

| Token | Source |
|-------|--------|
| `{TEAM_LEADER_NAME}` | Team config — leader's member name |
| `{taskNumber}` | Task file YAML frontmatter |
| `{taskName}` | Task file YAML frontmatter |
| `{taskSlug}` | Task file YAML frontmatter |
| `{taskFilePath}` | Path to the task handoff file |
| `{workbranch}` | `work/ES-{N}/{taskSlug}` |
| `{worktreePath}` | `<worktreeDir>/ES-{N}/{taskSlug}` |
| `{agentDefinition}` | Task file YAML — path to agent .md |
