---
name: wf-setup
description: Step 3 of /agent-team — creates the team, injects runtime values into task files, creates worktrees, and writes CLAUDE.md into each worktree
---

# WF: Team Setup

## Gate Check

```bash
cat .claude/.workflow-state/plan-complete.json
```

If the file does not exist: **STOP** — "Plan not loaded. Run Step 2
(`wf-plan`) first."

Load: `TICKET`, `TOTAL_WAVES`, `waveMap`, task file list. Also reload
`preflight-complete.json` for `PLUGIN_ROOT`, `mode`, `currentBranch`,
`featurePrefix`, `workPrefix`, `worktreeDir`, `useWorktrees`.

---

## Your Task

Create the team, prepare task files with runtime values, create worktrees,
and inject a `CLAUDE.md` into each worktree.

---

## Checklist

### 1. TeamCreate

```
TeamCreate: team_name = "<TICKET>"
```

After creation, read team config to get your own name:

```bash
cat ~/.claude/teams/<TICKET>/config.json
```

Extract your `TEAM_LEADER_NAME` from the `members` array. Store it.

### 2. Clean Stale State

```bash
git worktree list --porcelain \
  | grep "worktree.*<worktreeDir>/<TICKET>" \
  | awk '{print $2}' \
  | xargs -r -I{} git worktree remove --force {}

git branch --list "<workPrefix>/<TICKET>/*" \
  | xargs -r git branch -D
```

### 3. Update Task Files with Runtime Values

For each `task-*.md` file, update YAML frontmatter:

- `teamLeaderName` → `TEAM_LEADER_NAME`
- `teamName` → `TICKET`
- `workbranch` → `<workPrefix>/<TICKET>/<taskSlug>`
- `worktreePath` → `<worktreeDir>/<TICKET>/<taskSlug>`
- `status` → `"pending"`

### 4. TaskCreate with Dependencies

For each task, call `TaskCreate` with description + acceptance criteria from
the task file. Then call `TaskUpdate` with `addBlockedBy` for each entry in
the task's `blockedBy` field.

### 5. Create Worktrees (Wave 1 only)

For each task in Wave 1:

```bash
git worktree add <worktreeDir>/<TICKET>/<taskSlug> \
  -b <workPrefix>/<TICKET>/<taskSlug>
```

If `useWorktrees` is false, create branches instead and continue with
sequential execution.

### 6. Inject CLAUDE.md into Each Worktree

For each Wave 1 task worktree, write
`<worktreeDir>/<TICKET>/<taskSlug>/CLAUDE.md`:

```markdown
# Task #{taskNumber}: {taskName}

You are **{agentRole}** on team "{teamName}".
Workbranch: `{workbranch}`.

## Agent Protocol

{paste full contents of agents/{agentRole}.md — minus YAML frontmatter}

## Task Requirements

{paste task file body: acceptance criteria, file scope, rules,
implementation notes}

## Workflow Phases

Read `{PLUGIN_ROOT}/prompts/implementing-features/AGENT-WORKFLOW-PHASES.md`
and follow Phases 1–4.

## Communication

- Report ONLY to "{TEAM_LEADER_NAME}" via SendMessage.
- Do NOT message other agents. Do NOT spawn agents.
- On completion: SendMessage(to: "{TEAM_LEADER_NAME}",
  message: "Task #{taskNumber} complete. Files: <list>. Self-review passed.")
- On blocker: message leader immediately.
- Wait for shutdown_request when done.
```

### 7. Create Run Folder & Update Context

Determine the next sequential run number by counting existing task folders under `./progress/<TICKET>/tasks/`:

```bash
ls -d .claude/progress/<TICKET>/tasks/[0-9][0-9][0-9]-* 2>/dev/null | wc -l
```

Increment by 1 and zero-pad to 3 digits (e.g., `001`, `002`). Combine with the feature slug (kebab-case) to form `RUN_SLUG` (e.g., `001-auth-refactor`).

Create the run folder:

```bash
mkdir -p .claude/progress/<TICKET>/tasks/<RUN_SLUG>
```

Move any staged research files from `./progress/<TICKET>/research/` into the run folder (if the directory exists and contains files):

```bash
if [ -d .claude/progress/<TICKET>/research ] && [ "$(ls -A .claude/progress/<TICKET>/research 2>/dev/null)" ]; then
  mv .claude/progress/<TICKET>/research/* .claude/progress/<TICKET>/tasks/<RUN_SLUG>/
fi
```

Update the routing key with the resolved `runSlug`:

```bash
cat > .claude/.current-context.json << EOF
{ "ticket": "<TICKET>", "phase": "agent-team", "runSlug": "<RUN_SLUG>" }
EOF
```

Store `RUN_SLUG` — it is needed by `wf-finalize` to write the run report.

### 8. Write Sentinel & Stamp

Write `.claude/.workflow-active`:

```json
{
  "ticket": "<TICKET>",
  "feature": "<FEATURE_NAME>",
  "teamLeaderName": "<TEAM_LEADER_NAME>",
  "startedAt": "<ISO8601>",
  "mode": "<mode>"
}
```

Write stamp:

```bash
cp .claude/.workflow-state/plan-complete.json \
   .claude/.workflow-state/setup-complete.json
```

Then add `teamLeaderName` to the setup-complete.json.

Emit: `/claude-workflow:track checkpoint "setup-complete"`

---

## Done

Report: "Team setup complete. Team: `<TICKET>`, leader: `<TEAM_LEADER_NAME>`.
Worktrees ready for Wave 1 (`<N>` tasks). Return to the /agent-team checklist
and check Step 3."
