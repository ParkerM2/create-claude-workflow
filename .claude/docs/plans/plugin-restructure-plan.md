# Plan: Restructure claude-workflow into Plugin System (Option B: Two-Repo)

**Status**: PLAN
**Date**: 2026-02-14
**Research**: See `docs/research/` for detailed findings

---

## Overview

Convert `claude-workflow-skill` (currently an npm scaffolder) into a Claude Code **plugin** distributed via a self-hosted **marketplace**. This eliminates per-project scaffolding — install once, works everywhere.

### Two Repos

| Repo | Purpose | Install Command |
|------|---------|-----------------|
| `claude-workflow` | The plugin (commands, agents, skills, hooks, prompts) | `/plugin install claude-workflow@claude-workflow-marketplace` |
| `claude-workflow-marketplace` | The catalog (lists the plugin + future plugins) | `/plugin marketplace add ParkerM2/claude-workflow-marketplace` |

---

## 1. The Template Variable Problem (Biggest Challenge)

### Current State

30+ files use `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}`. The scaffolder replaces these at install time. Plugins serve files directly — no build step.

### Solution: SessionStart Hook + Config File

**Approach**: A SessionStart hook reads project config and injects it into Claude's system prompt. All template variables are replaced with descriptive references.

**Step 1**: Create `.claude/workflow.json` (per-project config):
```json
{
  "projectRulesFile": "CLAUDE.md",
  "architectureFile": "docs/ARCHITECTURE.md",
  "progressDir": "docs/progress"
}
```

**Step 2**: SessionStart hook reads this file (or uses defaults) and injects:
```
<workflow-config>
The claude-workflow plugin is active. Project configuration:
- Project rules file: CLAUDE.md
- Architecture file: docs/ARCHITECTURE.md
- Progress directory: docs/progress
- Plugin root: C:\Users\...\plugins\cache\...\claude-workflow\1.0.0

When workflow commands or agents reference "the project rules file", "the architecture file",
or "the progress directory", use the paths above.
</workflow-config>
```

**Step 3**: Replace all `{{VARIABLE}}` patterns in template files:
- `{{PROJECT_RULES_FILE}}` → `the project rules file` (or inline `CLAUDE.md` where context makes it clear)
- `{{ARCHITECTURE_FILE}}` → `the architecture file`
- `{{PROGRESS_DIR}}` → `the progress directory`

**Step 4**: For `activity-logger.js` (the only JS file with template vars):
- Read config from `.claude/workflow.json` at runtime
- Fall back to `docs/progress` default
- No more baked-in path

### First-Run Setup

When no `.claude/workflow.json` exists, the first workflow command (e.g., `/implement-feature`) detects this and runs a quick setup:
1. "No workflow config found. Setting up..."
2. Asks 3 questions (rules file, architecture file, progress dir) — or accepts defaults
3. Writes `.claude/workflow.json`
4. Continues with the command

This replaces `npx create-claude-workflow init` entirely.

---

## 2. Plugin Repo Structure (`claude-workflow`)

```
claude-workflow/
  .claude-plugin/
    plugin.json                           # Plugin metadata

  commands/                               # 12 slash commands (user-invocable)
    implement-feature.md
    create-feature-plan.md
    resume-feature.md
    claude-new.md
    status.md
    hotfix.md
    refactor.md
    review-pr.md
    generate-tests.md
    scaffold-agent.md
    audit-agents.md
    discover-agents.md

  agents/                                 # 3 agent definitions (subagents)
    team-leader.md
    qa-reviewer.md
    codebase-guardian.md

  skills/                                 # Skills (invocable by Claude)
    using-workflow/
      SKILL.md                            # Bootstrap skill (loaded at session start)
    workflow-setup/
      SKILL.md                            # First-run project setup

  hooks/                                  # Event hooks
    hooks.json                            # Hook registrations
    session-start.sh                      # Injects workflow config at session start
    session-start.cmd                     # Windows equivalent
    branch-guard.js                       # PreToolUse: protect branches
    destructive-guard.js                  # PreToolUse: block dangerous commands
    config-guard.js                       # PreToolUse: protect .claude/ files
    activity-logger.js                    # PostToolUse: log file edits

  prompts/                                # Reference material (read by agents)
    implementing-features/
      README.md                           # The Playbook
      AGENT-SPAWN-TEMPLATES.md
      QA-CHECKLIST-TEMPLATE.md
      QA-CHECKLIST-AUTO-FILL-RULES.md
      PROGRESS-FILE-TEMPLATE.md
      WORKFLOW-MODES.md
      WAVE-FENCE-PROTOCOL.md
      PRE-FLIGHT-CHECKS.md
      CONTEXT-BUDGET-GUIDE.md
      AGENT-PERFORMANCE-LOG-TEMPLATE.md
      IDEAS-BACKLOG-TEMPLATE.md
    guides/
      CREATING-AGENTS.md
      CUSTOMIZING-THE-WORKFLOW.md

  README.md                               # Plugin documentation
  LICENSE                                 # MIT
  CHANGELOG.md                            # Version history
```

