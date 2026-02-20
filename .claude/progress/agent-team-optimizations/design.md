# Design: Agent Team Optimizations

---
status: DRAFT
feature: agent-team-optimizations
created: 2026-02-20
---

## Overview

Comprehensive optimization of the multi-agent workflow across 3 axes: **cost** (token/dollar reduction), **speed** (throughput/latency), and **context** (working memory efficiency). Based on research across Anthropic official docs, community studies, and production agent system patterns.

**Expected compound impact**: 50-80% cost reduction, 30-50% speed improvement, 40-60% context savings across a typical 6-agent feature implementation.

---

## Requirements

### Tier 1 — Quick Wins (implement now)

- [x] **T1.1** Model routing: Sonnet for coding agents, Haiku for QA
- [x] **T1.2** Pre-digested rules in spawn prompts (reduce Phase 0 file reads)
- [x] **T1.3** Cache-friendly prompt layout (static content first, task-specific last)
- [x] **T1.4** Background agent spawning (`run_in_background`)

### Tier 2 — Medium Effort (next iteration)

- [x] **T2.1** Self-claim task model with auto-dependency resolution
- [x] **T2.2** Trigger-table pattern for reference docs
- [x] **T2.3** Heartbeat timeout + task reclamation
- [x] **T2.4** Identity consolidation in agent definitions

### Tier 3 — Larger Changes (future)

- [x] **T3.1** Extended thinking budget management per task complexity
- [x] **T3.2** Persistent QA memory for pattern learning
- [x] **T3.3** Specialized per-domain agent definitions (optional)

---

## Technical Approach

### T1.1 — Model Routing

**Files**: `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`

Add `model` parameter to spawn template Task tool parameters:

```
Coding Agent:  model: "sonnet"   ($3/$15 vs $15/$75 = 80% cheaper)
QA Agent:      model: "haiku"    ($1/$5  vs $15/$75 = 93% cheaper)
Guardian:      model: "sonnet"   ($3/$15 vs $15/$75 = 80% cheaper)
Team Leader:   model: "opus"     (keeps complex reasoning)
```

**Rationale**: Coding agents do focused file-scope work with clear instructions — Sonnet handles this well. QA is primarily read-only (check files, run commands, report) — Haiku suffices. The team leader needs Opus for decomposition reasoning.

**Cost example** (6-agent feature: 1 lead + 3 coding + 1 QA + 1 guardian):
- Before: ~$15 avg across all agents
- After: Lead $15 + 3×$3 + $1 + $3 = $28 vs 6×$15 = $90 → **69% reduction**

---

### T1.2 — Pre-Digested Rules in Spawn Prompts

**Files**: `agents/team-leader.md`, `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`

Instead of:
```
## PHASE 0: LOAD RULES [BLOCKING]
1. Read `the project rules file`
2. Read `the architecture file`
3. Read your agent definition
4. Read `prompts/implementing-features/README.md`
```

Change to:
```
## PHASE 0: LOAD RULES [BLOCKING]
1. Read `the project rules file` (if it exists)
2. Read your agent definition at `agents/<your-agent>.md`

> The following project rules apply to your task (pre-digested by Team Leader):
> - <Rule 1 from project rules: quoted text>
> - <Rule 2 from architecture: quoted text>
> - <Rule 3: specific convention>
```

**Team leader responsibility**: Extract 5-10 relevant rules per task and embed them in the spawn prompt. This replaces 2-3 redundant file reads per agent (~1,500-4,500 tokens saved per agent).

The agent still reads CLAUDE.md (auto-loaded, cached cheaply) and its own agent definition. But it skips the architecture file and playbook — those are for the Team Leader's decomposition phase, not individual coding agents.

**Template change**: Add a `## Pre-Digested Rules` section to the spawn template's `<task-context>` block. Team leader fills this per task.

---

### T1.3 — Cache-Friendly Prompt Layout

**Files**: `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`

Restructure spawn templates so **static content appears first** (identical across agents) and **task-specific content appears last**. This maximizes prompt cache hits.

Current layout:
```
1. Role identity (varies)
2. Workflow phases (static)
3. Error recovery (static)
4. Task context (varies)
```

Optimized layout:
```
1. Workflow phases (STATIC — identical for all coding agents)
2. Error recovery protocol (STATIC — identical for all agents)
3. Role identity (varies per agent)
4. Task context (varies per task)
5. Pre-digested rules (varies per task)
```

