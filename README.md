# create-claude-workflow

Multi-agent workflow orchestration for Claude Code -- branch-per-task development with automated QA, codebase guardian, and crash recovery.

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
# Clone the repository
git clone https://github.com/ParkerM2/create-claude-workflow.git

# Add as a local plugin (from within a Claude Code session)
/plugin add ./create-claude-workflow
```

### Updating

```bash
# Via marketplace (auto-updates on session start if enabled)
/plugin update claude-workflow@ParkerM2-claude-workflow-marketplace

# Or refresh the whole marketplace
/plugin marketplace update ParkerM2-claude-workflow-marketplace
```

## Quick Start

1. Open any project in Claude Code
2. Run `/workflow-setup` to configure project paths (project rules file, architecture file, progress directory)
3. Run `/new-feature "Add user authentication"`
4. The plugin handles: planning, branching, agent spawning, QA, merge, and cleanup

## Commands

| Command | Description |
|---------|-------------|
| `/new` | Unified creation entry point -- create a feature, plan, task, phase, agent, or idea from a single command |
| `/new-feature` | Full multi-agent feature implementation with branch-per-task isolation, QA cycles, and Codebase Guardian verification |
| `/new-plan` | Deep technical planning -- analyzes codebase, designs architecture, decomposes into agent-ready tasks with wave ordering |
| `/new-hotfix` | Streamlined single-agent urgent fix with automatic QA verification |
| `/new-refactor` | Safe restructuring with mandatory baseline verification, wave execution, and before/after comparison |
| `/new-tests` | Automated test generation -- identifies targets, spawns test engineer, QA verifies coverage |
| `/resume` | Crash recovery -- scans progress files, detects errors and blockers, auto-resumes or presents options to user |
| `/settings` | Workflow settings hub -- guard permissions, agent audit, and performance audit |
| `/review-pr` | QA reviewer + Codebase Guardian analysis on a pull request, posts combined results as PR comment |
| `/status` | Quick progress summary -- shows completion percentage, task states, branch status, and active blockers |
| `/track` | Emit a tracking event to the JSONL progress log -- records checkpoints, task state, errors, blockers, and QA results |

## Agents

The plugin ships with three built-in agents. Additional agents can be generated with `/new agent` or discovered automatically via `/new`.

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
| `branching.baseBranch` | `auto` | Base branch for feature branches (`auto` detects `main` or `master`) |
| `branching.featurePrefix` | `feature` | Prefix for feature branches (e.g., `feature/my-feature`) |
| `branching.workPrefix` | `work` | Prefix for task branches (e.g., `work/my-feature/task-1`) |
| `branching.enforce` | `warn` | Branch protection mode: `warn`, `block`, or `off` |
| `branching.protectedBranches` | `["main", "master"]` | Branches protected from direct commits |
| `branching.useWorktrees` | `true` | Use git worktrees for agent isolation |
| `branching.worktreeDir` | `.worktrees` | Directory for worktree checkouts |
| `guards.branchGuard` | `true` | Enable/disable branch protection hook |
| `guards.destructiveGuard` | `true` | Enable/disable destructive command blocking |
| `guards.configGuard` | `true` | Enable/disable workflow file protection |

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

Override per-invocation: `/new-feature "Add auth" -- mode: fast`

## How It Works

Every feature is developed on isolated branches with per-task QA. Agents work in git worktrees for true parallel isolation:

```
<base-branch>
  └── feature/<name>                          ← team-leader creates this
       ├── .worktrees/<name>/task-1/          ← agent 1 worktree (isolated)
       ├── .worktrees/<name>/task-2/          ← agent 2 worktree (parallel)
       └── .worktrees/<name>/task-3/          ← agent 3 worktree (parallel)
```

1. **Plan** -- Team Leader reads the playbook, decomposes the feature into tasks with wave ordering
2. **Branch** -- Creates `feature/<name>` from the configured base branch
3. **Execute** -- Each agent gets an isolated git worktree; agents in the same wave work truly in parallel
4. **QA** -- QA Reviewer runs in each agent's worktree. FAIL = agent fixes (up to 3 rounds). PASS = docs updated.
5. **Merge** -- Work branches rebase onto `feature/` and merge `--no-ff`, worktrees are cleaned up
6. **Guard** -- Codebase Guardian runs final integrity check on the merged `feature/` branch
7. **PR** -- Feature branch is ready for pull request

Branch prefixes, base branch, enforcement mode, and worktree usage are all configurable via `.claude/workflow.json`.

## Enforcement Hooks

Six hooks run automatically to protect against common mistakes:

| Hook | Trigger | Protection |
|------|---------|------------|
| `session-start` | Session start/resume | Loads workflow context, branching config, and active feature status |
| `safety-guard` | Before Bash commands | Blocks destructive operations (`rm -rf`, `git reset --hard`, etc.) |
| `config-guard` | Before Edit/Write | Prevents modification of workflow config files |

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
├── commands/                    # 11 slash commands (loaded on /invoke)
│   ├── new.md                  # Unified creation entry point
│   ├── new-feature.md          # Full multi-agent implementation
│   ├── new-plan.md             # Deep technical planning
│   ├── new-hotfix.md           # Streamlined urgent fix
│   ├── new-refactor.md         # Safe restructuring
│   ├── new-tests.md            # Automated test generation
│   ├── resume.md               # Crash recovery
│   ├── settings.md             # Guard permissions + audits hub
│   ├── review-pr.md
│   ├── status.md
│   └── track.md
├── agents/                      # Agent definitions (loaded on spawn)
│   ├── team-leader.md
│   ├── qa-reviewer.md
│   └── codebase-guardian.md
├── prompts/                     # Reference docs and templates
│   ├── implementing-features/   # Playbook, QA templates, workflow modes
│   ├── new/                     # Sub-flows for /new (scaffold-agent, discover-agents)
│   └── settings/                # Sub-flows for /settings (guards, audits)
├── hooks/                       # Enforcement hooks
│   ├── hooks.json
│   ├── config.js               # Shared config reader (repo root, branching)
│   ├── session-start.js
│   ├── safety-guard.js          # Combined branch + destructive guard
│   ├── config-guard.js
│   └── tracker.js
├── skills/                      # Internal skills
│   ├── workflow-setup/
│   └── using-workflow/
└── marketplace/                 # Marketplace distribution metadata
```

## License

MIT
