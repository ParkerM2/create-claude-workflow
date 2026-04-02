---
name: wf-guardian
description: Step 5 of /agent-team — spawns the Codebase Guardian for structural integrity check on the merged feature branch
---

# WF: Guardian

## Gate Check

```bash
cat .claude/.workflow-state/all-waves-complete.json
```

If the file does not exist: **STOP** — "Not all waves are complete. Finish
all waves with `wf-qa-gate` before running the Guardian."

Load `TICKET`, `TEAM_LEADER_NAME`, `PLUGIN_ROOT`, `mode`, `featureBranch`
from state files.

---

## Your Task

Spawn the Codebase Guardian on the feature branch and handle its verdict.
Skip in fast mode.

---

## Checklist

### 1. Fast Mode Skip

If `mode` is `"fast"`:

```bash
touch .claude/.workflow-state/guardian-passed.json
```

Emit: `/claude-workflow:track checkpoint "guardian-passed (fast mode skip)"`

Skip to "Done."

### 2. Confirm on Feature Branch

```bash
git checkout <featureBranch>
git status
```

Must be on the feature branch with a clean working tree before spawning.

### 3. Read Guardian Spawn Template

```bash
cat {PLUGIN_ROOT}/prompts/implementing-features/THIN-SPAWN-TEMPLATE.md
```

Use the **Codebase Guardian** template section.

### 4. Spawn Guardian

```
Agent tool:
  description: "guardian"
  subagent_type: codebase-guardian
  team_name: "<TICKET>"
  name: "guardian"
  mode: bypassPermissions
  model: sonnet
  run_in_background: false
  prompt: <substitute Guardian template>
```

Wait for the Guardian to complete and SendMessage its verdict.

### 5. Handle Verdict

**On PASS:**

1. Write stamp:
   ```bash
   touch .claude/.workflow-state/guardian-passed.json
   ```
2. Emit: `/claude-workflow:track checkpoint "guardian-passed"`
3. Shut down: `SendMessage(to: "guardian", message: {"type": "shutdown_request"})`

**On FAIL:**

1. Emit: `/claude-workflow:track checkpoint "guardian-failed"`
2. Spawn a fix agent on a new workbranch with the Guardian's findings
3. Merge fix branch into feature branch
4. Spawn Guardian again: `name: "guardian-r2"`
5. Repeat until PASS (max 3 rounds; escalate to user on round 3)

---

## Done

Report: "Guardian passed. Feature branch `<featureBranch>` is structurally
clean. Return to the /agent-team checklist and proceed to Step 6
(`wf-finalize`)."
