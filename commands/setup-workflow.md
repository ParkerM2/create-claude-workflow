---
description: "First-time project setup and ongoing maintenance — config, infrastructure, agent discovery, docs, Atlassian integration, and CLAUDE.md generation"
---

# /setup-workflow — Project Bootstrap Checklist

Comprehensive setup and maintenance for claude-workflow. Idempotent — safe to run multiple times. Each phase references its detailed flow rather than inlining it.

---

## Phase 1: INVENTORY

> Detect what exists before touching anything.

- [ ] **Git repo**: `git rev-parse --git-dir` (halt if not a repo). Store `REPO_ROOT`, detect `PRIMARY_BRANCH`.
- [ ] **Config**: Read `.claude/workflow.json` → classify: EXISTS / MISSING / MALFORMED
- [ ] **Directories**: Check `.claude/progress/`, `.claude/tracking/`, `.claude/agents/`, `.claude/docs/`, `.worktrees/`
- [ ] **Docs**: Check `CLAUDE.md` (projectRulesFile) and architecture file existence
- [ ] **Agent sync**: Compare plugin `agents/*.md` vs `.claude/agents/*.md` — note missing/outdated
- [ ] **Hooks**: Verify all hook files exist at `<plugin-root>/hooks/` (active: `config.js`, `tracker.js`, `ticket.js`, `workflow-enforcer.js`, `init-gate.js`, `safety-guard.js`, `hooks.json`, `tracking-emitter.js`, `proof-ledger.js`, `teammate-quality.js`, `task-validator.js`, `session-start.js`, `compact-reinject.js`)
- [ ] **Prompts**: Verify all 17 files in `prompts/implementing-features/` exist (including `AGENT-WORKFLOW-PHASES.md`, `THIN-SPAWN-TEMPLATE.md`)
- [ ] **Agent Teams**: Check `~/.claude/settings.json` for `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- [ ] **Atlassian**: Check `~/.claude/settings.json` for `mcpServers.mcp-atlassian`
- [ ] **Display gap report** to user — show EXISTS/MISSING for each item

---

## Phase 2: CONFIGURE

> Create or update `.claude/workflow.json`. Follows the interactive flow from `skills/workflow-setup/SKILL.md`.

- [ ] If config exists and is valid → display current values, ask "Update?" (skip if no)
- [ ] If missing/malformed → run the 8-question interactive setup:
  1. Project rules file (default: `CLAUDE.md`)
  2. Architecture file (default: `.claude/docs/ARCHITECTURE.md`)
  3. Progress directory (default: `.claude/progress`)
  4. Branching strategy (Standard / Flat / Custom)
  5. Base branch (default: `auto`)
  6. Agent isolation (Worktrees / Shared)
  7. Branch enforcement (warn / block / off)
  8. Protected branches (default: `main, master`)
- [ ] Write `.claude/workflow.json` with `branching` + `guards` sections per `hooks/config.js` defaults

---

## Phase 3: SCAFFOLD

> Create missing infrastructure. Only fills gaps — idempotent.

- [ ] **Directories**: `mkdir -p .claude/progress .claude/tracking .claude/agents .claude/docs` + worktree dir if enabled
- [ ] **Agent sync**: Copy missing core agents from plugin `agents/` → `.claude/agents/` (team-leader, qa-reviewer, codebase-guardian). If outdated → ask user: Update / Keep
- [ ] **.gitignore**: Check for `.worktrees/`, `.claude/tracking/`, `.claude/.workflow-active` entries → offer to add
- [ ] **Agent Teams**: Enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json` (merge, don't overwrite). Inform user a restart may be needed.
- [ ] **Atlassian**: Ask "Connect Jira + Confluence?" → If yes, run `/connect-atlassian` (see `commands/connect-atlassian.md`)

---

## Phase 4: DISCOVER

> Scan codebase for technologies, recommend specialist agents, search skills.sh.

- [ ] Ask user: "Spawn research agents to find and create missing agents/skills?" → Yes / Skip
- [ ] If yes → **Spawn 3 parallel haiku scanner agents** (frontend, backend, infra) — read-only codebase scan
- [ ] **Merge findings** → map to agent roles using tech detection table (see `.claude/docs/internal/PLAN.md` lines 146-169)
- [ ] **Subtract** agents already in `.claude/agents/`
- [ ] **Present** detection results → `AskUserQuestion` with multiSelect for which agents to generate
- [ ] **Generate** selected agent definitions per agent anatomy (see `.claude/docs/customize-quick-start/CREATING-AGENTS.md`). Key: agents reference `AGENT-WORKFLOW-PHASES.md` for phased workflow, not inline phases.
- [ ] **Skills.sh**: Use known mappings (see table below) + `WebSearch` for unmapped technologies → offer `npx skills add <pack>`

### Tech Detection → Agent Role → Skills.sh Mapping

| Detection | Agent Role | Skills Package |
|-----------|-----------|----------------|
| React/Next/Vue/Svelte | component-engineer | vercel-labs/agent-skills |
| React Native/Expo | mobile-engineer | vercel-labs/agent-skills |
| CSS/Tailwind/styled | styling-engineer | anthropics/skills |
| Express/Fastify/NestJS/Django | api-engineer | — |
| Prisma/Drizzle/TypeORM | database-engineer | — |
| Redux/Zustand/Jotai | state-engineer | — |
| Electron/Tauri | desktop-engineer | — |
| WebSocket/Socket.io | realtime-engineer | — |
| tRPC/GraphQL | api-schema-engineer | — |
| Auth libs | auth-engineer | — |
| Jest/Vitest/pytest | test-engineer | anthropics/skills |
| Playwright/Cypress | e2e-test-engineer | anthropics/skills |
| Docker | devops-engineer | — |
| Terraform/Pulumi/CDK | infra-engineer | — |
| GitHub Actions | ci-cd-engineer | — |

---

## Phase 5: DOCUMENT

> Generate architecture doc for agents to read at init.

- [ ] If architecture file exists → ask "Update with current codebase state?" (skip if no)
- [ ] Scan project structure: top-level dirs, source dirs, key config files
- [ ] Generate `.claude/docs/ARCHITECTURE.md` (~100-200 lines):
  - Project Overview, Directory Structure, Key Technologies
  - Module Boundaries, Workflow Infrastructure (sentinel, tickets, hooks)
  - Agent Ownership Map, Conventions

---

## Phase 6: CLAUDE.MD

> Generate lean table-of-contents for session-start context.

- [ ] If CLAUDE.md exists → ask "Merge workflow references / Regenerate / Skip?"
- [ ] Generate concise pointer index (NOT full docs):
  - Project Structure table, Key Files
  - Workflow Commands table (`/team-go` as primary, `/setup-workflow`, `/new-plan`, etc.)
  - Available Agents table (all from `.claude/agents/`)
  - Workflow Modes (strict/standard/fast — one line each)
  - Branching Model (ticket-based ES-{N})
  - Integrations (Atlassian status if configured)
  - 2-5 detected conventions
- [ ] Save to configured `projectRulesFile` path (default: `CLAUDE.md`)

---

## Phase 7: VERIFY & REPORT

> Final health check and summary.

- [ ] Validate config: `node -e "require('<plugin-root>/hooks/config.js').getWorkflowConfig()"`
- [ ] Validate ticket module: `node -e "require('<plugin-root>/hooks/ticket.js')"`
- [ ] Verify all configured paths exist (projectRulesFile, architectureFile, progressDir)
- [ ] Verify core agents in `.claude/agents/`
- [ ] Verify Agent Teams enabled
- [ ] Verify no stale sentinel (`.claude/.workflow-active` should NOT exist)
- [ ] If Atlassian configured: verify `mcp-atlassian` in `~/.claude/settings.json`
- [ ] **Display setup report**: config, infrastructure, agents, integrations, next steps

### Setup Report Template

```
## Setup Complete

| Setting | Value |
|---------|-------|
| Project rules | <path> |
| Architecture | <path> |
| Branching | <strategy> |
| Agent Teams | Enabled |
| Atlassian | Connected / Not configured |

Infrastructure: <count> directories, <count> agents, docs generated
Next: /new-plan → /team-go
```

---

## Referenced Files

| Phase | Reference | Purpose |
|-------|-----------|---------|
| Phase 2 | `skills/workflow-setup/SKILL.md` | Config question flow |
| Phase 3 | `commands/connect-atlassian.md` | Full Atlassian setup flow |
| Phase 3 | `hooks/config.js` | `BRANCHING_DEFAULTS`, `GUARDS_DEFAULTS` |
| Phase 4 | `.claude/docs/internal/PLAN.md` | Tech → agent role mapping table |
| Phase 4 | `.claude/docs/customize-quick-start/CREATING-AGENTS.md` | Agent anatomy template |
| Phase 4 | `prompts/implementing-features/AGENT-WORKFLOW-PHASES.md` | What generated agents reference |
| Phase 5 | Architecture file (configurable) | Agent init-time context |
| Phase 6 | `projectRulesFile` (configurable) | Session-start context |
