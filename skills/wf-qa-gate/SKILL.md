---
name: wf-qa-gate
description: Step 4b of /agent-team — waits for agent verdicts, runs QA cycles, merges passing tasks, and advances the wave counter
---

# WF: QA Gate

## Gate Check

```bash
cat .claude/.workflow-state/wave-<currentWave>-spawned.json
```

Determine `currentWave` from `setup-complete.json`. If spawn stamp missing:
**STOP** — "Wave not spawned. Run Step 4a (`wf-spawn`) first."

Load agent IDs, task list, `TICKET`, `TEAM_LEADER_NAME`, `workPrefix`,
`worktreeDir`, `featureBranch` from state files.

---

## Your Task

Wait for coder completions, coordinate QA, and merge each passing task.
Do not move to the next wave until ALL tasks in this wave are merged.

---

## Checklist

### 1. Wait for Coder Completions

Wait for each `coder-task-<N>` to SendMessage with completion. When a coder
reports done:

1. Note which task completed and which files changed
2. Notify QA: `SendMessage(to: "qa-task-<N>", message: "Code ready. Files: <list>.")`

> RECOVERY: If a coder goes silent for >5 minutes, send one nudge. If no
> response after 2 minutes, check `TaskOutput`. If crashed, spawn a
> replacement on the same worktree with the same task file.

### 2. Handle QA Verdict

**On PASS:**

1. Emit: `/claude-workflow:track qa.passed "Task #<N>" --task <N>`
2. Rebase and merge:
   ```bash
   git -C <worktreePath> rebase <featureBranch>
   git checkout <featureBranch>
   git merge --no-ff <workbranch> -m "Merge <taskSlug>: <summary>"
   ```
3. Emit: `/claude-workflow:track branch.merged "<taskSlug> to feature"`
4. Cleanup:
   ```bash
   git worktree remove <worktreePath>
   git branch -d <workbranch>
   ```
5. Shut down both agents:
   ```
   SendMessage(to: "coder-task-<N>", message: {"type": "shutdown_request"})
   SendMessage(to: "qa-task-<N>", message: {"type": "shutdown_request"})
   ```
6. Update task file: `status` → `"complete"`

**On FAIL (round < 3):**

1. Emit: `/claude-workflow:track qa.failed "Task #<N>, round <R>" --task <N>`
2. Forward to coder: `SendMessage(to: "coder-task-<N>", message: "QA FAIL round <R>. Issues: <list>")`
3. Wait for coder to fix and message back
4. Shut down previous QA agent
5. Spawn NEW QA: `name: "qa-task-<N>-r<round>"` with same template
6. Wait for new verdict. Increment round. Repeat from step 1.

**On FAIL (round 3 — escalation):**

1. Emit: `/claude-workflow:track qa.failed "Task #<N> failed 3 rounds" --task <N>`
2. Pause. Report to user with options:
   - (a) You fix it manually, then tell me to continue
   - (b) Skip QA for this task (fast mode only)
   - (c) Abort the workflow
3. Wait for user response before continuing.

### 3. Wave Fence (all tasks merged)

After ALL tasks in this wave are merged:

**Strict mode:**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

**Standard mode:** `npm run lint` only

**Fast mode:** skip

If fence fails: spawn a fix agent on a new workbranch, merge the fix, re-run
fence.

### 4. Advance Wave Counter & Write Stamp

```bash
cat > .claude/.workflow-state/wave-<currentWave>-complete.json << EOF
{
  "wave": <currentWave>,
  "tasksCompleted": <N>,
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

Emit: `/claude-workflow:track checkpoint "wave-<currentWave>-complete"`

If `currentWave == TOTAL_WAVES`:

```bash
touch .claude/.workflow-state/all-waves-complete.json
```

Emit: `/claude-workflow:track checkpoint "all-waves-complete"`

Update `currentWave` in setup-complete.json to `currentWave + 1`.

---

## Done

**If more waves remain:** "Wave `<N>` complete. Return to the /agent-team
checklist and repeat Step 4 for Wave `<N+1>`."

**If all waves done:** "All `<TOTAL_WAVES>` waves complete. Return to the
/agent-team checklist and proceed to Step 5 (`wf-guardian`)."
