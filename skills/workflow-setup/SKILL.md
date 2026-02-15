---
name: workflow-setup
description: Use when a workflow command is invoked but no .claude/workflow.json config exists — runs first-time project setup to configure project rules file, architecture file, and progress directory paths
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

### 3. Write configuration

Create `.claude/workflow.json` with the user's answers:

```json
{
  "projectRulesFile": "<answer or default>",
  "architectureFile": "<answer or default>",
  "progressDir": "<answer or default>"
}
```

### 4. Create progress directory

If the progress directory does not exist, create it. Add an empty `.gitkeep` file inside it so the directory is tracked by git.

### 5. Confirm completion

Tell the user:
- Configuration saved to `.claude/workflow.json`
- Progress directory created at `<progressDir>`
- They can re-run `/workflow-setup` at any time to update settings
- They can now use any workflow command (e.g., `/implement-feature`)
