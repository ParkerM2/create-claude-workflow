# create-claude-workflow

Multi-agent workflow orchestration for Claude Code -- branch-per-task development with automated QA, codebase guardian, and crash recovery.

## Installation

### Via Marketplace (Recommended)

```bash
# Add the marketplace
/plugin marketplace add ParkerM2/claude-workflow-marketplace

# Install the plugin
/plugin install claude-workflow@claude-workflow-marketplace
```

### Manual

```bash
# Clone the repository
git clone https://github.com/ParkerM2/create-claude-workflow.git

# Add as a local plugin
/plugin add ./create-claude-workflow
```

## Quick Start

1. Open any project in Claude Code
2. Run `/workflow-setup` to configure project paths (project rules file, architecture file, progress directory)
3. Run `/implement-feature "Add user authentication"`
4. The plugin handles: planning, branching, agent spawning, QA, merge, and cleanup

## Commands

| Command | Description |
|---------|-------------|
| `/implement-feature` | Full multi-agent feature implementation with branch-per-task isolation, QA cycles, and Codebase Guardian verification |
| `/create-feature-plan` | Deep technical planning -- analyzes codebase, designs architecture, decomposes into agent-ready tasks with wave ordering |
| `/resume-feature` | Crash recovery -- scans progress files, detects errors and blockers, auto-resumes or presents options to user |
| `/claude-new` | Unified creation entry point -- create a feature, plan, task, phase, agent, or idea from a single command |
| `/status` | Quick progress summary -- shows completion percentage, task states, branch status, and active blockers |
| `/hotfix` | Streamlined single-agent urgent fix with automatic QA verification |
| `/refactor` | Safe restructuring with mandatory baseline verification, wave execution, and before/after comparison |
| `/review-pr` | QA reviewer + Codebase Guardian analysis on a pull request, posts combined results as PR comment |
| `/generate-tests` | Automated test generation -- identifies targets, spawns test engineer, QA verifies coverage |
| `/scaffold-agent` | Interactive Q&A to create a new specialist agent definition |
| `/audit-agents` | Scan all agent definitions, validate scopes against project structure, flag issues |
| `/audit-performance` | Audit workflow configuration for performance bottlenecks — file sizes, hook overhead, context budget, progress file growth |
| `/track` | Emit a tracking event to the JSONL progress log — records checkpoints, task state, errors, blockers, and QA results |
| `/discover-agents` | Analyze codebase to auto-discover optimal agent roles and generate definitions |

## Agents

The plugin ships with three built-in agents. Additional agents can be generated with `/discover-agents` or `/scaffold-agent`.

| Agent | Role |
|-------|------|
| **Team Leader** | Orchestrator for multi-agent feature development. Decomposes tasks, manages branches, spawns agents in waves, merges workbranches. Does not write implementation code. |
| **QA Reviewer** | Per-task quality gate. Reviews code changes, runs automated checks, verifies acceptance criteria, and updates documentation on PASS. Maximum 3 rounds per task. |
| **Codebase Guardian** | Final structural integrity check on merged feature branches. Runs 7 checks covering architecture compliance, import health, type safety, test coverage, documentation, and security. |

## Configuration

Per-project configuration is stored in `.claude/workflow.json`. Run `/workflow-setup` to create or update it.

```json
{
  "projectRulesFile": "CLAUDE.md",
  "architectureFile": "docs/ARCHITECTURE.md",
  "progressDir": ".claude/progress"
}
```

| Setting | Default | Purpose |
|---------|---------|---------|
| `projectRulesFile` | `CLAUDE.md` | File containing coding standards and project conventions |
| `architectureFile` | `docs/ARCHITECTURE.md` | File describing project structure and design decisions |
| `progressDir` | `.claude/progress` | Directory for JSONL event logs and rendered progress files |

## Workflow Modes

Three modes control how much ceremony the workflow applies. Set in your project rules file or override per-invocation.

| | Strict (default) | Standard | Fast |
|---|---|---|---|
| Planning gate | Required | Required | Required |
| Pre-flight checks | Yes | No | No |
| QA rounds (max) | 3 | 2 | 1 |
| Codebase Guardian | Yes | Yes (auto-fix trivial) | No |
| Performance logging | Yes | No | No |
| Wave fence | Full verify | Quick verify | No fence |
| Context budget check | Yes | Yes | No |

Override per-invocation: `/implement-feature "Add auth" -- mode: fast`

## How It Works

Every feature is developed on isolated branches with per-task QA:

```
main --> feature/name --> work/name/task-1
                      --> work/name/task-2
                      --> work/name/task-3
```

1. **Plan** -- Team Leader reads the playbook, decomposes the feature into tasks with wave ordering
2. **Branch** -- Creates `feature/name` from `main`, then `work/` branches per task
3. **Execute** -- Agents work in waves; each agent gets its own `work/` branch with scoped files
4. **QA** -- QA Reviewer runs on each `work/` branch. FAIL = agent fixes (up to 3 rounds). PASS = docs updated.
5. **Merge** -- Work branches rebase onto `feature/` and merge `--no-ff`, then delete
6. **Guard** -- Codebase Guardian runs final integrity check on the merged `feature/` branch
7. **PR** -- Feature branch is ready for pull request to `main`

## Enforcement Hooks

Four hooks run automatically to protect against common mistakes:

| Hook | Trigger | Protection |
|------|---------|------------|
| `session-start` | Session start/resume | Loads workflow context and displays active feature status |
| `branch-guard` | Before Bash commands | Prevents git operations on wrong branches |
| `destructive-guard` | Before Bash commands | Blocks destructive operations (`rm -rf`, `git reset --hard`, etc.) |
| `config-guard` | Before Edit/Write | Prevents modification of workflow config files |
| `tracker` | After Edit/Write | Emits file modification events to JSONL progress log |
| `git-tracker` | After Bash | Detects git operations and emits branch events to JSONL progress log |

## Project Structure

```
claude-workflow/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .claude/
│   ├── docs/                    # Plugin documentation
│   │   ├── internal/            # Dev logs, plans
│   │   ├── plans/               # Feature plans, research
│   │   ├── research/            # Audits, references
│   │   └── customize-quick-start/ # User customization guides
│   └── progress/                # JSONL event logs (per-feature)
│       ├── index.md             # Top-level dashboard
│       └── <feature>/
│           ├── events.jsonl     # Append-only event log
│           ├── current.md       # Active task state
│           └── history.md       # Unified timeline
├── commands/                    # 14 slash commands (loaded on /invoke)
│   ├── implement-feature.md
│   ├── create-feature-plan.md
│   ├── resume-feature.md
│   ├── claude-new.md
│   ├── status.md
│   ├── hotfix.md
│   ├── refactor.md
│   ├── review-pr.md
│   ├── generate-tests.md
│   ├── scaffold-agent.md
│   ├── audit-agents.md
│   ├── audit-performance.md
│   ├── discover-agents.md
│   └── track.md
├── agents/                      # Agent definitions (loaded on spawn)
│   ├── team-leader.md
│   ├── qa-reviewer.md
│   └── codebase-guardian.md
├── prompts/                     # Reference docs and templates
│   └── implementing-features/   # Playbook, QA templates, workflow modes
├── hooks/                       # Enforcement hooks
│   ├── hooks.json
│   ├── session-start.js
│   ├── branch-guard.js
│   ├── destructive-guard.js
│   ├── config-guard.js
│   ├── tracker.js
│   └── git-tracker.js
├── skills/                      # Internal skills
│   ├── workflow-setup/
│   └── using-workflow/
└── marketplace/                 # Marketplace distribution metadata
```

## License

MIT
