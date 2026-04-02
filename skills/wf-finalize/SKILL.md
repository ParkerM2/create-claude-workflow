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

### 6. TeamDelete

```
TeamDelete: team_name = "<TICKET>"
```

### 7. Emit session.end

```
/claude-workflow:track session.end "Feature complete"
```

### 8. Clean Stamp Files

```bash
rm -rf .claude/.workflow-state/
```

### 9. Report to User

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