The static prefix becomes a cache key. After the first agent spawn, subsequent agents in the same wave get cache hits on ~60% of the prompt.

---

### T1.4 — Background Agent Spawning

**Files**: `agents/team-leader.md`, `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`

Add `run_in_background: true` to coding agent Task tool parameters. The team leader continues coordinating (setting up next wave's worktrees, updating progress) while agents work.

```
Task tool parameters:
  description: "<3-5 word summary>"
  subagent_type: general-purpose
  team_name: "<team-name>"
  name: "<agent-role>"
  mode: bypassPermissions
  model: "sonnet"
  run_in_background: true     ← NEW
```

**Caveat**: Background agents auto-deny unpre-approved permissions and cannot use MCP tools. With `bypassPermissions` mode, file operations work fine. The team-leader checks results via `TaskOutput` or message delivery.

---

### T2.1 — Self-Claim Task Model

**Files**: `agents/team-leader.md`, `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`, `commands/new-feature.md`

Replace explicit wave-by-wave orchestration with a self-claim model:

**Current flow**:
```
Lead creates Wave 1 tasks → spawns agents → waits for all → merges all →
Lead creates Wave 2 tasks → spawns agents → waits for all → merges all → ...
```

**Optimized flow**:
```
Lead creates ALL tasks with dependencies (TaskCreate + TaskUpdate blockedBy) →
Lead spawns N teammates (not per-task, but persistent workers) →
Each teammate: claim unblocked task → work → complete → claim next → ...
Lead: monitors, merges completed branches, resolves blockers
```

**Key changes**:
1. Team leader creates all tasks upfront with full dependency graph
2. Spawn 3-4 persistent teammates (not one per task)
3. Each teammate follows a loop: `TaskList → claim unblocked → work → TaskUpdate complete → TaskList → ...`
4. Team leader runs the merge protocol when tasks complete
5. 5-6 tasks per teammate (official Anthropic guideline)

**Benefits**: Eliminates wave boundaries as bottlenecks. A fast agent can move to the next task immediately instead of waiting for the slowest agent in the wave.

**Merge protocol stays the same** — team leader still does sequential --no-ff merges. The difference is timing: merges happen as tasks complete, not in batch at wave boundaries.

---

### T2.2 — Trigger-Table Pattern for Reference Docs

**Files**: `prompts/implementing-features/README.md`, new file `prompts/implementing-features/REFERENCE-INDEX.md`

Replace the 300+ line playbook that every agent reads with a minimal trigger table:

```markdown
# Reference Index

| Topic | File | When to Read |
|-------|------|-------------|
| Full workflow protocol | `prompts/implementing-features/README.md` | Team Leader only, Phase 1 |
| Spawn templates | `AGENT-SPAWN-TEMPLATES.md` | Team Leader only, Phase 2 |
| QA checklist | `QA-CHECKLIST-TEMPLATE.md` | QA agent, Phase 0 |
| QA auto-fill rules | `QA-CHECKLIST-AUTO-FILL-RULES.md` | Team Leader, when building checklists |
| Context budget | `CONTEXT-BUDGET-GUIDE.md` | Team Leader, before spawning |
| Workflow modes | `WORKFLOW-MODES.md` | Team Leader, Phase 1 |
| Progress template | `PROGRESS-FILE-TEMPLATE.md` | Team Leader, when creating progress |
| Wave fence protocol | `WAVE-FENCE-PROTOCOL.md` | Team Leader, between waves |
```

**Coding agents only read**: project rules + their agent definition. Everything else comes pre-digested in the spawn prompt or via trigger-table lookup if specifically needed.

---

### T2.3 — Heartbeat Timeout + Task Reclamation

**Files**: `agents/team-leader.md`

Add to the team leader's monitoring protocol:

```markdown
### Agent Health Monitoring

- If a teammate has been idle for >5 minutes with a task `in_progress`:
  1. Send a health-check message: "Status update on Task #N?"
  2. Wait 2 minutes for response
  3. If no response: mark the task as `pending` (reclaim it)
  4. Another teammate will pick it up via self-claim
  5. Note the timeout in the progress file

- If a teammate reports the same error 3+ times:
  1. Trigger circuit breaker — reassign task to a different teammate
  2. Include the error context in the new assignment
```

---

### T2.4 — Identity Consolidation

**Files**: `agents/team-leader.md`, `agents/qa-reviewer.md`, `agents/codebase-guardian.md`

Tighten the identity sections. Current pattern repeats the same information in:
- Frontmatter `description`
- `> blockquote` description
- `<agent-identity>` section

Consolidate to a single identity block and remove redundant descriptions. Expected savings: ~500 tokens per agent definition.

---

### T3.1 — Extended Thinking Budget Management

**Files**: `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md`, `agents/team-leader.md`

Add thinking budget guidance to the context budget table:

| Task Complexity | Thinking Budget | Model |
|----------------|----------------|-------|
| Mechanical (schema, types) | 8,000 tokens | Sonnet |
| Standard (service, handler) | 16,000 tokens | Sonnet |
| Complex (architecture, refactor) | 32,000 tokens | Sonnet/Opus |
| QA review | 8,000 tokens | Haiku |

Implementation: Currently no direct API to set thinking budget per-agent in Claude Code. This is a **future optimization** — when the capability becomes available, the team leader would set it per spawn.

---

### T3.2 — Persistent QA Memory

**Files**: `agents/qa-reviewer.md`

Add a learning loop to QA:
```markdown
### QA Pattern Memory

Before starting a review, check if `.claude/progress/qa-patterns.md` exists.
If it does, read it for recurring issue patterns from past reviews.

After each QA report (PASS or FAIL), append to `qa-patterns.md`:
- Feature: <name>
- Task: <task-name>
- Verdict: PASS/FAIL
- Issues (if FAIL): <categories>
- Pattern: <what was wrong and why>

Over time, this file helps QA agents catch recurring issues faster.
```

---

### T3.3 — Specialized Agent Definitions (Optional)

If the project grows beyond 3 agent types, create per-domain agents:

```
agents/
  team-leader.md        (existing — Opus)
  qa-reviewer.md        (existing — Haiku)
  codebase-guardian.md   (existing — Sonnet)
  schema-designer.md     (new — Sonnet, types/schemas only)
  service-engineer.md    (new — Sonnet, business logic)
  component-engineer.md  (new — Sonnet, UI components)
  api-engineer.md        (new — Sonnet, routes/handlers)
```

Each would have tailored Phase 0 reads, file scope restrictions, and QA checklist pre-selections. **Only implement if task decomposition consistently uses the same 4-5 roles across features.**

---

## Task Decomposition

| # | Task | Files | Wave | Depends On |
|---|------|-------|------|------------|
| 1 | Add model routing to spawn templates | `AGENT-SPAWN-TEMPLATES.md` | 1 | none |
| 2 | Restructure spawn templates (cache-friendly layout + pre-digested rules + background) | `AGENT-SPAWN-TEMPLATES.md` | 1 | with #1 |
| 3 | Update team-leader: self-claim model + heartbeat + pre-digest protocol | `agents/team-leader.md` | 1 | none |
| 4 | Update new-feature command for self-claim flow | `commands/new-feature.md` | 2 | #3 |
| 5 | Create reference index (trigger-table) | `prompts/implementing-features/REFERENCE-INDEX.md` | 1 | none |
| 6 | Update QA reviewer: identity consolidation + mandatory tracking + Haiku note | `agents/qa-reviewer.md` | 1 | none |
| 7 | Update guardian: identity consolidation + Sonnet note | `agents/codebase-guardian.md` | 1 | none |
| 8 | Update context budget guide with model routing costs | `CONTEXT-BUDGET-GUIDE.md` | 2 | #1 |
| 9 | Sync .claude/ copies with root copies | all `.claude/` mirrors | 3 | #1-8 |

---

## Open Questions

1. **Self-claim vs wave-orchestrated**: Self-claim is more efficient but harder to debug. Should we support both modes (config toggle)?
2. **Haiku for QA**: Haiku is much cheaper but may miss subtle code issues. Should we default to Sonnet for strict mode QA?
3. **Background agents**: Background agents can't use MCP tools. Any MCP server usage in the plugin that would break?
4. **Pre-digested rules risk**: If the team leader misses a rule in pre-digestion, the agent won't know about it. Acceptable trade-off?

---

## Sources

- [Agent Teams — Anthropic Official](https://code.claude.com/docs/en/agent-teams)
- [Subagents — Anthropic Official](https://code.claude.com/docs/en/sub-agents)
- [Context Engineering — Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [54% Context Reduction — John Lindquist](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a)
- [Swarm Orchestration Skill — kieranklaassen](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [Agent Team Analysis — alexop.dev](https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/)
- [Sub-Agent Best Practices — claudefa.st](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
