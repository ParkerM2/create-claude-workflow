# create-claude-workflow

Multi-agent workflow orchestration for Claude Code. Branch-per-task feature development with specialist agents, automated QA gates, stamp-file crash recovery, and Jira/Confluence integration.

## Installation

### Via Marketplace (Recommended)

```bash
# 1. Add the marketplace
/plugin marketplace add ParkerM2/claude-workflow-marketplace

# 2. Install the plugin
/plugin install claude-workflow@ParkerM2-claude-workflow-marketplace
```

Or from the terminal (outside a Claude Code session):

```bash
claude plugin marketplace add ParkerM2/claude-workflow-marketplace
claude plugin install claude-workflow@ParkerM2-claude-workflow-marketplace
```

### Manual (Alternative)

```bash
git clone https://github.com/ParkerM2/create-claude-workflow.git

# From within a Claude Code session
/plugin add ./create-claude-workflow
```

### Updating

```bash
/plugin update claude-workflow@ParkerM2-claude-workflow-marketplace
```

## Quick Start

1. Open any project in Claude Code
2. Run `/setup-workflow` to configure project paths (rules file, architecture file, progress directory)
3. Create a plan with `/new-plan` or write task files manually
4. Run `/agent-team` to execute — branching, agent spawning, QA, merges, and cleanup are handled automatically

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/agent-team` | Execute a pre-planned feature — reads task files, spawns coder + QA agent pairs in parallel waves |
| `/new-plan` | Deep technical planning — analyzes codebase, designs architecture, decomposes into agent-ready tasks with wave ordering |
| `/setup-workflow` | First-time project setup — config, infrastructure, agent discovery, docs, CLAUDE.md |
| `/resume` | Crash recovery — reads stamp files, detects where the run stopped, auto-resumes or presents options |
| `/status` | Quick progress summary — completion percentage, task states, branch status, active blockers |
| `/track` | Emit a tracking event to the JSONL progress log |
| `/deep-research` | Conversational deep research — phased investigation with user checkpoints and multi-layered validation |
| `/settings` | Workflow settings hub — guard permissions, agent audit, performance audit |

### Jira / Atlassian Integration

| Command | Description |
|---------|-------------|
| `/connect-atlassian` | Connect Jira + Confluence — guided API token setup, unlocks all ticket commands |
| `/sprint-tickets` | Full sprint board view — statuses, comments, health metrics, and risk flags |
| `/start-sprint` | Sprint kickoff — fetches Jira tickets, spawns agents, creates wave plan |
| `/start-day` | Morning briefing — yesterday's recap, missed notifications, sprint layout, smart prioritization |
| `/start-pairing` | Structured pair programming session with knowledge transfer protocol |
| `/critical-path` | Analyze sprint dependency graph and identify the critical path |
| `/find-blockers` | Detect stalled and blocked tickets with escalation paths |
| `/alert-to-ticket` | Convert monitoring alerts to Jira tickets with context and severity |
| `/assign-reviewers` | Smart code review assignment with expertise mapping and load balancing |
| `/extract-context` | Capture ticket knowledge and technical context before it's lost |
| `/link-ticket` | Auto-sync PR ↔ Jira ticket status with branch pattern detection |
| `/retro-prep` | Auto-gather sprint metrics and prepare data-driven retrospective data |

### Code Quality & Analysis

| Command | Description |
|---------|-------------|
| `/audit-dependencies` | CVE scanning, dependency health check, and auto-ticket creation |
| `/analyze-coverage` | Test coverage analysis with gap detection and trend tracking |
| `/generate-changelog` | Generate user-facing changelog from merged PRs and commits |
| `/incident-postmortem` | Blameless postmortem generation with root cause analysis |

## Agents

Three built-in agents ship with the plugin. Additional agents can be defined in `.claude/agents/`.

| Agent | Role |
|-------|------|
| **Team Leader** | Orchestrator. Manages branch lifecycle, spawns agents in waves, merges workbranches. Never writes implementation code. |
| **QA Reviewer** | Per-task quality gate. Reviews code changes, runs automated checks, verifies acceptance criteria, updates docs on PASS. Max 3 rounds per task. |
| **Codebase Guardian** | Final structural integrity check on the merged feature branch. Runs 7 checks: architecture compliance, import health, type safety, test coverage, documentation, security. |

## Skills

`/agent-team` is implemented as a 6-step checklist of focused skills. Each step writes a stamp file — the next step won't run until its prerequisite stamp exists, making step-skipping structurally impossible.

| Skill | Step | Purpose |
|-------|------|---------|
| `wf-preflight` | 1 | Verify infrastructure, git state, config, and task files |
| `wf-plan` | 2 | Parse task files, validate structure (no overlaps/cycles), build wave plan |
| `wf-setup` | 3 | TeamCreate, inject runtime values into task files, create worktrees, inject CLAUDE.md per worktree |
| `wf-spawn` | 4a | Spawn coder + QA agent pairs for the current wave in a single parallel message |
| `wf-qa-gate` | 4b | Wait for verdicts, run QA cycles (up to 3 rounds), merge passing tasks, wave fence |
| `wf-guardian` | 5 | Spawn Codebase Guardian on the feature branch, handle verdict with up to 3 fix rounds |
| `wf-finalize` | 6 | Shut down agents, clean worktrees, push branch, create PR, TeamDelete, session.end |
| `workflow-setup` | — | Interactive first-time workflow configuration |
| `utility-setup` | — | Add utility awareness (skill hints, codebase-nav) to projects with existing `workflow.json` |
| `using-workflow` | — | Session start context injection — workflow state, branching config, active feature |

Stamp files are written to `.claude/.workflow-state/` and survive context compaction, enabling clean crash recovery without re-running completed steps.

## Configuration

Per-project configuration is stored in `.claude/workflow.json`. Run `/setup-workflow` to create or update it.

```json
{
  "projectRulesFile": "CLAUDE.md",
  "architectureFile": "docs/ARCHITECTURE.md",
  "progressDir": ".claude/progress",
  "branching": {
    "baseBranch": "auto",
    "featurePrefix": "feature",
    "workPrefix": "work",
    "enforce": "warn",
    "protectedBranches": ["main", "master"],
    "useWorktrees": true,
    "worktreeDir": ".worktrees"
  },
  "guards": {
    "branchGuard": true,
    "destructiveGuard": true,
    "configGuard": true
  }
}
```

| Setting | Default | Purpose |
|---------|---------|---------|
| `projectRulesFile` | `CLAUDE.md` | File containing coding standards and project conventions |
| `architectureFile` | `docs/ARCHITECTURE.md` | File describing project structure and design decisions |
| `progressDir` | `.claude/progress` | Directory for JSONL event logs and rendered progress files |
| `branching.baseBranch` | `auto` | Base branch (`auto` detects `main` or `master`) |
| `branching.featurePrefix` | `feature` | Prefix for feature branches (e.g., `feature/my-feature`) |
| `branching.workPrefix` | `work` | Prefix for task branches (e.g., `work/my-feature/task-1`) |
| `branching.enforce` | `warn` | Branch protection: `warn`, `block`, or `off` |
| `branching.protectedBranches` | `["main", "master"]` | Branches protected from direct commits |
| `branching.useWorktrees` | `true` | Use git worktrees for agent isolation |
| `branching.worktreeDir` | `.worktrees` | Directory for worktree checkouts |
| `guards.branchGuard` | `true` | Enable/disable branch protection hook |
| `guards.destructiveGuard` | `true` | Enable/disable destructive command blocking |
| `guards.configGuard` | `true` | Enable/disable workflow file protection |

## Workflow Modes

| | Strict (default) | Standard | Fast |
|---|---|---|---|
| Planning gate | Required | Required | Required |
| Pre-flight checks | Yes | No | No |
| QA rounds (max) | 3 | 2 | 1 |
| Codebase Guardian | Yes | Yes (auto-fix trivial) | No |
| Wave fence | Full verify | Quick verify | No fence |

Override per-invocation: `/agent-team -- mode: fast`

## How It Works

Every feature runs on an isolated branch. Agents get their own git worktrees for true parallel execution:

```
<base-branch>
  └── feature/<name>                          ← team-leader branch
       ├── .worktrees/<name>/task-1/          ← agent 1 (isolated)
       ├── .worktrees/<name>/task-2/          ← agent 2 (parallel)
       └── .worktrees/<name>/task-3/          ← agent 3 (parallel)
