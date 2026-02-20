---
name: workflow-setup
description: Use when a workflow command is invoked but no .claude/workflow.json config exists — runs first-time project setup to configure project rules file, architecture file, progress directory paths, and branching strategy
---

# Workflow Setup

First-time project configuration for claude-workflow.

## Instructions

Follow this setup flow:

### 1. Check for existing configuration

Read `.claude/workflow.json` in the current project root. If it exists, display the current configuration to the user and ask what they would like to change. If it does not exist, proceed with first-time setup.

### 2. Ask configuration questions

Use the AskUserQuestion tool to ask the following questions one at a time:

**Question 1: Project rules file**
> Where is your project rules file? This is the file that contains coding standards, conventions, and project-specific instructions.
>
> Default: `CLAUDE.md`

**Question 2: Architecture file**
> Where is your architecture documentation? This file describes your project structure, key abstractions, and design decisions.
>
> Default: `docs/ARCHITECTURE.md`

**Question 3: Progress directory**
> Where should workflow progress files be stored? These track feature implementation state for crash recovery.
>
> Default: `.claude/progress`

**Question 4: Branching strategy**
> How should branches be organized for feature work?
>
> Options:
> - `Standard` (recommended) — `base → feature/<name> → work/<name>/<task>` with worktrees for agent isolation
> - `Flat` — `base → <featurePrefix>/<task>`, agents work on feature branches directly (no work branches)
> - `Custom` — provide your own prefix configuration
>
> Default: `Standard`

**Question 5: Base branch**
> What is your primary/base branch?
>
> Default: `auto` (auto-detects main or master)

**Question 6: Agent isolation**
> How should agents be isolated during parallel work?
>
> Options:
> - `Worktrees` (recommended) — each agent gets an isolated git worktree directory
> - `Shared directory` — all agents share one working directory, switching branches via checkout
>
> Default: `Worktrees`

**Question 7: Branch enforcement**
> How strictly should branch rules be enforced?
>
> Options:
> - `warn` (recommended) — show warnings but allow the operation
> - `block` — prevent commits/pushes on protected branches
> - `off` — no branch checking at all
>
> Default: `warn`

**Question 8: Protected branches**
> Which branches should be protected from direct commits?
>
> Default: `main, master`

Auto-fill the branching section based on the strategy choice:
- Standard: featurePrefix=feature, workPrefix=work, useWorktrees=true
- Flat: featurePrefix=feature, workPrefix=(empty), useWorktrees=false
- Custom: user provides all values

### 3. Write configuration

Create `.claude/workflow.json` with the user's answers:

```json
{
  "projectRulesFile": "<answer or default>",
  "architectureFile": "<answer or default>",
  "progressDir": "<answer or default>",
  "branching": {
    "baseBranch": "<answer or auto>",
    "featurePrefix": "<answer or feature>",
    "workPrefix": "<answer or work>",
    "enforce": "<answer or warn>",
    "protectedBranches": ["<answer or main, master>"],
    "useWorktrees": <true or false>,
    "worktreeDir": ".worktrees"
  }
}
```

### 4. Create progress directory

If the progress directory does not exist, create it. Add an empty `.gitkeep` file inside it so the directory is tracked by git.

### 5. Confirm completion

Tell the user:
- Configuration saved to `.claude/workflow.json`
- Progress directory created at `<progressDir>`
- They can re-run `/workflow-setup` at any time to update settings
- They can now use any workflow command (e.g., `/new-feature`)

Change anytime by editing `.claude/workflow.json` or asking Claude to adjust.
