# create-claude-workflow

A Claude Code skill pack + npx scaffolder for orchestrating multi-agent feature development with crash-safe progress tracking, per-task QA, and automated documentation.

```
npx create-claude-workflow init
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  You run: /implement-feature "Add user settings page"       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    Team Leader      │
              │  Reads playbook,    │
              │  decomposes tasks,  │
              │  spawns agents      │
              └──┬──────┬───────┬───┘
                 │      │       │
        ┌────────┘      │       └────────┐
        ▼               ▼                ▼
  ┌───────────┐  ┌────────────┐  ┌─────────────┐
  │  Schema   │  │  Service   │  │  Component  │
  │ Designer  │  │  Engineer  │  │  Engineer   │
  └─────┬─────┘  └─────┬──────┘  └──────┬──────┘
        │               │               │
        ▼               ▼               ▼
  ┌───────────┐  ┌────────────┐  ┌─────────────┐
  │ QA Review │  │ QA Review  │  │  QA Review  │  ← per-agent QA
  └───────────┘  └────────────┘  └─────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Codebase Guardian   │
              │ Updates docs        │
              └─────────────────────┘
```

## Features

```
Feature                      What it does
─────────────────────────────────────────────────────────────────
Team orchestration           Decomposes features into tasks,
                             spawns specialist agents in waves

Crash-safe progress          Temp files on disk survive terminal
                             closes — new sessions auto-resume

Per-agent QA                 Each coding agent spawns its own
                             QA reviewer on the same worktree

Electron MCP testing         QA agents launch the app, click
                             through UI, check console errors

Auto agent discovery         /discover-agents indexes your codebase
                             and recommends specialist agents

Skills.sh integration        Agents auto-bundle relevant skills
                             from the skills.sh marketplace

Mandatory doc updates        Final gate ensures architecture
                             docs stay current

Superpowers enforcement      Agents must use thinking/planning/
                             debugging skills — no cowboy coding

Superpowers auto-install     Detects if plugin is missing, prompts
                             to install, handles CLI restart notice
```

## Commands

```
Command                What it does
───────────────────────────────────────────────────────────────
/discover-agents       Indexes codebase → detects tech stack →
                       recommends agents → you pick → generates
                       tailored agent definitions with skills

/implement-feature     Runs the full orchestration workflow:
                       plan → spawn agents → QA → docs update
```

### /discover-agents flow

```
┌──────────────────────────────────────────────────────┐
│  /discover-agents                                    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 1: Index                                      │
│                                                      │
│  Languages ─── package.json ─── tsconfig ─── go.mod  │
│  Frameworks    Patterns        Structure    MCP/Skills│
│  Plugins ───── Superpowers installed? (yes/no)       │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 2: Map detections → agent roles               │
│                                                      │
│  React + Tailwind ──→ component-engineer             │
│  Prisma + SQL     ──→ database-engineer              │
│  Vitest           ──→ test-engineer                  │
│  Electron IPC     ──→ ipc-handler-engineer           │
│  (subtract already-existing agents)                  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 3: Present options                            │
│                                                      │
│  ✔ team-leader         (core — always recommended)   │
│  ✔ qa-reviewer         (core — always recommended)   │
│  ✔ component-engineer  (detected: React, Next.js)    │
│  ○ database-engineer   (detected: Prisma)            │
│  ○ test-engineer       (detected: Vitest)            │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 4: Generate agents with bundled skills        │
│                                                      │
│  ✔ .claude/agents/team-leader.md                     │
│  ✔ .claude/agents/component-engineer.md              │
│    ↳ bundles: react-best-practices, frontend-design  │
│  ✔ .claude/agents/qa-reviewer.md                     │
│    ↳ bundles: webapp-testing                         │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 5: Summary                                    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 6: Superpowers check (standalone, last step)  │
│                                                      │
│  Already installed? ──→ skip                         │
│  Not installed? ──→ prompt user:                     │
│                                                      │
│  "Install Claude Superpowers to enable agents to     │
│   utilize the plugin's built-in features?"           │
│                                                      │
│  Yes ──→ install + print restart notice              │
│  No  ──→ print manual install command                │
│                                                      │
│  ⚠ RESTART REQUIRED after install                    │
└──────────────────────────────────────────────────────┘
```

### Skills.sh integration

Agents auto-reference relevant skills from the marketplace:

