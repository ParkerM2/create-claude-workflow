---
name: utility-setup
description: >
  Set up utility awareness for a project — installs SessionStart and
  UserPromptSubmit hooks so every session (including agent worktrees)
  automatically discovers available skills and tools. Creates a
  codebase-nav skill template and adds a utility index to the project
  rules file. Can be run standalone or is called from workflow-setup.
  Triggers on: "setup utility awareness", "install utility hooks",
  "set up skill routing", "automate skill discovery".
---

# Utility Setup

Installs three components that make every Claude session — including
spawned agent worktrees — automatically aware of available utilities:

1. **SessionStart hook** — injects a compact utility index at the
   start of every session so agents know what skills and tools exist
   before planning any task. Fires deterministically (not probabilistic).

2. **UserPromptSubmit hook** — keyword-matches each incoming message
   and emits a 1-line skill hint when relevant. Silent otherwise —
   zero noise when no match.

3. **codebase-nav skill** — a project-level growing library of
   pre-built search patterns. Common grep/find tasks become one tool
   call instead of five. Grows automatically as new patterns are
   discovered.

## Instructions

### Step 1: Create hooks directory

```bash
mkdir -p ~/.claude/hooks
```

### Step 2: Write session-bootstrap.sh

Create `~/.claude/hooks/session-bootstrap.sh`:

```bash
#!/bin/bash
# Injected at every session start (including agent worktrees).
# Outputs compact utility index before Claude plans any task.

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

Run: `chmod +x ~/.claude/hooks/session-bootstrap.sh`

### Step 3: Write prompt-utility-hint.sh

Create `~/.claude/hooks/prompt-utility-hint.sh`:

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

Run: `chmod +x ~/.claude/hooks/prompt-utility-hint.sh`

### Step 4: Register hooks in settings.json

Read `~/.claude/settings.json`. Add these entries into the `hooks`
object (create `hooks` if it doesn't exist). Merge — do not overwrite
existing `Stop`, `PreToolUse`, or other entries:

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

### Step 5: Create codebase-nav skill

Create `.claude/skills/codebase-nav/SKILL.md` in the project root
with this starter template. The library section grows over time as
Claude discovers and adds reusable search patterns:

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

### Step 6: Add utility index to project rules file

Detect the project rules file (read from `.claude/workflow.json` if
it exists, otherwise default to `CLAUDE.md`).

Read the file and insert this block before the first `## Core Rules`
or `## Rules` heading. If neither heading exists, append before any
other `##` heading at the top level.

Populate agents and refs dynamically:

- Agents: list `.md` filenames from `.claude/agents/` (exclude
  `README.md`)
- Refs: list filenames from `.claude/refs/` (strip extensions)

```markdown
## Utility Index

Check before writing custom bash/grep/scripts. Invoke via Skill tool.

**Skills:** codebase-nav · github-cli · gstack · review · investigate
  ship · qa · careful · guard

**Agents (.claude/agents/):** {dynamically listed agent names}

**Refs (.claude/refs/):** {dynamically listed ref names}

**Tools:** ~/.claude/tools/atlassian (Jira/Confluence, no MCP needed)
```

### Step 7: Confirm

Tell the user:

- SessionStart and UserPromptSubmit hooks installed at
  `~/.claude/hooks/`
- Hooks registered in `~/.claude/settings.json`
- `codebase-nav` skill template created at
  `.claude/skills/codebase-nav/SKILL.md`
- Utility index added to project rules file
- Active immediately — no reload needed for hooks
- The codebase-nav library is empty to start; it grows as Claude
  discovers repeatable search patterns during normal work
