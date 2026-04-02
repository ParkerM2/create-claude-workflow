---
name: wf-preflight
description: Step 1 of /agent-team — verifies infrastructure, git state, config, and task files before any workflow begins
---

# WF: Pre-flight

**Gate check (Step 1 has no gate — this is the entry point.)**

---

## Your Task

Verify all prerequisites before the workflow begins. If anything fails, STOP
and report the exact failure — do not proceed.

---

## Checklist

### 1. Plugin Infrastructure

Determine `PLUGIN_ROOT` from `<workflow-config>`. Verify these files exist:

```bash
ls {PLUGIN_ROOT}/hooks/config.js
ls {PLUGIN_ROOT}/hooks/tracker.js
ls {PLUGIN_ROOT}/hooks/workflow-enforcer.js
ls {PLUGIN_ROOT}/prompts/implementing-features/THIN-SPAWN-TEMPLATE.md
ls {PLUGIN_ROOT}/prompts/implementing-features/AGENT-WORKFLOW-PHASES.md
ls {PLUGIN_ROOT}/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
```

If any missing: **STOP** — report which files are absent.

### 2. Agent Teams Tools

Confirm these tools are available in this session: `TeamCreate`, `SendMessage`,
`Agent` (or `Task`). If any missing: **STOP**.

### 3. Git State

```bash
git rev-parse --git-dir        # must succeed
git rev-parse --show-toplevel  # store as REPO_ROOT
```

Auto-detect primary branch:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|.*/||'
```

Store as `PRIMARY_BRANCH`. If detection fails, ask the user.

### 4. Project Config

Read `.claude/workflow.json`. Extract: `featurePrefix`, `workPrefix`,
`worktreeDir`, `useWorktrees`, `baseBranch`, workflow mode.

If malformed: **STOP**. If missing: apply defaults and continue.

### 5. Branch & Ticket

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
```

- If branch matches `<featurePrefix>/*`: extract `FEATURE_NAME` and `TICKET`
- If on base branch: ask the user for ticket ID and feature name
- If on wrong branch: warn and ask whether to continue

If no ticket detected, ask: "What's the ticket ID for this feature?"

### 6. Task Files

```bash
ls .claude/progress/<TICKET>/tasks/task-*.md 2>/dev/null
```

If none found: **STOP** — "Run `/new-plan` first to generate task files."

### 7. Create Directories & Write Stamp

```bash
mkdir -p .claude/progress/<TICKET> .claude/tracking .claude/.workflow-state
```

Write stamp file:

```bash
cat > .claude/.workflow-state/preflight-complete.json << EOF
{
  "ticket": "<TICKET>",
  "feature": "<FEATURE_NAME>",
  "repoRoot": "<REPO_ROOT>",
  "primaryBranch": "<PRIMARY_BRANCH>",
  "currentBranch": "<CURRENT_BRANCH>",
  "pluginRoot": "<PLUGIN_ROOT>",
  "mode": "<mode>",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

Emit: `/claude-workflow:track session.start "<FEATURE_NAME>"`

---

## Done

Report: "Pre-flight complete. Ticket: `<TICKET>`, branch: `<CURRENT_BRANCH>`,
mode: `<mode>`. Task files found: `<N>`. Return to the /agent-team checklist
and check Step 1."
