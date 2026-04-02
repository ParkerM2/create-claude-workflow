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

### 5. Set up utility awareness (optional but recommended)

Ask the user:

> Would you like to set up utility awareness? This installs two hooks
> that help every session — including spawned agents — automatically
> discover available skills and tools without manual nudging.
>
> What it does:
> - **SessionStart hook** — injects a compact utility index at the
>   start of every session (including agent worktrees), so agents know
>   what skills and tools exist before planning any task
> - **UserPromptSubmit hook** — keyword-matches each message and
>   emits a 1-line skill hint when relevant (silent otherwise)
> - **codebase-nav skill** — creates a project-level growing library
>   of pre-built search patterns so common grep/find tasks become one
>   tool call instead of five
>
> Recommended for teams using agent-team workflows.
>
> Default: `Yes`

If the user accepts (or presses enter for default):

**5a. Create hooks directory**

```bash
mkdir -p ~/.claude/hooks
```

**5b. Write session-bootstrap.sh**

Create `~/.claude/hooks/session-bootstrap.sh` with this content:

```bash
#!/bin/bash
# Injected at every session start (including agent worktrees).
# Outputs compact utility index so Claude knows what exists before planning.

CWD=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
AGENT_COUNT=$(find "$CWD/.claude/agents" -name "*.md" \
  -not -name "README*" 2>/dev/null | wc -l | tr -d ' ')
HAS_REFS=$([ -d "$CWD/.claude/refs" ] && echo "yes" || echo "no")
HAS_NAV=$([ -f "$CWD/.claude/skills/codebase-nav/SKILL.md" ] \
  && echo "yes" || echo "no")

cat <<EOF
<utility-index>
Available utilities — check BEFORE writing custom bash/grep/scripts.
Rule: if a skill covers your task, invoke it via the Skill tool first.

Global skills: github-cli · gstack · review · investigate · ship · qa
  careful · guard · learn · office-hours · freeze · canary · checkpoint
  document-release · land-and-deploy · retro · design-review · health

Global tools: ~/.claude/tools/atlassian (Jira/Confluence, no MCP)
  ~/.claude/skills/gstack/bin/ — QA/browser CLI tools
EOF

if [ "$HAS_NAV" = "yes" ]; then
  echo "Codebase search: codebase-nav skill — pre-built grep patterns"
fi

if [ "$HAS_REFS" = "yes" ]; then
  REFS=$(ls "$CWD/.claude/refs/"*.xml 2>/dev/null \
    | xargs -I{} basename {} .xml | tr '\n' ' · ' | sed 's/ · $//')
  echo "Refs (.claude/refs/): $REFS"
fi

if [ "$AGENT_COUNT" -gt 0 ] 2>/dev/null; then
  echo "Agents (.claude/agents/): $AGENT_COUNT specialist agents"
fi

cat <<EOF

Project skills (.claude/skills/): check directory for available skills
</utility-index>
EOF
```

Make it executable: `chmod +x ~/.claude/hooks/session-bootstrap.sh`

**5c. Write prompt-utility-hint.sh**

Create `~/.claude/hooks/prompt-utility-hint.sh` with this content:

