# Superpowers Plugin - Reference Guide

> Comprehensive analysis of the `superpowers` plugin v4.2.0 as a reference implementation
> for the Claude Code plugin system.

---

## 1. Directory Layout

```
superpowers/4.2.0/
  .claude-plugin/
    plugin.json            # Plugin metadata (REQUIRED)
    marketplace.json       # Only present because plugin doubles as marketplace source
  skills/
    <skill-name>/
      SKILL.md             # Main skill file (REQUIRED per skill)
      <supporting-files>   # Optional: .md, .ts, .sh, .js, .dot, etc.
  commands/
    <command-name>.md      # Slash commands (one .md per command)
  agents/
    <agent-name>.md        # Agent definitions (one .md per agent)
  hooks/
    hooks.json             # Hook event registrations
    session-start.sh       # Hook script (referenced from hooks.json)
    run-hook.cmd           # Deprecated polyglot wrapper (kept for reference)
  lib/
    skills-core.js         # Shared JS utility library
  docs/                    # Documentation (README variants, testing docs)
  tests/                   # Test suites
  README.md                # Project README
  RELEASE-NOTES.md         # Changelog
  LICENSE                  # MIT license
```

---

## 2. plugin.json Schema

Location: `.claude-plugin/plugin.json`

```json
{
  "name": "superpowers",                    // string, REQUIRED - package name (lowercase, no spaces)
  "description": "Core skills library...", // string, REQUIRED - human-readable description
  "version": "4.2.0",                      // string, REQUIRED - semver
  "author": {                              // object, REQUIRED
    "name": "Jesse Vincent",               // string
    "email": "jesse@fsck.com"              // string
  },
  "homepage": "https://github.com/obra/superpowers",   // string, optional - project URL
  "repository": "https://github.com/obra/superpowers",  // string, optional - repo URL
  "license": "MIT",                        // string, optional - SPDX identifier
  "keywords": ["skills", "tdd", ...]      // string[], optional - discovery keywords
}
```

**Key observations:**
- No `engines`, `dependencies`, or `peerDependencies` fields
- No `main` or `entry` field - the plugin system discovers content by convention (directories)
- The `name` field must match the name used in marketplace references
- Version follows semver

---

## 3. SKILL.md Frontmatter Schema

Location: `skills/<skill-name>/SKILL.md`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill identifier using kebab-case (letters, numbers, hyphens only) |
| `description` | string | Third-person description starting with "Use when..." - describes ONLY triggering conditions |

### Constraints

- **Total frontmatter max:** 1024 characters
- **Description max:** ~500 characters recommended
- **Name format:** Letters, numbers, hyphens only (no parentheses, special chars)
- **Description format:** Third-person, starts with "Use when..." to describe triggering conditions
- **Description must NOT:** Summarize the skill's process or workflow (causes Claude to shortcut)

### Example

```yaml
---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---
```

### Frontmatter Variations Observed

Most skills use single-line description:
```yaml
---
name: brainstorming
description: "You MUST use this before any creative work - creating features..."
---
```

Some use unquoted strings (no quotes needed unless special YAML characters present):
```yaml
---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---
```

### SKILL.md Body Structure

The recommended structure (from `writing-skills` skill):

```markdown
---
name: skill-name
description: Use when [specific triggering conditions]
---

# Skill Name

## Overview
Core principle in 1-2 sentences.

## When to Use
Bullet list with symptoms and use cases. When NOT to use.
[Optional small inline flowchart IF decision non-obvious]

## Core Pattern (for techniques/patterns)
Before/after code comparison

## Quick Reference
Table or bullets for scanning

## Implementation
Inline code for simple patterns, link to file for heavy reference

## Common Mistakes
What goes wrong + fixes

## Real-World Impact (optional)
Concrete results
```

---

## 4. Command .md Frontmatter Schema

Location: `commands/<command-name>.md`

Commands are user-invocable slash commands (e.g., `/brainstorm`).

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Short description shown in command help |
| `disable-model-invocation` | boolean | No | When `true`, prevents the model from auto-invoking this command |

### Example

```yaml
---
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores requirements and design before implementation."
disable-model-invocation: true
---

Invoke the superpowers:brainstorming skill and follow it exactly as presented to you
```