```

1. **Preflight** — Verify git state, config, and task file structure
2. **Plan** — Parse tasks, validate no overlaps or cycles, build wave order
3. **Setup** — Create team, inject runtime values, provision worktrees with CLAUDE.md per agent
4. **Execute** — Spawn coder + QA pairs per wave; agents in the same wave work truly in parallel
5. **Merge** — QA-passing tasks rebase onto `feature/` with `--no-ff`; worktrees are cleaned up
6. **Guardian** — Final structural integrity check on the merged feature branch
7. **Finalize** — Push branch, create PR, TeamDelete, emit `session.end`

Progress is tracked in JSONL event logs under `.claude/progress/<feature>/`. Each `/agent-team` step writes a stamp file to `.claude/.workflow-state/` — stamps survive context compaction and enable crash recovery without re-running completed steps.

## Enforcement Hooks

| Hook | Trigger | Protection |
|------|---------|------------|
| `session-start` | Session start/resume/compact | Loads workflow context, branching config, and active feature status |
| `compact-reinject` | After context compaction | Re-injects Phase Gate Protocol and workflow state |
| `safety-guard` | Before Bash commands | Blocks destructive shell operations and unauthorized branch changes |
| `workflow-enforcer` | Before Bash/Edit/Write/TaskStop | Enforces workflow phase rules and task lifecycle |
| `init-gate` | Before TeamCreate/Agent | Blocks agent spawning before prerequisite setup completes |
| `config-guard` | Before Edit/Write | Prevents modification of workflow config files |
| `tracking-emitter` | After tool use / TeammateIdle / TaskCompleted / Stop | Emits JSONL tracking events |
| `teammate-quality` | TeammateIdle | Runs quality checks on teammate output |
| `task-validator` | TaskCompleted | Validates task output meets acceptance criteria |
| `proof-ledger` | After tool use | Records proof-of-work entries for audit trail |

## Project Structure

```
create-claude-workflow/
├── .claude-plugin/
│   └── plugin.json
├── commands/                    # 24 slash commands
│   ├── agent-team.md
│   ├── new-plan.md
│   ├── setup-workflow.md
│   ├── connect-atlassian.md
│   ├── deep-research.md
│   ├── resume.md
│   ├── settings.md
│   ├── status.md
│   ├── track.md
│   ├── sprint-tickets.md
│   ├── start-sprint.md
│   ├── start-day.md
│   ├── start-pairing.md
│   ├── critical-path.md
│   ├── find-blockers.md
│   ├── alert-to-ticket.md
│   ├── assign-reviewers.md
│   ├── extract-context.md
│   ├── link-ticket.md
│   ├── retro-prep.md
│   ├── audit-dependencies.md
│   ├── analyze-coverage.md
│   ├── generate-changelog.md
│   └── incident-postmortem.md
├── agents/
│   ├── team-leader.md
│   ├── qa-reviewer.md
│   └── codebase-guardian.md
├── skills/                      # 10 skills (wf-* steps implement /agent-team)
│   ├── wf-preflight/
│   ├── wf-plan/
│   ├── wf-setup/
│   ├── wf-spawn/
│   ├── wf-qa-gate/
│   ├── wf-guardian/
│   ├── wf-finalize/
│   ├── workflow-setup/
│   ├── utility-setup/
│   └── using-workflow/
├── hooks/
│   ├── hooks.json
│   ├── session-start.js
│   ├── compact-reinject.js
│   ├── safety-guard.js
│   ├── workflow-enforcer.js
│   ├── init-gate.js
│   ├── config-guard.js
│   ├── tracking-emitter.js
│   ├── teammate-quality.js
│   ├── task-validator.js
│   └── proof-ledger.js
├── prompts/
│   ├── implementing-features/   # Phase gate protocol, wave fence, QA checklists, spawn templates
│   └── settings/
├── marketplace/
├── CHANGELOG.md
└── LICENSE
```

## License

MIT
