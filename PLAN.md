# Claude Workflow Skill — Distribution Plan

> A Claude Code skill pack + npx scaffolder for orchestrating multi-agent feature development with crash-safe progress tracking, per-task QA verification, and automated documentation maintenance.

---

## What This Is

A reusable workflow system for Claude Code that enables:

- **Team Lead orchestration** — Decompose features into tasks, spawn specialist agents, coordinate waves
- **Crash-safe progress tracking** — Temp files survive terminal closes, new sessions resume from last checkpoint
- **Per-task QA verification** — Each coding agent spawns its own QA reviewer on the same worktree
- **Electron MCP testing** — QA agents spin up the app and test UI with `mcp__electron` tools
- **Automatic documentation updates** — Final step ensures architecture docs stay current
- **Superpowers integration** — Every agent is forced to use thinking/planning/debugging/verification skills

## Reference Implementation

**Full working example**: `C:\Users\Parke\Desktop\Claude-UI`

Key files to study:
```
Claude-UI/
├── .claude/
│   ├── agents/                                    # 27 specialist agent definitions
│   │   ├── team-leader.md
│   │   ├── schema-designer.md
│   │   ├── service-engineer.md
│   │   ├── component-engineer.md
│   │   ├── qa-reviewer.md
│   │   └── ... (22 more)
│   └── commands/
│       └── implement-feature.md                   # The skill entry point
├── ai-docs/
│   └── prompts/
│       └── implementing-features/
│           ├── README.md                          # Master playbook (300+ lines)
│           ├── QA-CHECKLIST-TEMPLATE.md           # Per-task QA checklist
│           ├── PROGRESS-FILE-TEMPLATE.md          # Crash-safe progress tracking
│           └── AGENT-SPAWN-TEMPLATES.md           # Copy-paste agent spawn prompts
├── docs/
│   └── progress/                                  # Runtime progress files (one per active feature)
└── CLAUDE.md                                      # Project rules agents read first
```

---

## Distribution Strategy — Two Layers

### Layer 1: Claude Code Skill Pack

A set of files that live in the project repo. Users invoke `/implement-feature` and Claude Code loads the full orchestration playbook.

**What gets installed:**
```
.claude/commands/implement-feature.md              # Skill entry point
ai-docs/prompts/implementing-features/README.md    # Master playbook
ai-docs/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
ai-docs/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md
ai-docs/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md
docs/progress/.gitkeep                             # Progress file directory
```

**Optionally installed (user selects which):**
```
.claude/agents/team-leader.md
.claude/agents/schema-designer.md
.claude/agents/service-engineer.md
.claude/agents/ipc-handler-engineer.md
.claude/agents/component-engineer.md
.claude/agents/hook-engineer.md
.claude/agents/store-engineer.md
.claude/agents/router-engineer.md
.claude/agents/qa-reviewer.md
.claude/agents/codebase-guardian.md
... (more specialists)
```

### Layer 2: npx Scaffolder

An npm package that generates the skill pack files with an interactive CLI:

```bash
npx create-claude-workflow init
```

Interactive prompts:
```
? Project type: (Electron / React / Node / Full-stack / Custom)
? Include agent definitions? (Yes — select roles / No — just templates)
? Select agents: (checkboxes)
  ✔ team-leader
  ✔ schema-designer
  ✔ service-engineer
  ✔ component-engineer
  ✔ qa-reviewer
  ✔ codebase-guardian
  ○ database-engineer
  ○ websocket-engineer
  ○ integration-engineer
  ...
? Include Electron MCP testing in QA? (Yes / No)
? Include Hub/backend workflow? (Yes / No)
? Progress file directory: (docs/progress/)

✔ Created .claude/commands/implement-feature.md
✔ Created ai-docs/prompts/implementing-features/ (4 files)
✔ Created .claude/agents/ (6 agent definitions)
✔ Created docs/progress/.gitkeep

Done! Invoke /implement-feature in Claude Code to start.
```

---

## Package Architecture