```
Agent                  Bundled skills.sh skills
──────────────────────────────────────────────────────────────
component-engineer     vercel-labs/agent-skills
                         → react-best-practices
                         → web-design-guidelines
                         → composition-patterns
                       anthropics/skills
                         → frontend-design

mobile-engineer        vercel-labs/agent-skills
                         → react-native-guidelines

styling-engineer       anthropics/skills
                         → frontend-design

qa-reviewer            anthropics/skills
                         → webapp-testing

test-engineer          anthropics/skills
                         → webapp-testing

Any agent              anthropics/skills
                         → mcp-builder (if MCP detected)
```

## What Gets Installed

Everything lives under `.claude/` — nothing is loaded into context until invoked.

```
your-project/
├── .claude/
│   ├── commands/
│   │   ├── implement-feature.md          ← loaded on /implement-feature
│   │   └── discover-agents.md            ← loaded on /discover-agents
│   ├── agents/                           ← loaded per agent spawn (zero cost when idle)
│   │   ├── team-leader.md
│   │   ├── component-engineer.md
│   │   ├── qa-reviewer.md
│   │   ├── codebase-guardian.md
│   │   └── ...
│   └── prompts/
│       └── implementing-features/
│           ├── README.md                 ← master playbook (read by team-leader)
│           ├── QA-CHECKLIST-TEMPLATE.md
│           ├── PROGRESS-FILE-TEMPLATE.md
│           └── AGENT-SPAWN-TEMPLATES.md
└── docs/
    └── progress/                         ← runtime progress files (one per feature)
```

```
Context cost
──────────────────────────────────────────────────
CLAUDE.md              Always loaded     ← keep lean
.claude/commands/*.md  On /invoke only   ← zero cost
.claude/agents/*.md    On spawn only     ← zero cost
.claude/prompts/*      On explicit read  ← zero cost
```

## Setup

### Quick start

```bash
# Scaffold into an existing project
cd your-project
npx create-claude-workflow init

# Auto-detect your stack and generate tailored agents
/discover-agents

# Start orchestrated development
/implement-feature "your feature description"
```

### Interactive prompts (init)

```
? Project type:              Electron / React / Node / Full-stack / Custom
? Include agent definitions? Yes — select roles / No — just templates
? Select agents:             ✔ team-leader  ✔ qa-reviewer  ✔ ...
? Electron MCP testing?      Yes / No
? Progress file directory:   docs/progress/
```

### Manual install

Copy the files from `templates/` into your project and customize the `.md` files directly.

## Architecture

```
create-claude-workflow/
├── bin/index.js              ← CLI entry point
├── lib/
│   ├── scaffolder.js         ← file generation
│   ├── prompts.js            ← interactive questions
│   └── templates.js          ← template loading + variable substitution
├── templates/
│   ├── commands/             ← Claude Code skills
│   │   ├── implement-feature.md
│   │   └── discover-agents.md
│   ├── agents/               ← agent definitions (modular)
│   ├── prompts/              ← playbook + checklists
│   └── electron/             ← optional Electron QA protocol
├── package.json
└── README.md
```

## Template Variables

Templates use `{{VARIABLE}}` substitution. Customize after scaffolding — all output is plain `.md` you own.

```
Variable                  Example value
──────────────────────────────────────────────────
{{PROJECT_NAME}}          my-app
{{PROJECT_RULES_FILE}}    CLAUDE.md
{{ARCHITECTURE_FILE}}     docs/ARCHITECTURE.md
{{AGENT_ROLE}}            Service Engineer
{{AGENT_FILE_SCOPE}}      src/services/**
{{AGENT_EXCLUDED_FILES}}  src/components/**
```

## Why This Exists

```
Problem                              This tool's approach
──────────────────────────────────────────────────────────────────
Agents go rogue, edit wrong files    Each agent has a scoped file list
QA happens at the end (too late)     QA runs per-agent, inline
Terminal crash = lost progress       Progress files on disk, auto-resume
Docs rot after features ship         Doc update is a mandatory final step
Agents skip planning, debug blind    Superpowers skills are enforced
Don't know which agents to create    /discover-agents auto-detects your stack
Skills scattered, not integrated     Agents bundle relevant skills.sh skills
```

## Roadmap

- [ ] Preset packs (`--preset=electron`, `--preset=react`)
- [ ] Community agent marketplace
- [ ] Progress dashboard (web UI reading progress files)
- [ ] VS Code extension (progress in sidebar)

## License

MIT
