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
  "progressDir": ".claude/progress",
  "branching": {
    "baseBranch": "auto",
    "featurePrefix": "feature",
    "workPrefix": "work",
    "enforce": "warn",
    "protectedBranches": ["main", "master"],
    "useWorktrees": true,
    "worktreeDir": ".worktrees"
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
| `branch-guard` | Before Bash commands | Configurable branch protection (`warn`/`block`/`off`), worktree-aware |
| `destructive-guard` | Before Bash commands | Blocks destructive operations (`rm -rf`, `git reset --hard`, etc.) |
| `config-guard` | Before Edit/Write | Prevents modification of workflow config files |
| `tracker` | After Edit/Write | Emits file modification events to JSONL progress log |
| `git-tracker` | After Bash | Detects git and worktree operations, emits events to JSONL progress log |

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
│   ├── config.js               # Shared config reader (repo root, branching)
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
