---
name: using-workflow
description: Use when starting any conversation in a project with claude-workflow installed — establishes workflow commands, agent roles, and project configuration
---

# claude-workflow

Multi-agent workflow orchestration for Claude Code. Provides branch-per-task feature development with automated QA, codebase guardian enforcement, and crash recovery.

## Commands

| Command | Description |
|---------|-------------|
| /implement-feature | Full multi-agent feature implementation with branch management, QA, and Guardian |
| /create-feature-plan | Deep technical planning and task decomposition before implementation |
| /resume-feature | Crash recovery — resume from last checkpoint |
| /claude-new | Unified creation entry: feature, plan, task, agent, or idea |
| /status | Quick progress summary of active feature |
| /hotfix | Single-agent urgent fix |
| /refactor | Safe restructuring with baseline verification |
| /review-pr | QA + Guardian review on a pull request |
| /generate-tests | Automated test generation with QA verification |
| /scaffold-agent | Interactive agent definition creator |
| /audit-agents | Scan and validate agent definitions |
| /discover-agents | Auto-discover optimal agent roles for a codebase |

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
- `progressDir` — directory for progress tracking files (default: `docs/progress`)

## Prompt Reference Files

Agent prompt files and workflow definitions are available under `${PLUGIN_ROOT}/prompts/implementing-features/`. Agents read these during execution to understand their roles, responsibilities, and the current workflow state.
