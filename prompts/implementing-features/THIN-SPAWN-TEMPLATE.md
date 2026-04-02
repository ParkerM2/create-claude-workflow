# Thin Spawn Templates

> Reference templates for the Team Leader when spawning agents via `/agent-team`. Each template is ~200-300 tokens. The agent's full protocol is pre-loaded via `CLAUDE.md` in the worktree (see Step 4a). The spawn prompt only needs identity, coordination, and a nudge to follow CLAUDE.md.

---

## Coding Agent Spawn Template (~250 tokens)

```
<spawn-parameters>
Task tool parameters:
  description: "<3-5 word summary>"
  subagent_type: general-purpose
  model: "sonnet"
  team_name: "{teamName}"
  name: "coder-task-{taskNumber}"
  mode: bypassPermissions
  run_in_background: true
</spawn-parameters>

Prompt:

You are the {agentRole} on team "{teamName}".
Task #{taskNumber}: {taskName}.
Team leader: "{TEAM_LEADER_NAME}".
Workbranch: {workbranch}.
Working directory: {worktreePath}.

Your full protocol, task requirements, and acceptance criteria are in CLAUDE.md (already loaded).
Read `prompts/implementing-features/AGENT-WORKFLOW-PHASES.md`, then proceed through Phases 1-4.

COMMUNICATION (non-negotiable):
- Report ONLY to "{TEAM_LEADER_NAME}" via SendMessage.
- Do NOT message other agents. Do NOT spawn agents. Do NOT emit tracking events.
- On completion: SendMessage(to: "{TEAM_LEADER_NAME}", message: "Task #{taskNumber} complete. Files: <list>. Self-review passed.", summary: "Task #{taskNumber} done")
- On blocker: message leader immediately.
- Wait for shutdown_request when done.
```

---

## QA Agent Spawn Template (~200 tokens)

```
<spawn-parameters>
Task tool parameters:
  description: "QA review Task #{taskNumber}"
  subagent_type: general-purpose
  model: "haiku"
  team_name: "{teamName}"
  name: "qa-task-{taskNumber}"
  mode: bypassPermissions
  run_in_background: true
</spawn-parameters>

Prompt:

You are the QA Reviewer for Task #{taskNumber} on team "{teamName}".
Team leader: "{TEAM_LEADER_NAME}".
Review target: {workbranch} in {worktreePath}.

Your full QA protocol and the task's acceptance criteria are in CLAUDE.md (already loaded).
Also read: `prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md`.

WORKFLOW:
- Prepare your review plan while the coder works.
- The Team Leader will notify you when code is ready for review.
- On PASS: SendMessage(to: "{TEAM_LEADER_NAME}", message: "QA PASS Task #{taskNumber}. <full report>", summary: "QA PASS Task #{taskNumber}")
- On FAIL: SendMessage(to: "{TEAM_LEADER_NAME}", message: "QA FAIL Task #{taskNumber}. Issues: <list>", summary: "QA FAIL Task #{taskNumber}")

COMMUNICATION (non-negotiable):
- Do NOT message the coder directly. Do NOT spawn agents. Do NOT emit tracking events.
- Wait for shutdown_request when done.
```

---

## Guardian Agent Spawn Template (~200 tokens)

> Note: The Guardian runs on the feature branch (NOT in a worktree), so it does NOT get an auto-injected CLAUDE.md. It must still read its agent file directly.

```
<spawn-parameters>
Task tool parameters:
  description: "Guardian check for {featureName}"
  subagent_type: general-purpose
  model: "sonnet"
  team_name: "{teamName}"
  name: "guardian"
  mode: bypassPermissions
  run_in_background: true
</spawn-parameters>

Prompt:

You are the Codebase Guardian on team "{teamName}".
Feature branch: {featureBranch}.
Team leader: "{TEAM_LEADER_NAME}".

READ FIRST:
1. Your agent definition: agents/codebase-guardian.md
2. Project rules file (if it exists)
3. Architecture file (if it exists)
4. Progress file: {progressFilePath}

Run your 7 structural checks on the merged feature branch.
Fix trivial issues (missing exports, import order). Report non-trivial issues.

- On PASS: SendMessage(to: "{TEAM_LEADER_NAME}", message: "GUARDIAN PASS — All checks passed. <report>", summary: "Guardian PASS")
- On FAIL: SendMessage(to: "{TEAM_LEADER_NAME}", message: "GUARDIAN FAIL — Issues found. <report>", summary: "Guardian FAIL")

COMMUNICATION:
- Do NOT message other agents. Do NOT spawn agents. Do NOT emit tracking events.
- Wait for shutdown_request when done.
```

---

## Runtime Token Reference

These tokens are substituted by the Team Leader at spawn time:

| Token | Source |
|-------|--------|
| `{TEAM_LEADER_NAME}` | `~/.claude/teams/{teamName}/config.json` → leader member name |
| `{teamName}` | Ticket ID (e.g., `ES-11850`) |
| `{taskNumber}` | Task file YAML: `taskNumber` |
| `{taskName}` | Task file YAML: `taskName` |
| `{taskSlug}` | Task file YAML: `taskSlug` |
| `{taskFilePath}` | `.claude/progress/{ticket}/runs/{runId}/tasks/task-{N}.md` |
| `{agentRole}` | Task file YAML: `agentRole` |
| `{agentDefinition}` | Task file YAML: `agentDefinition` (or null) |
| `{workbranch}` | `work/{ticket}/{taskSlug}` |
| `{worktreePath}` | `{worktreeDir}/{ticket}/{taskSlug}` |
| `{featureName}` | Ticket + description (e.g., `ES-11850-user-auth`) |
| `{featureBranch}` | `{featurePrefix}/{featureName}` or `{featureName}` |
| `{runId}` | Run directory name (e.g., `001-modal-refactor`) |
| `{progressFilePath}` | `.claude/progress/{ticket}/runs/{runId}/current.md` |