```bash
#!/bin/bash
# UserPromptSubmit hook — fires once per user message.
# Keyword-matches prompt and emits 1-line skill hint if relevant.
# Silent when nothing matches.

PROMPT=$(python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('prompt', '').lower())
except:
    print('')
" 2>/dev/null)

HINTS=()

if echo "$PROMPT" | grep -qiE \
  '\bpr\b|pull.request|\bmerge\b|\bgh \b|github|create.*pr'; then
    HINTS+=("→ github-cli skill: pre-built gh functions (PRs, CI, issues)")
fi

if echo "$PROMPT" | grep -qiE \
  '\bfind\b|\bwhere\b|\bsearch\b|\bgrep\b|which file|locate|usages'; then
    HINTS+=("→ codebase-nav skill: pre-built search patterns for this repo")
fi

if echo "$PROMPT" | grep -qiE \
  '\btest.*ui\b|\bqa\b|\bbrowser\b|\bscreenshot\b|\bgstack\b'; then
    HINTS+=("→ gstack / qa skill: browser automation + visual testing")
fi

if echo "$PROMPT" | grep -qiE '\bship\b|\bdeploy\b|\bpublish\b'; then
    HINTS+=("→ ship skill: full deploy workflow")
fi

if echo "$PROMPT" | grep -qiE \
  '\bjira\b|\bticket\b|\bES-[0-9]+\b|\bsprint\b'; then
    HINTS+=("→ atlassian skill or ~/.claude/tools/atlassian")
fi

if echo "$PROMPT" | grep -qiE \
  '\bwhy.*broken\b|\bdebug\b|investigate|root.cause'; then
    HINTS+=("→ investigate skill: structured debugging workflow")
fi

if [ ${#HINTS[@]} -gt 0 ]; then
    for hint in "${HINTS[@]}"; do echo "$hint"; done
fi

exit 0
```

Make it executable: `chmod +x ~/.claude/hooks/prompt-utility-hint.sh`

**5d. Add hooks to settings.json**

Read `~/.claude/settings.json`. Add (or merge into) the `hooks` section:

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bash ~/.claude/hooks/session-bootstrap.sh"
      }
    ]
  }
],
"UserPromptSubmit": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bash ~/.claude/hooks/prompt-utility-hint.sh"
      }
    ]
  }
]
```

If a `hooks` key already exists, merge these entries into it. Do not
overwrite existing `Stop`, `PreToolUse`, or other hook entries.

**5e. Create codebase-nav skill template**

Create `.claude/skills/codebase-nav/SKILL.md` with this starter content
(the user will grow this over time):

```markdown
---
name: codebase-nav
description: >
  Pre-built search patterns for this codebase. Invoke before writing
  any custom grep/find/bash. Grows over time — add successful patterns.
  Triggers on: "find", "where is", "search for", "which file", "locate".
allowed-tools:
  - Bash
  - Grep
  - Glob
  - Edit
---

# Codebase Navigation Skill

## Protocol

1. Scan LIBRARY for a matching pattern.
2. If found: substitute params and run immediately.
3. If not found: write search from scratch, run it.
4. After success (new pattern): append to LIBRARY silently with Edit.

## LIBRARY

<!-- Add pre-built search patterns here as you discover them. -->
<!-- Format: #### name, **Params:**, ```bash template```, Example -->

## Adding New Patterns

After a multi-step search resolves to a repeatable pattern, append it
above this section using this format:

#### {kebab-case-name}
**Params:** \`PARAM\`
\`\`\`bash
# command with {PARAM} placeholder
\`\`\`
**Example:** what this finds.

---
```

**5f. Add utility index to project rules file**

Read the project rules file (default: `CLAUDE.md`). Insert this block
before the first `## Core Rules` or `## Rules` heading:

```markdown
## Utility Index

Check before writing custom bash/grep/scripts. Invoke via Skill tool.

**Skills:** codebase-nav · github-cli · gstack · review · investigate
  ship · qa · careful · guard

**Agents (.claude/agents/):** list agent names from the directory

**Refs (.claude/refs/):** list XML filenames from the directory

**Tools:** ~/.claude/tools/atlassian (Jira/Confluence, no MCP needed)
```

Populate agents and refs dynamically by listing the actual files in
those directories. Use glob/find to read the directory contents.

### 6. Confirm completion

Tell the user:

- Configuration saved to `.claude/workflow.json`
- Progress directory created at `<progressDir>`
- If utility awareness was set up: hooks installed and active on next
  `/reload-plugins` or session restart
- They can re-run `/workflow-setup` at any time to update settings
- They can now use any workflow command (e.g., `/new-plan` then
  `/agent-team`)

Change anytime by editing `.claude/workflow.json` or asking Claude
to adjust.
