---
name: wf-spawn
description: Step 4a of /agent-team — spawns coder + QA agent pair for each task in the current wave
---

# WF: Spawn Wave

## Gate Check

```bash
cat .claude/.workflow-state/setup-complete.json
```

If the file does not exist: **STOP** — "Team setup not complete. Run Step 3
(`wf-setup`) first."

Load: `TICKET`, `TEAM_LEADER_NAME`, `currentWave`, `waveMap`, `PLUGIN_ROOT`,
`workPrefix`, `worktreeDir`. Also check for a wave-specific gate:

```bash
# If currentWave > 1, previous wave must be complete
cat .claude/.workflow-state/wave-$((currentWave - 1))-complete.json 2>/dev/null
```

If previous wave stamp missing and `currentWave > 1`: **STOP** — "Wave
`<N-1>` not complete. Run `wf-qa-gate` for that wave first."

---

## Your Task

Spawn agent pairs for the current wave. Both the coder and QA agent are
spawned in the **same message** (parallel tool calls).

---

## Checklist

### 1. Identify This Wave's Tasks

From `waveMap`, get the list of task slugs for `currentWave`. For each slug,
read the corresponding task file to get: `taskNumber`, `taskName`, `taskSlug`,
`agentRole`, `agentDefinition`, `workbranch`, `worktreePath`.

### 2. Read Spawn Templates

```bash
cat {PLUGIN_ROOT}/prompts/implementing-features/THIN-SPAWN-TEMPLATE.md
```

Use the **Coding Agent** and **QA Agent** templates from this file.

### 3. Spawn Pairs (one message per task, both agents in parallel tool calls)

For each task, in a **single message**, call the `Agent` tool twice:

**Coder:**

```
Agent tool:
  description: "<taskSlug> coder"
  subagent_type: general-purpose
  team_name: "<TICKET>"
  name: "coder-task-<N>"
  mode: bypassPermissions
  model: sonnet
  run_in_background: true
  isolation: worktree  (only if useWorktrees is false)
  prompt: <substitute THIN-SPAWN-TEMPLATE.md coding template>
```

**QA:**

```
Agent tool:
  description: "<taskSlug> QA"
  subagent_type: general-purpose
  team_name: "<TICKET>"
  name: "qa-task-<N>"
  mode: bypassPermissions
  model: haiku
  run_in_background: true
  prompt: <substitute THIN-SPAWN-TEMPLATE.md QA template>
```

Save the returned `task_id` for each agent.

### 4. Update Task Files

For each spawned task, update `status` → `"active"` in the task file
frontmatter.

Emit per task: `/claude-workflow:track task.started "Task #<N>" --task <N>`

### 5. Write Spawn Stamp

```bash
cat > .claude/.workflow-state/wave-<currentWave>-spawned.json << EOF
{
  "wave": <currentWave>,
  "tasks": ["task-1", "task-2", ...],
  "agentIds": { "coder-task-1": "<id>", "qa-task-1": "<id>", ... },
  "spawnedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

---

## Done

Report: "Wave `<N>` spawned — `<M>` coder + QA pairs running in background.
Return to the /agent-team checklist and proceed to Step 4b (`wf-qa-gate`)."
