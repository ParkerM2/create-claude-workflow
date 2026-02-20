---
description: "Toggle workflow guard hooks on/off — controls branch guard, destructive guard, and config guard"
---

# /settings — Manage Workflow Guard Settings

> Toggle which tool-use guards are active. Guards are designed for multi-agent workflows — disable them for solo use.

---

## Instructions

You are managing the workflow guard settings. Guards are PreToolUse hooks that block or warn about certain operations. They exist to protect against rogue agents in multi-agent workflows, but can be restrictive during solo use.

### Step 1: Read Current Settings

Read the `.claude/workflow.json` file from the project root. Look for the `guards` section:

```json
{
  "guards": {
    "branchGuard": true,
    "destructiveGuard": true,
    "configGuard": true
  }
}
```

If the `guards` section doesn't exist, all guards default to `true` (enabled).

### Step 2: Present Options

Use `AskUserQuestion` to present a **multi-select checklist** with these options:

**Question**: "Which guards do you want ENABLED? (Unchecked = disabled)"

Options:
1. **Branch Guard** — Warns/blocks git commit and push on protected or feature branches. Agents should only commit on work branches.
   - Currently: `<enabled|disabled>`
2. **Destructive Guard** — Blocks force-push, `rm -rf`, `git reset --hard`, `git clean -fd`, `git branch -D`.
   - Currently: `<enabled|disabled>`
3. **Config Guard** — Blocks editing `.claude/` workflow files (commands, agents, prompts, hooks, settings).
   - Currently: `<enabled|disabled>`
4. **Toggle All** — Enable or disable all guards at once.
   - Currently: `<all enabled|mixed|all disabled>`

### Step 3: Apply Changes

Based on the user's selection:

- If "Toggle All" is selected along with individual guards, "Toggle All" takes priority:
  - If all guards are currently enabled → disable all
  - If any guards are currently disabled → enable all
- Otherwise, apply the individual selections:
  - Selected = enabled (`true`)
  - Not selected = disabled (`false`)

Update the `guards` section in `.claude/workflow.json`. Preserve all other config sections.

If `.claude/workflow.json` doesn't exist, create it with the guards section and default values for other fields:

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

### Step 4: Confirm

Display the updated settings:

```
Guard settings updated:

  Branch Guard:      <ENABLED|DISABLED>
  Destructive Guard: <ENABLED|DISABLED>
  Config Guard:      <ENABLED|DISABLED>

Changes saved to .claude/workflow.json
Guards take effect immediately on the next tool call.
```