### Key Observations

- Commands are thin wrappers that delegate to skills
- The body is a simple instruction to invoke the corresponding skill
- `disable-model-invocation: true` is used on all three commands - prevents auto-triggering
- File name (without `.md`) becomes the slash command name: `brainstorm.md` -> `/brainstorm`
- No `name` field in frontmatter - the filename IS the command name

### All Commands in Superpowers

| File | Description | Delegates To |
|------|-------------|--------------|
| `brainstorm.md` | Creative work / feature design | `superpowers:brainstorming` skill |
| `write-plan.md` | Create implementation plan | `superpowers:writing-plans` skill |
| `execute-plan.md` | Execute plan in batches | `superpowers:executing-plans` skill |

---

## 5. Agent .md Frontmatter Schema

Location: `agents/<agent-name>.md`

Agents are subagent definitions that can be dispatched via the Task tool.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Agent identifier |
| `description` | string | Yes | When/how to use this agent (can be multi-line with `\|`) |
| `model` | string | No | Model to use; `"inherit"` uses the current session's model |

### Example

```yaml
---
name: code-reviewer
description: |
  Use this agent when a major project step has been completed and needs to be
  reviewed against the original plan and coding standards. Examples: <example>...
model: inherit
---

You are a Senior Code Reviewer with expertise in software architecture...
```

### Key Observations

- The `description` field is much longer than skill descriptions - includes `<example>` tags with full usage scenarios
- The body is a full system prompt for the subagent
- `model: inherit` means use whatever model the parent session uses
- Only one agent defined in superpowers: `code-reviewer`
- Agent name matches the filename (without `.md`)

---

## 6. hooks.json Structure

Location: `hooks/hooks.json`

```json
{
  "hooks": {
    "<EventType>": [
      {
        "matcher": "<regex-pattern>",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/<script>",
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Event Types Used

| Event | Matcher | Description |
|-------|---------|-------------|
| `SessionStart` | `startup\|resume\|clear\|compact` | Fires when session starts, resumes, or context is cleared/compacted |

### Hook Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"command"` in this implementation |
| `command` | string | Path to script; uses `${CLAUDE_PLUGIN_ROOT}` variable |
| `async` | boolean | When `true`, hook runs asynchronously (non-blocking) |

### Hook Output Format

