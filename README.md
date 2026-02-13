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

Mandatory doc updates        Final gate ensures architecture
                             docs stay current

Superpowers enforcement      Agents must use thinking/planning/
                             debugging skills — no cowboy coding
```

## What Gets Installed

```
your-project/
├── .claude/
│   ├── commands/
│   │   └── implement-feature.md        ← skill entry point
│   └── agents/                         ← specialist agents (you pick which)
│       ├── team-leader.md
│       ├── schema-designer.md
│       ├── service-engineer.md
│       ├── component-engineer.md
│       ├── qa-reviewer.md
│       ├── codebase-guardian.md
│       └── ...
├── ai-docs/
│   └── prompts/
│       └── implementing-features/
│           ├── README.md               ← master playbook
│           ├── QA-CHECKLIST-TEMPLATE.md
│           ├── PROGRESS-FILE-TEMPLATE.md
│           └── AGENT-SPAWN-TEMPLATES.md
└── docs/
    └── progress/                       ← runtime progress files
```

## Setup

### Quick start

```bash
# Scaffold into an existing project
cd your-project
npx create-claude-workflow init

# Then in Claude Code
/implement-feature "your feature description"
```

### Interactive prompts

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
```

## Roadmap

- [ ] Preset packs (`--preset=electron`, `--preset=react`)
- [ ] Community agent marketplace
- [ ] Progress dashboard (web UI reading progress files)
- [ ] VS Code extension (progress in sidebar)

## License

MIT
