# Claude Workflow Skill — Distribution Plan

> **Status: SUPERSEDED** — This was the original vision document. The project has evolved significantly. See `docs/internal/DEVELOPMENT-LOG.md` for current state and decisions.

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
- **Auto agent discovery** — `/discover-agents` indexes the codebase, recommends agents, bundles skills.sh skills

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

A set of files that live in the project repo under `.claude/`. Nothing is loaded into context until invoked.

**What gets installed (all under `.claude/`):**
```
.claude/commands/implement-feature.md              # Skill entry point ← loaded on /invoke
.claude/commands/discover-agents.md                # Agent discovery   ← loaded on /invoke
.claude/prompts/implementing-features/README.md    # Master playbook   ← loaded on explicit read
.claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md
.claude/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md
.claude/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md
docs/progress/.gitkeep                             # Progress file directory (runtime output)
```

**Context cost:**
```
File type                  When loaded        Cost if idle
────────────────────────────────────────────────────────
CLAUDE.md                  Every session      Always in context ← keep lean
.claude/commands/*.md      On /invoke only    Zero
.claude/agents/*.md        On agent spawn     Zero
.claude/prompts/*          On explicit read   Zero
```

**Optionally installed (user selects which, or /discover-agents generates):**
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
✔ Created .claude/commands/discover-agents.md
✔ Created .claude/prompts/implementing-features/ (4 files)
✔ Created .claude/agents/ (6 agent definitions)
✔ Created docs/progress/.gitkeep

Done! Run /discover-agents to auto-detect more agents, or /implement-feature to start.
```

### Layer 3: /discover-agents (Runtime Agent Discovery)

A Claude Code skill that indexes the codebase at runtime and generates tailored agents:

```
/discover-agents flow:

Phase 1: Index ──→ Languages, packages, frameworks, patterns, structure, existing agents/MCPs/plugins
Phase 2: Map   ──→ Detection → agent role (subtract existing agents)
Phase 3: Ask   ──→ Present options to user with multiSelect
Phase 4: Gen   ──→ Create .claude/agents/*.md tailored to actual project paths + bundled skills
Phase 5: Done  ──→ Summary + recommended skills.sh installs
Phase 6: Super ──→ Check Superpowers plugin → prompt install if missing → restart notice
```

**Detection → Agent mapping:**
```
Detection                          → Agent Role                → Skills.sh Bundle
─────────────────────────────────────────────────────────────────────────────────
React/Next.js/Vue/Svelte           → component-engineer        → vercel-labs/agent-skills, anthropics/skills (frontend-design)
React Native/Expo                  → mobile-engineer           → vercel-labs/agent-skills (react-native-guidelines)
CSS/Tailwind/styled                → styling-engineer          → anthropics/skills (frontend-design)
Express/Fastify/NestJS/Django      → api-engineer              → —
Prisma/Drizzle/TypeORM/SQL         → database-engineer         → —
Redux/Zustand/Jotai/MobX          → state-engineer            → —
Electron IPC                       → ipc-handler-engineer      → —
Electron/Tauri                     → desktop-engineer          → —
WebSocket/Socket.io                → realtime-engineer         → —
tRPC/GraphQL                       → api-schema-engineer       → —
Auth (next-auth/passport/clerk)    → auth-engineer             → —
Jest/Vitest/pytest                 → test-engineer             → anthropics/skills (webapp-testing)
Playwright/Cypress                 → e2e-test-engineer         → anthropics/skills (webapp-testing)
Docker                             → devops-engineer           → —
Terraform/Pulumi/CDK               → infra-engineer            → —
GitHub Actions                     → ci-cd-engineer            → —
Stripe/payments                    → payments-engineer         → —
i18n/Intl                          → i18n-engineer             → —
Any project                        → team-leader               → (always recommended)
Any project                        → qa-reviewer               → anthropics/skills (webapp-testing)
Any project                        → codebase-guardian         → (always recommended)
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
│   │   ├── implement-feature.md    # The Claude Code skill
│   │   └── discover-agents.md     # Agent discovery skill
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

## Skills Integration
This agent benefits from:
{{SKILL_LIST}}

## MCP Servers Available
{{MCP_LIST}}
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
7. **Auto-discovery** — `/discover-agents` reads the actual codebase and generates agents tailored to the real tech stack, not generic templates.
8. **Skills.sh integration** — Generated agents bundle relevant community skills from the marketplace automatically.

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
5. Consolidate all installed files under `.claude/` (prompts move from `ai-docs/` to `.claude/prompts/`)

### Phase 3: CLI Logic
1. Detect existing `.claude/` directory (don't overwrite)
2. Merge with existing agents if present
3. Detect project type from package.json / tsconfig
4. Offer sensible defaults based on project type

### Phase 4: Discover-Agents Command
1. Build the `/discover-agents` skill template
2. Codebase indexing: languages, packages, frameworks, patterns, structure
3. Agent recommendation engine: detection → role mapping → filtering existing agents
4. Skills.sh integration: map agents to marketplace skills
5. MCP/plugin detection: read `.mcp.json`, `.claude/settings.json`, `.skills/`
6. Agent generation: create tailored `.claude/agents/*.md` with real project paths
7. Superpowers plugin check: detect if installed → prompt user → install → restart notice
   - Detection: check `.claude/plugins/superpowers/`, settings files, available skills
   - Standalone final step: nothing runs after install because CLI restart is required
   - Install commands: `claude /plugin marketplace add obra/superpowers-marketplace` + `claude /plugin install superpowers@superpowers-marketplace`

### Phase 5: Documentation
1. npm README with quick start
2. Each template has inline comments explaining customization points
3. Link to Claude-UI repo as reference implementation

### Phase 6: Publish
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
- **Skills.sh auto-install**: `discover-agents` automatically runs `npx skills add` for bundled skills
- **MCP server recommendations**: Suggest MCP servers based on detected tech stack