The hook script must output JSON to stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<content injected into system prompt>"
  }
}
```

For `SessionStart`, the `additionalContext` is injected into the system prompt, effectively bootstrapping the plugin's behavior. Superpowers uses this to inject the `using-superpowers` skill content at session start.

---

## 7. ${CLAUDE_PLUGIN_ROOT} Usage

`${CLAUDE_PLUGIN_ROOT}` is a variable automatically resolved by Claude Code to the plugin's installation directory.

### Where Used

- **hooks.json** - To reference hook scripts:
  ```json
  "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"
  ```

- **Hook scripts** - The `session-start.sh` script also computes its own root:
  ```bash
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
  PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
  ```
  This is a fallback since the script runs as a subprocess and may not have the variable.

### Important Notes

- The variable is resolved at hook registration time, not at runtime
- Scripts should also compute their own root as a fallback
- The resolved path points to the versioned install directory (e.g., `~/.claude/plugins/cache/superpowers-marketplace/superpowers/4.2.0/`)

---

## 8. marketplace.json Structure

There are two marketplace.json locations with different schemas:

### A. Plugin-Local marketplace.json

Location: `<plugin>/.claude-plugin/marketplace.json`

This exists because superpowers' repo doubles as a dev marketplace. It is NOT required for a normal plugin.

```json
{
  "name": "superpowers-dev",
  "description": "Development marketplace for Superpowers core skills library",
  "owner": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com"
  },
  "plugins": [
    {
      "name": "superpowers",
      "description": "Core skills library...",
      "version": "4.2.0",
      "source": "./",
      "author": {
        "name": "Jesse Vincent",
        "email": "jesse@fsck.com"
      }
    }
  ]
}
```

### B. Marketplace Repository marketplace.json

Location: `<marketplace-repo>/.claude-plugin/marketplace.json`

This is the actual marketplace registry that lists available plugins.

```json
{
  "name": "superpowers-marketplace",
  "owner": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com"
  },
  "metadata": {
    "description": "Skills, workflows, and productivity tools",
    "version": "1.0.12"
  },
  "plugins": [
    {
      "name": "superpowers",
      "source": {
        "source": "url",
        "url": "https://github.com/obra/superpowers.git"
      },
      "description": "Core skills library...",
      "version": "4.2.0",
      "strict": true
    }
  ]
}
```

### Plugin Entry Fields (Marketplace)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Plugin identifier |
| `source` | object | Yes | Where to fetch the plugin from |
| `source.source` | string | Yes | Source type: `"url"` |
| `source.url` | string | Yes | Git URL to clone |
| `source.ref` | string | No | Git ref (branch/tag); absent = default branch |
| `description` | string | Yes | Plugin description |
| `version` | string | Yes | Semver version |
| `strict` | boolean | No | When `true`, enforce strict mode |

---

## 9. Plugin Metadata Files

### installed_plugins.json

Location: `~/.claude/plugins/installed_plugins.json`

```json
{
  "version": 2,
  "plugins": {
    "<plugin-name>@<marketplace-name>": [
      {
        "scope": "user",
        "installPath": "C:\\Users\\...\\cache\\<marketplace>\\<plugin>\\<version>",
        "version": "4.2.0",
        "installedAt": "2026-02-12T06:48:22.327Z",
        "lastUpdated": "2026-02-12T06:48:22.327Z",
        "gitCommitSha": "a98c5dfc..."
      }
    ]
  }
}
```

### known_marketplaces.json

Location: `~/.claude/plugins/known_marketplaces.json`

```json
{
  "<marketplace-name>": {
    "source": {
      "source": "github",
      "repo": "<owner>/<repo>"
    },
    "installLocation": "C:\\Users\\...\\marketplaces\\<marketplace-name>",
    "lastUpdated": "2026-02-12T06:48:16.280Z"
  }
}
```

---

## 10. File Naming Conventions

| Item | Convention | Examples |
|------|-----------|----------|
| Skill directories | kebab-case | `test-driven-development`, `using-git-worktrees` |
| Skill main file | Always `SKILL.md` (uppercase) | `skills/brainstorming/SKILL.md` |
| Command files | kebab-case `.md` | `brainstorm.md`, `write-plan.md` |
| Agent files | kebab-case `.md` | `code-reviewer.md` |
| Hook scripts | kebab-case | `session-start.sh`, `hooks.json` |
| Supporting files | kebab-case, descriptive | `testing-anti-patterns.md`, `condition-based-waiting-example.ts` |

### Naming Principles (from `writing-skills`)

- Use active voice, verb-first: `creating-skills` not `skill-creation`
- Gerunds (-ing) work well for processes: `brainstorming`, `writing-plans`
- Name by what you DO or core insight: `condition-based-waiting` not `async-test-helpers`

---

## 11. Skill Supporting Files

Skills can include supplementary files alongside SKILL.md. Observed patterns:

| Skill | Supporting Files | Purpose |
|-------|-----------------|---------|
| `systematic-debugging/` | `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `condition-based-waiting-example.ts`, `find-polluter.sh` | Technique references, examples, tools |
| `systematic-debugging/` | `CREATION-LOG.md`, `test-*.md` | Creation log, test scenarios |
| `test-driven-development/` | `testing-anti-patterns.md` | Reference guide |
| `subagent-driven-development/` | `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md` | Subagent prompt templates |
| `requesting-code-review/` | `code-reviewer.md` | Code review template |
| `writing-skills/` | `anthropic-best-practices.md`, `testing-skills-with-subagents.md`, `persuasion-principles.md`, `graphviz-conventions.dot`, `render-graphs.js`, `examples/` | Reference docs, tools, examples |

### Guidelines for Supporting Files

From the `writing-skills` skill:
- **Separate files for:** Heavy reference (100+ lines), reusable tools/scripts
- **Keep inline:** Principles, concepts, code patterns (<50 lines)
- All files live in the skill's own directory (flat within that directory, or one level of subdirectory)

---

## 12. Skill Cross-Referencing Pattern

Skills reference each other using the `<plugin-name>:<skill-name>` format:

