---
name: wf-finalize
description: Step 6 of /agent-team — shuts down all agents, cleans up worktrees, pushes the branch, optionally creates a PR, and reports to the user
---

# WF: Finalize

## Gate Check

```bash
cat .claude/.workflow-state/guardian-passed.json
```

If the file does not exist: **STOP** — "Guardian check not complete. Run
Step 5 (`wf-guardian`) first."

Load `TICKET`, `TEAM_LEADER_NAME`, `featureBranch`, `mode` from state files.

---

## Your Task

Clean up everything, push the branch, and hand off to the user.

> **Order is mandatory:** shut down agents BEFORE removing sentinel BEFORE
> emitting session.end.

---

## Checklist

### 1. Shut Down All Agents

Send `shutdown_request` to every active agent on the team. Check
`wave-<N>-spawned.json` files for agent names if unsure who is running:

```
SendMessage(to: "<agent-name>", message: {"type": "shutdown_request"})
```

Wait for each to acknowledge or time out (30s max per agent).

### 2. Remove Sentinel File

```bash
rm -f .claude/.workflow-active
```

### 3. Clean Remaining Worktrees

```bash
git worktree list --porcelain \
  | grep "worktree.*<worktreeDir>/<TICKET>" \
  | awk '{print $2}' \
  | xargs -r -I{} git worktree remove --force {}

git branch --list "<workPrefix>/<TICKET>/*" \
  | xargs -r git branch -D
```

### 4. Push Feature Branch

```bash
git push origin <featureBranch>
```

### 5. Create PR (if requested or strict mode)

Ask the user: "Create a PR for `<featureBranch>`? (y/n)"

If yes:

```bash
gh pr create \
  --title "<TICKET>: <feature summary>" \
  --body "$(cat << 'EOF'
## Summary

<bullet list of tasks completed>

## Changes

<files modified>

## Test plan

- [ ] QA passed all tasks
- [ ] Codebase Guardian passed
- [ ] Wave fence passed
EOF
)" \
  --base <baseBranch>
```

### 6. Compile & Write Run Report

Read `./progress/<TICKET>/events.jsonl` and compile metrics from it.

**From `agent.spawned` events** — extract per-agent rows:
- `agent`: agent name
- `model`: model field from event data (if present)
- `role`: role field from event data (if present)
- `start`: timestamp of the `agent.spawned` event (HH:MM)
- `duration`: difference between `agent.spawned` and the matching `agent.completed` event
- `input` / `output` / `cache_read` / `cache_write`: token fields from event data (if present, else `—`)
- `skills`: skills field from event data (if present, else `—`)

**From all events** — extract milestone-only timeline entries:
- Include: `session.start`, `checkpoint.*`, `wave.start`, `wave.complete`, `agent.spawned`, `agent.completed`, `guardian.passed`, `session.end`
- Format each as: `- HH:MM event.type`

Load `RUN_SLUG` from `.claude/.current-context.json` (the `runSlug` field). Load `featureBranch`, `TICKET`, and PR number (if created in Step 5) from state files.

Write `./progress/<TICKET>/tasks/<RUN_SLUG>/report.md`:

```xml
<run-header ticket="<TICKET>" run="<RUN_SLUG>" status="complete"
            date="<YYYY-MM-DD>" duration="<Xh Ym>" branch="<featureBranch>" pr="<#N or pending>" />

<run-summary>
2-3 sentence summary of what was built, key decisions, and any notable issues encountered.
</run-summary>

<agent-metrics>
| Agent | Model | Role | Start | Duration | Input | Output | Cache R | Cache W | Skills |
|-------|-------|------|-------|----------|-------|--------|---------|---------|--------|
(one row per agent from agent.spawned events)
</agent-metrics>

<run-timeline>
(milestone events only, one per line: - `HH:MM` event.type)
</run-timeline>

<run-totals input="<Nk>" output="<Nk>" cache-read="<Nk>" cache-write="<Nk>"
            wall-time="<Xh Ym>" agents="<N>" tasks="<N>" waves="<N>" />
```

### 7. TeamDelete

```
TeamDelete: team_name = "<TICKET>"
```

### 8. Emit session.end

```
/claude-workflow:track session.end "Feature complete"
```

### 9. Clean Up

```bash
rm -f .claude/.current-context.json
rm -f .claude/.workflow-active
rm -rf .claude/.workflow-state/
```

### 10. Report to User

Provide a completion summary:

```
Feature complete: <FEATURE_NAME>
Branch: <featureBranch>
Tasks completed: <N>
Waves: <M>
Files changed: <list of key files>
PR: <URL or "not created">
```

---

## Done

The workflow is complete. No further steps.
