# Workflow Upgrade v1 — Audit & QA Index

> Reference index for auditing and QA of the workflow-upgrade-1 branch.
> Commit: `8054d2a` on branch `workflow-upgrade-1`
> Scope: 14 files changed, 2,333 insertions, 872 deletions

---

## How to Use This Index

This document serves as a structured checklist for AI-driven audit and QA. Each section maps a deliverable to its source research, spec, and acceptance criteria. An auditing agent should:

1. Read this index to understand the full scope
2. For each deliverable, read the source spec → then read the implementation → compare
3. Check cross-references between files (tokens match, paths correct, no stale references)
4. Verify JS modules load (`node -e "require('./hooks/<file>')"`)
5. Flag gaps, inconsistencies, or missing edge cases

---

## Research Documents (Input — Read First)

These drove the implementation. Read them to understand design intent and constraints.

### Topic Research (6 deep-dives)

| # | File | Topic | Key Decisions |
|---|------|-------|---------------|
| 1 | `research/topic-1-teamlead-self-init.md` | Team-lead identity enforcement | Init-gate hook, must-read-identity pattern |
| 2 | `research/topic-2-agent-teams-init.md` | Agent Teams initialization | TeamCreate → discover name → spawn sequence |
| 3 | `research/topic-3-hooks-permissions-rules.md` | Hook system design | Sentinel-gated enforcement, fail-open, recovery actions |
| 4 | `research/topic-4-nonblocking-docs.md` | Non-blocking documentation | Exempt paths for research/docs |
| 5 | `research/topic-5-ticket-progress-tracking.md` | Ticket-based tracking | ES-{N} pattern, history.json schema |
| 6 | `research/topic-6-agent-handoff-optimization.md` | Thin spawn optimization | Task files on disk, ~500 token prompts, AGENT-WORKFLOW-PHASES extraction |
| — | `research/COMPREHENSIVE-REPORT.md` | Consolidated findings | Cross-topic synthesis |

### Specs (4 specifications)

| File | Defines | Audit Against |
|------|---------|---------------|
| `research/agent-team-plan/specs/agent-team-command-spec.md` | Full `/agent-team` behavior | `commands/agent-team.md` |
| `research/agent-team-plan/specs/task-handoff-schema.md` | Task file YAML + body format | `commands/new-plan.md` Phase 7.5 |
| `research/agent-team-plan/specs/sentinel-file-spec.md` | `.workflow-active` lifecycle | `hooks/workflow-enforcer.js`, `hooks/config.js` |
| `research/agent-team-plan/specs/enforcement-rules.md` | All gates and recovery actions | `hooks/workflow-enforcer.js` |

### Task Handoff Files (10 tasks, 4 waves)

| File | Task | Implemented In |
|------|------|---------------|
| `research/agent-team-plan/tasks/task-01-workflow-phases.md` | Extract AGENT-WORKFLOW-PHASES.md | `prompts/implementing-features/AGENT-WORKFLOW-PHASES.md` |
| `research/agent-team-plan/tasks/task-02-thin-spawn-template.md` | Create THIN-SPAWN-TEMPLATE.md | `prompts/implementing-features/THIN-SPAWN-TEMPLATE.md` |
| `research/agent-team-plan/tasks/task-03-ticket-module.md` | Create ticket.js | `hooks/ticket.js` |
| `research/agent-team-plan/tasks/task-04-agent-team-command.md` | Write agent-team.md | `commands/agent-team.md` |
| `research/agent-team-plan/tasks/task-05-workflow-enforcer.md` | Create workflow-enforcer.js | `hooks/workflow-enforcer.js` |
| `research/agent-team-plan/tasks/task-06-init-gate.md` | Create init-gate.js | `hooks/init-gate.js` |
| `research/agent-team-plan/tasks/task-07-new-plan-update.md` | Update new-plan.md | `commands/new-plan.md` |
| `research/agent-team-plan/tasks/task-08-hooks-integration.md` | Update hooks.json + config.js | `hooks/hooks.json`, `hooks/config.js` |
| `research/agent-team-plan/tasks/task-09-team-leader-update.md` | Update team-leader.md | `agents/team-leader.md` |
| `research/agent-team-plan/tasks/task-10-integration-test.md` | Integration test checklist | This index |

### Master Plan

| File | Purpose |
|------|---------|
| `research/agent-team-plan/PLAN.md` | 10-task breakdown, dependency graph, wave ordering |

---

## New Commands (3)

| Command | File | Lines | Source Spec | Acceptance Criteria Location |
|---------|------|-------|------------|------------------------------|
| `/agent-team` | `commands/agent-team.md` | 403 | `specs/agent-team-command-spec.md` | `tasks/task-04-agent-team-command.md` |
| `/setup-workflow` | `commands/setup-workflow.md` | 165 | Session plan `temporal-spinning-ripple.md` | Phase checklist within the file |
| `/connect-atlassian` | `commands/connect-atlassian.md` | 229 | Jira research agents (session) | Step checklist within the file |

### Audit Checks — Commands

