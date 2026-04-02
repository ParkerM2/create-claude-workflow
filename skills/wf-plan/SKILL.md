---
name: wf-plan
description: Step 2 of /agent-team — reads task files, validates structure, and builds the wave execution plan
---

# WF: Load Plan

## Gate Check

```bash
cat .claude/.workflow-state/preflight-complete.json
```

If the file does not exist: **STOP** — "Pre-flight not complete. Run Step 1
(`wf-preflight`) first."

Read the file and load: `TICKET`, `FEATURE_NAME`, `PLUGIN_ROOT`, `mode`.

---

## Your Task

Parse the task files and produce a validated wave plan before any agents
are spawned.

---

## Checklist

### 1. Read Design Doc (if exists)

```bash
ls .claude/progress/<TICKET>/plans/*.md 2>/dev/null
```

If found, read it for architectural context. If not found, continue.

### 2. Parse Task Files

```bash
ls .claude/progress/<TICKET>/tasks/task-*.md
```

For each file, extract YAML frontmatter:

- `taskNumber`, `taskName`, `taskSlug`, `agentRole`, `agentDefinition`
- `wave`, `blockedBy`, `blocks`, `estimatedTokens`, `complexity`

### 3. Validate

Check all of the following. If any fail, list ALL failures before stopping:

- Every task has `taskNumber`, `taskName`, `taskSlug`, `wave`
- No two tasks own the same file path
- Dependency graph is acyclic (`blockedBy` has no cycles)
- No task exceeds 18,000 `estimatedTokens`

If validation fails: **STOP** — list each issue with the task file name.

### 4. Build Wave Plan

Group tasks by `wave` number. Sort waves numerically. Record `TOTAL_WAVES`.

Output a summary table:

```
Wave 1: task-1 (react-component-agent), task-2 (react-hooks-agent)
Wave 2: task-3 (react-query-agent)
Total: 3 tasks, 2 waves
```

### 5. Write Stamp

```bash
cat > .claude/.workflow-state/plan-complete.json << EOF
{
  "ticket": "<TICKET>",
  "totalTasks": <N>,
  "totalWaves": <M>,
  "taskFiles": ["task-1.md", "task-2.md", ...],
  "waveMap": { "1": ["task-1", "task-2"], "2": ["task-3"] },
  "currentWave": 1
}
EOF
```

Emit: `/claude-workflow:track plan.created "<N tasks in M waves>"`

---

## Done

Report the wave plan summary and say: "Plan loaded. Return to the /agent-team
checklist and check Step 2."
