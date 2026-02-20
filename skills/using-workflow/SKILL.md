---
name: using-workflow
description: Use when starting any conversation in a project with claude-workflow installed — establishes workflow commands, agent roles, and project configuration
---

# claude-workflow

Multi-agent workflow orchestration for Claude Code. Provides branch-per-task feature development with automated QA, codebase guardian enforcement, and crash recovery.

## Commands

| Command | Description |
|---------|-------------|
| /new-feature | Full multi-agent feature implementation with branch management, QA, and Guardian |
| /new-plan | Deep technical planning and task decomposition before implementation |
| /resume | Crash recovery — resume from last checkpoint |
| /new | Unified creation entry: feature, plan, task, agent, or idea |
| /status | Quick progress summary of active feature |
| /new-hotfix | Single-agent urgent fix |
| /new-refactor | Safe restructuring with baseline verification |
| /review-pr | QA + Guardian review on a pull request |
| /new-tests | Automated test generation with QA verification |
| /new agent | Interactive agent definition creator |
| /settings | Scan and validate agent definitions, audit performance, manage permissions |
| /track | Emit tracking events to JSONL progress log |
| /new (discover mode) | Auto-discover optimal agent roles for a codebase |

## Agents

- **team-leader**: Orchestrator agent that decomposes features into tasks, delegates to sub-agents, and manages branch lifecycle. Runs the main workflow loop.
- **qa-reviewer**: Quality gate agent that reviews code changes, runs tests, checks for regressions, and enforces project standards before merge.
- **codebase-guardian**: Structural integrity agent that monitors for unauthorized changes to protected files, architecture violations, and dependency issues.

## Workflow Modes

- **strict**: Full QA pipeline — every task reviewed by qa-reviewer and codebase-guardian before merge. Best for production codebases.
- **standard**: Balanced mode — QA reviews on feature completion, Guardian checks on protected files only. Default mode.
- **fast**: Minimal checks — skip QA reviews, Guardian runs only on final merge. Best for prototyping and spikes.

## Configuration

Project configuration lives in `.claude/workflow.json`. Run `/workflow-setup` to configure interactively.

Configuration options:
- `projectRulesFile` — path to the project rules file (default: `CLAUDE.md`)
- `architectureFile` — path to the architecture documentation (default: `docs/ARCHITECTURE.md`)
- `progressDir` — directory for JSONL event logs and rendered progress (default: `.claude/progress`)

Branching configuration (`branching` section in `.claude/workflow.json`):
- `baseBranch` — primary branch to branch from (default: `auto` — auto-detects main/master)
- `featurePrefix` — prefix for feature branches (default: `feature`)
- `workPrefix` — prefix for agent work branches (default: `work`)
- `enforce` — branch rule enforcement level: `warn`, `block`, or `off` (default: `warn`)
- `protectedBranches` — branches protected from direct commits (default: `["main", "master"]`)
- `useWorktrees` — enable git worktrees for agent isolation (default: `true`)
- `worktreeDir` — directory for worktrees relative to repo root (default: `.worktrees`)

## Agent Isolation with Worktrees

When `branching.useWorktrees` is `true` (default), each agent task gets its own isolated git worktree:

```
<repo-root>/
├── .claude/workflow.json          ← config (always read from main repo root)
├── .claude/progress/              ← progress tracking (always in main repo root)
├── .worktrees/                    ← worktree root (configurable via worktreeDir)
│   └── <feature>/
│       ├── task-1/                ← agent 1's isolated worktree
│       ├── task-2/                ← agent 2's isolated worktree (parallel!)
│       └── task-3/                ← agent 3's isolated worktree
└── (main repo working tree)       ← team-leader works here
```

Each agent receives: `git worktree add <worktreeDir>/<feature>/<task> -b <workPrefix>/<feature>/<task>`
After merge: `git worktree remove <worktreeDir>/<feature>/<task>`

Benefits:
- Agents in the same wave can work truly in parallel — no checkout conflicts
- Each agent has a clean working directory with no interference from others
- The team leader stays on the feature branch in the main repo

When `useWorktrees` is `false`, agents share the main working directory and switch branches via `git checkout`.

## Changing Branch Rules at Runtime

Branch rules are guidelines, not permanent constraints. You can change them anytime:

1. **Edit config directly**: Modify `.claude/workflow.json` branching section
2. **Tell Claude**: Say "allow commits on main" or "turn off branch enforcement" — Claude will update the config
3. **Re-run setup**: Use `/workflow-setup` to reconfigure interactively

## Prompt Reference Files

Agent prompt files and workflow definitions are available under `${PLUGIN_ROOT}/prompts/implementing-features/`. Agents read these during execution to understand their roles, responsibilities, and the current workflow state.