### Path Resolution for Agents

Agents currently reference files like `.claude/prompts/implementing-features/README.md`. In the plugin model, files live at `~/.claude/plugins/cache/.../claude-workflow/X.Y.Z/`.

**Solution**: The SessionStart hook injects `WORKFLOW_PLUGIN_ROOT` into the system prompt. All agent/command file references change from:
```
.claude/prompts/implementing-features/README.md
```
to:
```
${WORKFLOW_PLUGIN_ROOT}/prompts/implementing-features/README.md
```

The hook resolves `${CLAUDE_PLUGIN_ROOT}` at runtime to the actual cache path.

### prompts/ as a Non-Standard Directory

The plugin system auto-discovers `commands/`, `agents/`, `skills/`, `hooks/`. The `prompts/` directory is NOT auto-discovered — but that's fine. These are reference files read by agents via the `Read` tool during execution, not user-invocable components. They just need to exist in the plugin directory and be reachable by path.

---

## 3. Marketplace Repo Structure (`claude-workflow-marketplace`)

```
claude-workflow-marketplace/
  .claude-plugin/
    marketplace.json
  README.md
```

### marketplace.json

```json
{
  "name": "claude-workflow-marketplace",
  "owner": {
    "name": "ParkerM2",
    "email": "contact@example.com"
  },
  "metadata": {
    "description": "Multi-agent workflow orchestration plugins for Claude Code",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "claude-workflow",
      "source": {
        "source": "url",
        "url": "https://github.com/ParkerM2/claude-workflow.git"
      },
      "description": "Multi-agent feature development with branch management, QA cycles, and crash recovery. Includes team orchestration, codebase guardian, and 12 workflow commands.",
      "version": "1.0.0",
      "strict": true
    }
  ]
}
```

---

## 4. plugin.json

```json
{
  "name": "claude-workflow",
  "description": "Multi-agent workflow orchestration for Claude Code — branch-per-task development with automated QA, codebase guardian, and crash recovery",
  "version": "1.0.0",
  "author": {
    "name": "ParkerM2"
  },
  "homepage": "https://github.com/ParkerM2/claude-workflow",
  "repository": "https://github.com/ParkerM2/claude-workflow",
  "license": "MIT",
  "keywords": [
    "workflow",
    "multi-agent",
    "orchestration",
    "qa",
    "feature-development",
    "branch-management",
    "team-leader"
  ]
}
```

---

## 5. Skills Design

### 5.1 `using-workflow` (Bootstrap Skill)

Loaded at session start via hook. Teaches Claude about the workflow plugin's capabilities.

```yaml
---
name: using-workflow
description: Use when starting any conversation in a project with claude-workflow installed - establishes workflow commands, agent roles, and project configuration
---
```

Content: Overview of all 12 commands, 3 agents, workflow modes, and how to get started.

### 5.2 `workflow-setup` (First-Run Setup)

Triggered when no `.claude/workflow.json` exists.

```yaml
---
name: workflow-setup
description: Use when a workflow command is invoked but no .claude/workflow.json config exists - runs first-time project setup
---
```

Content: Interactive setup flow — 3 questions, writes config file, creates progress directory.

---