- [ ] `/agent-team` phases match spec (5 phases: Setup, Load Plan, Team Setup, Execute Waves, Guardian & Finalize)
- [ ] `/agent-team` references correct file paths (`THIN-SPAWN-TEMPLATE.md`, `AGENT-WORKFLOW-PHASES.md`, `ticket.js`)
- [ ] `/agent-team` has verification checklist per phase
- [ ] `/agent-team` sentinel lifecycle: created Phase 1, removed Phase 5
- [ ] `/agent-team` lists `/agent-team` as primary (not `/new-feature`)
- [ ] `/setup-workflow` is a lean checklist (~165 lines), not inlined content
- [ ] `/setup-workflow` references `commands/connect-atlassian.md` (not inline Atlassian flow)
- [ ] `/setup-workflow` references `skills/workflow-setup/SKILL.md` for config questions
- [ ] `/setup-workflow` references `.claude/docs/internal/PLAN.md` for tech→agent mapping
- [ ] `/setup-workflow` references `AGENT-WORKFLOW-PHASES.md` for generated agent init
- [ ] `/setup-workflow` includes Agent Teams settings.json check
- [ ] `/connect-atlassian` has complete guided flow (token gen → collect details → write config → verify)
- [ ] `/connect-atlassian` uses sooperset/mcp-atlassian (not Rovo OAuth)
- [ ] `/connect-atlassian` stores token in env vars (not hardcoded in config)

---

## New Hook Modules (3)

| File | Lines | Source Spec | Replaces |
|------|-------|------------|----------|
| `hooks/ticket.js` | 238 | `tasks/task-03-ticket-module.md` | — (new) |
| `hooks/workflow-enforcer.js` | 360 | `specs/enforcement-rules.md`, `tasks/task-05-workflow-enforcer.md` | proof-gate, config-guard, enforcement-gate, team-leader-gate, workflow-gate |
| `hooks/init-gate.js` | 130 | `tasks/task-06-init-gate.md` | — (new) |

### Audit Checks — Hooks

- [ ] `ticket.js` loads: `node -e "require('./hooks/ticket.js')"`
- [ ] `ticket.js` exports: `extractTicketFromBranch`, `ensureTicketDir`, `getHistory`, `addHistoryEntry`, `updateTaskFileRuntime`
- [ ] `ticket.js` handles: `ES-11850-desc`, `feature/ES-11850-desc`, `work/ES-11850/task-1`, `main` (null), `feature/old-style` (null)
- [ ] `workflow-enforcer.js` loads: `node -e "require('./hooks/workflow-enforcer.js')"` (needs stdin)
- [ ] `workflow-enforcer.js` checks sentinel FIRST — absent → exit 0 (skip all enforcement)
- [ ] `workflow-enforcer.js` implements: merge gate, cherry-pick gate, app-code-write gate, agent-kill gate, team-delete gate, fake-event gate, state-file-protection
- [ ] `workflow-enforcer.js` every deny has a recovery action (no deadlocks)
- [ ] `workflow-enforcer.js` state-file-protection is always active (sentinel-independent)
- [ ] `workflow-enforcer.js` exempt paths: `research/`, `.claude/docs/`, `docs/`
- [ ] `init-gate.js` loads: `node -e "require('./hooks/init-gate.js')"` (needs stdin)
- [ ] `init-gate.js` blocks TeamCreate and Agent until team-leader.md is read
- [ ] `init-gate.js` allows Read tool always
- [ ] `init-gate.js` uses temp-file marker with 24hr TTL
- [ ] `init-gate.js` fail-open on any error

---

## New Prompt Reference Files (2)

| File | Lines | Source Spec |
|------|-------|------------|
| `prompts/implementing-features/AGENT-WORKFLOW-PHASES.md` | 209 | `tasks/task-01-workflow-phases.md` |
| `prompts/implementing-features/THIN-SPAWN-TEMPLATE.md` | 143 | `tasks/task-02-thin-spawn-template.md` |

### Audit Checks — Prompts

- [ ] `AGENT-WORKFLOW-PHASES.md` contains Phases 0-4 (Load Rules, Write Plan, Execute, Self-Review, Report)
- [ ] `AGENT-WORKFLOW-PHASES.md` contains Error Recovery Protocol
- [ ] `AGENT-WORKFLOW-PHASES.md` contains Context Exhaustion Protocol
- [ ] `AGENT-WORKFLOW-PHASES.md` uses placeholder tokens: `{TEAM_LEADER_NAME}`, `{taskNumber}`, `{workbranch}`, `{worktreePath}`, `{taskFilePath}`, `{agentDefinition}`
- [ ] `AGENT-WORKFLOW-PHASES.md` under 210 lines
- [ ] `THIN-SPAWN-TEMPLATE.md` has coding agent template (~500 tokens)
- [ ] `THIN-SPAWN-TEMPLATE.md` has QA agent template (~400 tokens)
- [ ] `THIN-SPAWN-TEMPLATE.md` has Guardian agent template (~400 tokens)
- [ ] `THIN-SPAWN-TEMPLATE.md` placeholder tokens match `AGENT-WORKFLOW-PHASES.md` tokens
- [ ] `THIN-SPAWN-TEMPLATE.md` communication rules are INLINE (not externalized)