```markdown
**REQUIRED SUB-SKILL:** Use superpowers:test-driven-development
**REQUIRED BACKGROUND:** You MUST understand superpowers:systematic-debugging
```

### Rules

- Use skill name only with explicit requirement markers
- Do NOT use `@` links (force-loads files, burns context)
- Do NOT use file paths like `skills/testing/test-driven-development`
- Mark clearly whether the reference is REQUIRED or optional

---

## 13. SessionStart Bootstrap Pattern

Superpowers uses a clever bootstrap pattern:

1. `hooks.json` registers a `SessionStart` hook
2. The hook runs `session-start.sh` asynchronously
3. The script reads `using-superpowers/SKILL.md` content
4. It outputs JSON with `additionalContext` containing the full skill text wrapped in `<EXTREMELY_IMPORTANT>` tags
5. This injects the "using-superpowers" skill into the system prompt at session start
6. That skill teaches Claude how to discover and use all other skills

This ensures the agent is immediately aware of the skills system without manual intervention.

---

## 14. Patterns Worth Replicating

### 14.1 Thin Commands Delegating to Skills

Commands are minimal -- just a one-line instruction to invoke a skill. This keeps the command system simple and puts all logic in skills.

### 14.2 SessionStart Hook for Bootstrapping

The hook injects a "getting started" skill at session start, ensuring the agent knows about the plugin's capabilities immediately.

### 14.3 Supporting Files in Skill Directories

Heavy reference material, prompt templates, and tools live alongside the SKILL.md, keeping everything self-contained.

### 14.4 Frontmatter Description as Discovery Mechanism

The `description` field is optimized for Claude's skill discovery -- it describes WHEN to use the skill (triggering conditions) rather than WHAT it does.

### 14.5 Agent as Subagent Template

The `agents/` directory provides full system prompts for specialized subagents, keeping the main skill focused on orchestration.

### 14.6 lib/ for Shared Code

The `lib/skills-core.js` file provides shared utilities (frontmatter parsing, skill resolution, update checking) used across the plugin system.

### 14.7 Plugin Version Tracking

The version in `plugin.json` matches the version in the marketplace listing and `installed_plugins.json`, enabling proper update detection.

---

## 15. Complete Skills Inventory

| # | Skill Name | Type | Description (trigger) |
|---|-----------|------|----------------------|
| 1 | `using-superpowers` | Meta | Starting any conversation -- establishes skill system |
| 2 | `brainstorming` | Process | Before any creative work -- explores requirements |
| 3 | `test-driven-development` | Discipline | Implementing any feature or bugfix |
| 4 | `systematic-debugging` | Discipline | Encountering bugs, test failures, unexpected behavior |
| 5 | `writing-plans` | Process | Have spec/requirements for multi-step task |
| 6 | `executing-plans` | Process | Have written plan to execute in separate session |
| 7 | `subagent-driven-development` | Process | Executing plans with independent tasks in current session |
| 8 | `dispatching-parallel-agents` | Process | 2+ independent tasks without shared state |
| 9 | `using-git-worktrees` | Process | Starting feature work needing isolation |
| 10 | `finishing-a-development-branch` | Process | Implementation complete, deciding integration |
| 11 | `requesting-code-review` | Process | Completing tasks, major features, before merging |
| 12 | `receiving-code-review` | Discipline | Receiving code review feedback |
| 13 | `verification-before-completion` | Discipline | About to claim work is complete |
| 14 | `writing-skills` | Meta | Creating or editing skills |

---

## 16. Key Differences from claude-plugins-official

Based on what is observed in the superpowers plugin vs. the official plugin format:

- Superpowers uses a `marketplace.json` inside `.claude-plugin/` when the plugin repo doubles as a marketplace source
- The `strict` field appears in marketplace plugin entries but not in `plugin.json`
- The `source` field in marketplace entries uses `{"source": "url", "url": "..."}` format (note the nested `source` key)
- No MCP server definitions observed in superpowers (pure skills/commands/agents/hooks plugin)
- The `author` field in `plugin.json` uses `{name, email}` object format

---

*Generated: 2026-02-14*
*Source: superpowers v4.2.0 installed at `C:\Users\Parke\.claude\plugins\cache\superpowers-marketplace\superpowers\4.2.0\`*