## 6. hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh",
            "async": true
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/branch-guard.js",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/destructive-guard.js",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/config-guard.js",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/config-guard.js",
            "timeout": 10000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/activity-logger.js",
            "timeout": 10000,
            "async": true
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/activity-logger.js",
            "timeout": 10000,
            "async": true
          }
        ]
      }
    ]
  }
}
```

---

## 7. File-by-File Migration Map

### Commands (12 files)

| Current | Plugin | Changes Needed |
|---------|--------|----------------|
| `templates/commands/implement-feature.md` | `commands/implement-feature.md` | Replace `{{VARS}}` with descriptive refs; update prompt paths to `${WORKFLOW_PLUGIN_ROOT}/...`; add frontmatter `description` |
| `templates/commands/create-feature-plan.md` | `commands/create-feature-plan.md` | Same pattern |
| `templates/commands/resume-feature.md` | `commands/resume-feature.md` | Same pattern |
| `templates/commands/claude-new.md` | `commands/claude-new.md` | Same pattern |
| `templates/commands/status.md` | `commands/status.md` | Same pattern |
| `templates/commands/hotfix.md` | `commands/hotfix.md` | Same pattern |
| `templates/commands/refactor.md` | `commands/refactor.md` | Same pattern |
| `templates/commands/review-pr.md` | `commands/review-pr.md` | Same pattern |
| `templates/commands/generate-tests.md` | `commands/generate-tests.md` | Same pattern |
| `templates/commands/scaffold-agent.md` | `commands/scaffold-agent.md` | Same pattern |
| `templates/commands/audit-agents.md` | `commands/audit-agents.md` | Same pattern |
| `templates/commands/discover-agents.md` | `commands/discover-agents.md` | Same pattern |

**Frontmatter to add** (each command needs):
```yaml
---
description: "Brief description of what this command does"
---
```

### Agents (3 files)

| Current | Plugin | Changes Needed |
|---------|--------|----------------|
| `templates/agents/team-leader.md` | `agents/team-leader.md` | Replace `{{VARS}}`; update prompt paths; add frontmatter `name` + `description` |
| `templates/agents/qa-reviewer.md` | `agents/qa-reviewer.md` | Same pattern |
| `templates/agents/codebase-guardian.md` | `agents/codebase-guardian.md` | Same pattern |

**Frontmatter to add** (each agent needs):
```yaml
---
name: agent-name
description: When and how to use this agent
---
```

### Prompts (11 files)

| Current | Plugin | Changes Needed |
|---------|--------|----------------|
| `templates/prompts/implementing-features/*.md` (11 files) | `prompts/implementing-features/*.md` | Replace `{{VARS}}` with descriptive refs |

These are reference files — no frontmatter needed since they're not auto-discovered.

### Hooks (4 files)

| Current | Plugin | Changes Needed |
|---------|--------|----------------|
| `templates/hooks/branch-guard.js` | `hooks/branch-guard.js` | No changes |
| `templates/hooks/destructive-guard.js` | `hooks/destructive-guard.js` | No changes |
| `templates/hooks/config-guard.js` | `hooks/config-guard.js` | No changes |
| `templates/hooks/activity-logger.js` | `hooks/activity-logger.js` | Replace `{{PROGRESS_DIR}}` with runtime config read |

### Docs (2 files)

| Current | Plugin | Changes Needed |
|---------|--------|----------------|
| `templates/docs/CREATING-AGENTS.md` | `prompts/guides/CREATING-AGENTS.md` | Replace `{{VARS}}` |
| `templates/docs/CUSTOMIZING-THE-WORKFLOW.md` | `prompts/guides/CUSTOMIZING-THE-WORKFLOW.md` | Replace `{{VARS}}` |

### New Files

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin metadata |
| `skills/using-workflow/SKILL.md` | Bootstrap skill |
| `skills/workflow-setup/SKILL.md` | First-run setup skill |
| `hooks/hooks.json` | Hook declarations |
| `hooks/session-start.sh` | SessionStart bootstrap script |
| `hooks/session-start.cmd` | Windows SessionStart script |
| `CHANGELOG.md` | Version history |

### Files NOT Migrated (stay in source repo only)

| File | Reason |
|------|--------|
| `bin/index.js` | Scaffolder entry — replaced by plugin system |
| `lib/*.js` (7 files) | Scaffolder infrastructure — no longer needed |
| `package.json` | npm scaffolder metadata — plugin uses plugin.json |
| `SPEC-v1-trim.md` | Internal planning doc |
| `docs/internal/*.md` | Internal development docs |
| `docs/plans/*.md` | Design documents |
| `docs/research/*.md` | Research notes |
| `docs/BASELINE-TOKEN-REPORT.md` | Token measurement |

---

## 8. Template Variable Replacement Strategy

### Pattern for markdown files

Replace all `{{VAR}}` with readable references. The SessionStart hook ensures Claude knows the actual values.

**Before** (scaffolder model):
```markdown
1. Read `{{PROJECT_RULES_FILE}}` — Project rules and conventions
2. Read `{{ARCHITECTURE_FILE}}` — System architecture
3. Write progress to `{{PROGRESS_DIR}}/<feature>-progress.md`
```

**After** (plugin model):
```markdown
1. Read the project rules file — Project rules and conventions
2. Read the architecture file — System architecture
3. Write progress to the progress directory (`<feature>-progress.md`)
```

Claude knows the actual paths from the SessionStart-injected config block.

### Pattern for activity-logger.js

**Before**:
```javascript
const logDir = '{{PROGRESS_DIR}}';
```

**After**:
```javascript
const fs = require('fs');
const path = require('path');
const configPath = path.join(process.cwd(), '.claude', 'workflow.json');
let logDir = 'docs/progress'; // default
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.progressDir) logDir = config.progressDir;
} catch {}
```

---

## 9. session-start.sh Design

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read project config or use defaults
CONFIG_FILE=".claude/workflow.json"
if [ -f "$CONFIG_FILE" ]; then
  RULES_FILE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')).projectRulesFile || 'CLAUDE.md')")
  ARCH_FILE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')).architectureFile || 'docs/ARCHITECTURE.md')")
  PROGRESS_DIR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')).progressDir || 'docs/progress')")
  CONFIG_STATUS="configured"
else
  RULES_FILE="CLAUDE.md"
  ARCH_FILE="docs/ARCHITECTURE.md"
  PROGRESS_DIR="docs/progress"
  CONFIG_STATUS="using defaults (run /workflow-setup to customize)"
fi

# Read the bootstrap skill
SKILL_CONTENT=$(cat "$PLUGIN_ROOT/skills/using-workflow/SKILL.md" 2>/dev/null || echo "")

# Output JSON for Claude Code
cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<workflow-config>\nclaude-workflow plugin is active ($CONFIG_STATUS).\n\nProject paths:\n- Project rules file: $RULES_FILE\n- Architecture file: $ARCH_FILE\n- Progress directory: $PROGRESS_DIR\n- Plugin root: $PLUGIN_ROOT\n\nWhen workflow commands or agents reference 'the project rules file', 'the architecture file', or 'the progress directory', use the paths above.\n</workflow-config>\n\n$SKILL_CONTENT"
  }
}
ENDJSON
```

---

## 10. Official Marketplace Submission

### Acceptance Criteria Checklist

- [x] Plugin name: `claude-workflow` (kebab-case, unique)
- [ ] `.claude-plugin/plugin.json` with `name`, `description`, `author`
- [ ] All agent `.md` files have frontmatter with `name` + `description`
- [ ] All command `.md` files have frontmatter with `description`
- [ ] All skill `SKILL.md` files have frontmatter with `description`
- [ ] `hooks.json` is valid JSON
- [ ] `${CLAUDE_PLUGIN_ROOT}` used for all hook paths
- [ ] Components at root level (not inside `.claude-plugin/`)
- [ ] README.md with documentation
- [ ] LICENSE file (MIT)
- [ ] Version is semver (`1.0.0`)

### Submission Process

1. Structure plugin per above spec
2. Host on GitHub (`ParkerM2/claude-workflow`)
3. Create marketplace repo (`ParkerM2/claude-workflow-marketplace`)
4. Submit via Google Form: https://docs.google.com/forms/d/e/1FAIpQLSdeFthxvjOXUjxg1i3KrOOkEPDJtn71XC-KjmQlxNP63xYydg/viewform
5. External PRs to `anthropics/claude-plugins-official` are auto-closed — must use the form

---

## 11. Migration for Existing Users

Users who installed via `npx create-claude-workflow init` have files in `.claude/`. The plugin system puts files in `~/.claude/plugins/cache/`.

### Conflict Prevention

- Plugin commands are namespaced: `claude-workflow:implement-feature` (full) or `/implement-feature` (short, if no conflict)
- If a user has both scaffolded files AND the plugin, the scaffolded `.claude/commands/` files take precedence
- Recommend: delete `.claude/commands/`, `.claude/agents/`, `.claude/prompts/` after installing the plugin
- Keep: `.claude/workflow.json`, `.claude/hooks/` (if customized)

### Migration Command

Add a `/migrate-to-plugin` command (or document manual steps):
1. Back up `.claude/` customizations
2. Install plugin via marketplace
3. Create `.claude/workflow.json` from existing variable values
4. Delete scaffolded files that are now served by the plugin
5. Verify commands still work

---

## 12. What Stays in the Source Repo (Not Shipped as Plugin)

The current `claude-workflow-skill` repo becomes the **development monorepo**:

```
claude-workflow-skill/              # Development monorepo
  plugin/                           # Plugin source (this gets published)
    .claude-plugin/
    commands/
    agents/
    skills/
    hooks/
    prompts/
    README.md
    LICENSE
    CHANGELOG.md
  marketplace/                      # Marketplace source (separate repo)
    .claude-plugin/
    README.md
  legacy/                           # Old scaffolder (archived)
    bin/
    lib/
    package.json
  docs/                             # Internal docs
    plans/
    research/
    internal/
  tests/                            # Plugin tests
```

Or alternatively, create the two new repos from scratch and archive this one.

---

## 13. Implementation Phases

### Phase 1: Plugin Skeleton (create repos, basic structure)
1. Create `claude-workflow` repo with `.claude-plugin/plugin.json`
2. Create `claude-workflow-marketplace` repo with `marketplace.json`
3. Add `hooks/hooks.json` and `hooks/session-start.sh`
4. Add `skills/using-workflow/SKILL.md`
5. Verify: `/plugin marketplace add` and `/plugin install` work

### Phase 2: Migrate Commands (12 files)
6. Copy commands, add frontmatter, replace template vars
7. Update all file path references to use plugin-root-relative paths
8. Verify: each `/command` works from a test project

### Phase 3: Migrate Agents + Prompts (3 + 11 + 2 files)
9. Copy agents, add frontmatter, replace template vars
10. Copy prompts, replace template vars
11. Copy doc guides to `prompts/guides/`
12. Verify: agent spawning works, agents can read prompt files

### Phase 4: Migrate Hooks (4 files)
13. Copy hooks, update paths to use `${CLAUDE_PLUGIN_ROOT}`
14. Fix `activity-logger.js` to read config at runtime
15. Verify: hooks fire correctly

### Phase 5: First-Run Setup
16. Create `skills/workflow-setup/SKILL.md`
17. Add setup detection to session-start hook
18. Verify: first run in unconfigured project triggers setup

### Phase 6: Polish + Submit
19. Write README.md
20. Add CHANGELOG.md
21. Tag v1.0.0
22. Submit to official marketplace via Google Form
23. Document migration for existing users

---

## 14. Open Questions

1. **Windows session-start hook**: The `.sh` hook won't run on native Windows. Need a `.cmd` or `.ps1` equivalent, or a Node.js script that works cross-platform.
2. **prompts/ discoverability**: Agents need absolute paths to prompt files. The SessionStart hook injects `PLUGIN_ROOT`, but will Claude reliably use it? May need testing.
3. **Hook scope**: Plugin hooks apply globally to all projects. The branch-guard and config-guard should probably only activate when in a workflow session (check for `.claude/workflow.json`?).
4. **npm scaffolder deprecation**: Keep `npx create-claude-workflow` working but have it print a deprecation notice pointing to plugin install?