---

## Modified Files (6)

| File | Change Summary | Source Spec |
|------|---------------|------------|
| `commands/new-plan.md` | Added Phase 7.5: task file generation | `tasks/task-07-new-plan-update.md` |
| `hooks/hooks.json` | Registered new hooks, deregistered legacy | `tasks/task-08-hooks-integration.md` |
| `hooks/config.js` | Added sentinel helpers + ticket integration | `tasks/task-08-hooks-integration.md` |
| `agents/team-leader.md` | Rewritten 500→175 lines | `tasks/task-09-team-leader-update.md` |
| `.claude/agents/team-leader.md` | Synced with above | `tasks/task-09-team-leader-update.md` |
| `skills/using-workflow/SKILL.md` | Added 3 commands to table | — |

### Audit Checks — Modified Files

- [ ] `new-plan.md` Phase 7.5 exists between Phase 7 and Phase 8
- [ ] `new-plan.md` Phase 7.5 generates task files matching `specs/task-handoff-schema.md`
- [ ] `new-plan.md` handoff references `/agent-team` (not just `/new-feature`)
- [ ] `hooks.json` registers `workflow-enforcer.js` for Bash, Edit|Write, TaskStop|TeamDelete
- [ ] `hooks.json` registers `init-gate.js` for TeamCreate|Agent
- [ ] `hooks.json` keeps `safety-guard.js` on Bash (always active)
- [ ] `hooks.json` keeps SessionStart, PostToolUse, TeammateIdle, TaskCompleted, Stop hooks unchanged
- [ ] `hooks.json` does NOT register deregistered legacy hooks
- [ ] `config.js` exports: `isSentinelActive`, `readSentinel`, `writeSentinel`, `removeSentinel`, `getTicketModule`
- [ ] `config.js` sentinel stale detection: >24hr + dead PID = null
- [ ] `config.js` all existing exports preserved (16 total + 5 new = 21)
- [ ] `team-leader.md` has agent-identity block
- [ ] `team-leader.md` has all 11 coordination rules matching `agent-team.md` header
- [ ] `team-leader.md` references `/agent-team` as primary command
- [ ] `team-leader.md` references `THIN-SPAWN-TEMPLATE.md` and `AGENT-WORKFLOW-PHASES.md`
- [ ] `team-leader.md` contains error recovery and context recovery sections
- [ ] `team-leader.md` does NOT contain phase-by-phase workflow (that's in agent-team.md)
- [ ] `.claude/agents/team-leader.md` is identical to `agents/team-leader.md`
- [ ] `using-workflow/SKILL.md` lists `/setup-workflow`, `/connect-atlassian`, `/agent-team`

---

## Deregistered Files (5) — Verify NOT Deleted

| File | Replaced By | Status |
|------|------------|--------|
| `hooks/proof-gate.js` | `hooks/workflow-enforcer.js` | Should still exist on disk |
| `hooks/config-guard.js` | `hooks/workflow-enforcer.js` | Should still exist on disk |
| `hooks/enforcement-gate.js` | `hooks/workflow-enforcer.js` | Should still exist on disk |
| `hooks/team-leader-gate.js` | `hooks/workflow-enforcer.js` | Should still exist on disk |
| `hooks/workflow-gate.js` | `hooks/workflow-enforcer.js` | Should still exist on disk |

- [ ] All 5 files still exist on disk (NOT deleted — rollback safety)
- [ ] None of the 5 are registered in `hooks.json`

---

## Cross-File Consistency Checks

These verify that references between files are correct and nothing is stale.

- [ ] Placeholder tokens in `AGENT-WORKFLOW-PHASES.md` match tokens in `THIN-SPAWN-TEMPLATE.md`
- [ ] Placeholder tokens in `THIN-SPAWN-TEMPLATE.md` match substitution in `agent-team.md` Phase 4b
- [ ] Task handoff schema fields in `specs/task-handoff-schema.md` match what `new-plan.md` Phase 7.5 generates
- [ ] Task handoff schema fields match what `agent-team.md` Phase 2 reads
- [ ] Sentinel schema in `specs/sentinel-file-spec.md` matches what `agent-team.md` Phase 1.5 writes
- [ ] Sentinel schema matches what `workflow-enforcer.js` reads
- [ ] Sentinel helpers in `config.js` match what `specs/sentinel-file-spec.md` defines
- [ ] All 11 rules in `team-leader.md` match all 11 rules in `agent-team.md`
- [ ] `agent-team.md` pre-flight lists same hook files as `hooks.json` registers
- [ ] `setup-workflow.md` hook verification list matches `hooks.json` registrations
- [ ] `setup-workflow.md` prompt file count (17) matches actual count in `prompts/implementing-features/`
- [ ] `connect-atlassian.md` env var names match sooperset/mcp-atlassian documentation
- [ ] No circular dependencies in enforcement gates (every deny's recovery action is allowed by all other gates)