```
create-claude-workflow/
├── package.json
│   name: "create-claude-workflow"
│   bin: { "create-claude-workflow": "./bin/index.js" }
│
├── bin/
│   └── index.js                    # CLI entry point (uses inquirer for prompts)
│
├── templates/
│   ├── commands/
│   │   └── implement-feature.md    # The Claude Code skill
│   │
│   ├── agents/
│   │   ├── _base.md                # Common agent initialization section
│   │   ├── team-leader.md
│   │   ├── schema-designer.md
│   │   ├── service-engineer.md
│   │   ├── ipc-handler-engineer.md
│   │   ├── component-engineer.md
│   │   ├── hook-engineer.md
│   │   ├── store-engineer.md
│   │   ├── router-engineer.md
│   │   ├── styling-engineer.md
│   │   ├── database-engineer.md
│   │   ├── websocket-engineer.md
│   │   ├── integration-engineer.md
│   │   ├── qa-reviewer.md
│   │   ├── codebase-guardian.md
│   │   ├── test-engineer.md
│   │   └── ... (more specialists)
│   │
│   ├── prompts/
│   │   └── implementing-features/
│   │       ├── README.md
│   │       ├── QA-CHECKLIST-TEMPLATE.md
│   │       ├── PROGRESS-FILE-TEMPLATE.md
│   │       └── AGENT-SPAWN-TEMPLATES.md
│   │
│   └── electron/                   # Optional Electron-specific templates
│       └── electron-qa-protocol.md
│
├── lib/
│   ├── scaffolder.js               # File generation logic
│   ├── prompts.js                  # Interactive CLI questions
│   └── templates.js                # Template loading + variable substitution
│
├── README.md                       # npm README with usage docs
└── LICENSE
```

---

## Template Customization

The scaffolder uses simple variable substitution in templates:

```markdown
# {{AGENT_ROLE}} Agent

## Initialization Protocol

Before writing ANY code, read:
1. `{{PROJECT_RULES_FILE}}` — Project rules
2. `{{ARCHITECTURE_FILE}}` — System architecture
3. `{{PATTERNS_FILE}}` — Code conventions
4. `{{LINTING_FILE}}` — Linting rules

## Scope — Files You Own
```
ONLY create/modify: {{AGENT_FILE_SCOPE}}
NEVER modify: {{AGENT_EXCLUDED_FILES}}
```
```

Users can customize after scaffolding — all output files are plain `.md` that they own.

---

## What Makes This Different From Other Dev Tools

1. **It's prompt-native** — Not a runtime dependency. The "tool" is instructions that Claude reads. No build step, no API, no server.
2. **Crash-safe by design** — Progress files on disk survive any interruption. New sessions pick up where the last one left off.
3. **QA is per-agent, not end-of-pipeline** — Each coding agent is responsible for its own quality. The QA agent runs ON the same worktree with the actual code.
4. **Electron MCP testing built in** — QA agents don't just review code — they start the app, click through it, and check for console errors.
5. **Documentation is mandatory, not optional** — The workflow enforces a doc-update step as the final gate before a feature is complete.
6. **Superpowers enforcement** — Every agent must use thinking/planning/debugging skills. No cowboy coding.

---

## Implementation Steps

### Phase 1: Package Setup
1. `npm init` with proper package.json
2. Set up `bin/index.js` as CLI entry point
3. Use `inquirer` for interactive prompts
4. Use `fs-extra` for file copying with variable substitution

### Phase 2: Template Extraction
1. Copy all templates from the Claude-UI reference implementation
2. Generalize project-specific references (replace `Claude-UI` with `{{PROJECT_NAME}}`)
3. Make agent definitions modular (each agent is independently selectable)
4. Add project-type presets (Electron, React, Node, etc.)

### Phase 3: CLI Logic
1. Detect existing `.claude/` directory (don't overwrite)
2. Merge with existing agents if present
3. Detect project type from package.json / tsconfig
4. Offer sensible defaults based on project type

### Phase 4: Documentation
1. npm README with quick start
2. Each template has inline comments explaining customization points
3. Link to Claude-UI repo as reference implementation

### Phase 5: Publish
1. `npm publish` as `create-claude-workflow`
2. GitHub repo with issues/PRs for community contributions
3. Consider: GitHub Actions template for CI validation

---

## Future Enhancements

- **Preset packs**: `npx create-claude-workflow init --preset=electron` for pre-configured agent sets
- **Agent marketplace**: Community-contributed agent definitions
- **Progress dashboard**: Simple web UI that reads progress files and shows status
- **VS Code extension**: Surface progress files in the editor sidebar
- **Team analytics**: Aggregate QA pass/fail rates, agent performance metrics
