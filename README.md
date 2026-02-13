# create-claude-workflow

A Claude Code skill pack + npx scaffolder for orchestrating multi-agent feature development with crash-safe progress tracking, per-task QA, and automated documentation.

```
npx create-claude-workflow init
```

---

## How It Works

One command kicks off a fully orchestrated, multi-agent development pipeline. Here is the flow from start to finish:

```mermaid
%%{init: {'flowchart': {'useMaxWidth': false, 'wrappingWidth': 400}}}%%
flowchart TD
    A["You run: /implement-feature 'Add user settings page'"] --> B["Team Leader — Reads playbook, decomposes tasks, spawns agents"]
    B --> C["Schema Designer"]
    B --> D["Service Engineer"]
    B --> E["Component Engineer"]
    C --> F["QA Review"]
    D --> G["QA Review"]
    E --> H["QA Review"]
    F --> I["Codebase Guardian — Final integrity check"]
    G --> I
    H --> I

    style A fill:#4a90d9,color:#fff
    style B fill:#f5a623,color:#fff
    style F fill:#7ed321,color:#fff
    style G fill:#7ed321,color:#fff
    style H fill:#7ed321,color:#fff
    style I fill:#9b59b6,color:#fff
```

Each coding agent gets its own QA reviewer on the same branch. Only after all agents pass QA does the Codebase Guardian run a final integrity check.

### Branching Model

Every task is isolated on its own branch -- no file conflicts, clean merges.

```mermaid
%%{init: {'flowchart': {'useMaxWidth': false, 'wrappingWidth': 400}}}%%
flowchart LR
    M["main"] --> F["feature/user-settings"]
    F --> W1["work/.../schema-design"]
    W1 -->|"QA pass"| F
    F --> W2["work/.../api-service"]
    W2 -->|"QA pass"| F
    F --> W3["work/.../ui-components"]
    W3 -->|"QA pass"| F

    style M fill:#6c757d,color:#fff
    style F fill:#f5a623,color:#fff
    style W1 fill:#4a90d9,color:#fff
    style W2 fill:#4a90d9,color:#fff
    style W3 fill:#4a90d9,color:#fff
```

**Per-task lifecycle:**

1. Team Leader creates a work branch from `feature/` HEAD
2. Agent works and commits on the work branch
3. Agent spawns QA on the same work branch
4. QA: **FAIL** --> agent fixes --> new QA (max 3 rounds) | **PASS** --> QA updates docs on work branch --> commits
5. Team Leader rebases work branch onto `feature/` --> merges `--no-ff` --> deletes work branch
6. Next wave branches from updated `feature/` HEAD

---

## Features

At a glance, here is what you get out of the box:

| Feature | What It Does |
|---|---|
| :shield: Branch-per-task isolation | Each task gets its own work branch off `feature/` -- no file conflicts |
| :busts_in_silhouette: Team orchestration | Decomposes features into tasks, spawns specialist agents in waves |
| :floppy_disk: Crash-safe progress | Progress files on disk survive terminal closes -- new sessions auto-resume |
| :mag: Per-agent QA | Each coding agent spawns its own QA reviewer on the same work branch |
| :books: QA-driven doc updates | QA updates docs on PASS (not a separate agent), keeping branches self-contained |
| :lock: Codebase Guardian | Final structural integrity check on merged feature branch before PR |
| :detective: Auto agent discovery | `/discover-agents` indexes your codebase and recommends specialist agents |
| :link: Skills.sh integration | Agents auto-bundle relevant skills from the skills.sh marketplace |
| :zap: Superpowers enforcement | Agents must use thinking/planning/debugging skills -- no cowboy coding |
| :inbox_tray: Superpowers auto-install | Detects if plugin is missing, prompts to install, handles CLI restart notice |

---

## Commands

| Command | What It Does |
|---|---|
| `/discover-agents` | Indexes codebase --> detects tech stack --> recommends agents --> you pick --> generates tailored agent definitions with skills |
| `/implement-feature` | Runs the full orchestration workflow: branch --> plan --> spawn --> QA --> merge --> PR |

### /discover-agents Flow

The agent discovery process walks through six phases automatically:

```mermaid
%%{init: {'flowchart': {'useMaxWidth': false, 'wrappingWidth': 400}}}%%
flowchart TD
    A["/discover-agents"] --> B["Phase 1: Index — Languages, frameworks, patterns, structure, plugins"]
    B --> C["Phase 2: Map — Detections to agent roles, subtract existing agents"]
    C --> D["Phase 3: Present — Core + detected agents, user selects"]
    D --> E["Phase 4: Generate — Writes .claude/agents/*.md with bundled skills"]
    E --> F["Phase 5: Summary"]
    F --> G["Phase 6: Superpowers — Check if installed, prompt if missing"]

    style A fill:#4a90d9,color:#fff
    style D fill:#f5a623,color:#fff
    style E fill:#7ed321,color:#fff
    style G fill:#9b59b6,color:#fff
```

### Skills.sh Integration

Agents auto-reference relevant skills from the marketplace. Here is the default mapping:

| Agent | Bundled skills.sh Skills |
|---|---|
| component-engineer | `vercel-labs/agent-skills` --> react-best-practices, web-design-guidelines, composition-patterns; `anthropics/skills` --> frontend-design |
| mobile-engineer | `vercel-labs/agent-skills` --> react-native-guidelines |
| styling-engineer | `anthropics/skills` --> frontend-design |
| qa-reviewer | `anthropics/skills` --> webapp-testing |
| test-engineer | `anthropics/skills` --> webapp-testing |
| Any agent | `anthropics/skills` --> mcp-builder (if MCP detected) |

---

## What Gets Installed

Everything lives under `.claude/` -- nothing is loaded into context until invoked.

```
your-project/
├── .claude/
│   ├── commands/
│   │   ├── implement-feature.md          <- loaded on /implement-feature
│   │   └── discover-agents.md            <- loaded on /discover-agents
│   ├── agents/                           <- loaded per agent spawn (zero cost when idle)
│   │   ├── team-leader.md
│   │   ├── component-engineer.md
│   │   ├── qa-reviewer.md
│   │   ├── codebase-guardian.md
│   │   └── ...
│   └── prompts/
│       └── implementing-features/
│           ├── README.md                 <- master playbook (read by team-leader)
│           ├── QA-CHECKLIST-TEMPLATE.md
│           ├── PROGRESS-FILE-TEMPLATE.md
│           └── AGENT-SPAWN-TEMPLATES.md
└── docs/
    └── progress/                         <- runtime progress files (one per feature)
```

### Context Cost

Nothing is loaded until you need it:

| File | When Loaded | Cost |
|---|---|---|
| `CLAUDE.md` | Always loaded | Keep lean |
| `.claude/commands/*.md` | On `/invoke` only | Zero cost |
| `.claude/agents/*.md` | On spawn only | Zero cost |
| `.claude/prompts/*` | On explicit read | Zero cost |

---

## Setup

### Quick Start

```bash
# Scaffold into an existing project
cd your-project
npx create-claude-workflow init

# Auto-detect your stack and generate tailored agents
/discover-agents

# Start orchestrated development
/implement-feature "your feature description"
```

### Interactive Prompts (init)

```
? Project type:              Electron / React / Node / Full-stack / Custom
? Include agent definitions? Yes - select roles / No - just templates
? Select agents:             team-leader, qa-reviewer, ...
? Electron MCP testing?      Yes / No
? Progress file directory:   docs/progress/
```

### Manual Install

Copy the files from `templates/` into your project and customize the `.md` files directly.

---

## Architecture

```
create-claude-workflow/
├── bin/index.js              <- CLI entry point
├── lib/
│   ├── scaffolder.js         <- file generation
│   ├── prompts.js            <- interactive questions
│   └── templates.js          <- template loading + variable substitution
├── templates/
│   ├── commands/             <- Claude Code skills
│   │   ├── implement-feature.md
│   │   └── discover-agents.md
│   ├── agents/               <- agent definitions (modular)
│   ├── prompts/              <- playbook + checklists
│   └── electron/             <- optional Electron QA protocol
├── package.json
└── README.md
```

---

## Template Variables

Templates use `{{VARIABLE}}` substitution. Customize after scaffolding -- all output is plain `.md` you own.

| Variable | Example Value |
|---|---|
| `{{PROJECT_NAME}}` | my-app |
| `{{PROJECT_RULES_FILE}}` | CLAUDE.md |
| `{{ARCHITECTURE_FILE}}` | docs/ARCHITECTURE.md |
| `{{PROGRESS_DIR}}` | docs/progress |
| `{{AGENT_ROLE}}` | Service Engineer |
| `{{AGENT_FILE_SCOPE}}` | src/services/** |
| `{{AGENT_EXCLUDED_FILES}}` | src/components/** |

---

## Why This Exists

| Problem | This Tool's Approach |
|---|---|
| Agents conflict on shared files | Branch-per-task + file scoping + sequential merges (5-layer prevention) |
| Agents go rogue, edit wrong files | Each agent has a scoped file list |
| QA happens at the end (too late) | QA runs per-agent on the work branch |
| Terminal crash = lost progress | Progress files on disk, auto-resume |
| Docs rot after features ship | QA updates docs on PASS + Guardian checks coherence at the end |
| Agents skip planning, debug blind | Superpowers skills are enforced |
| Don't know which agents to create | `/discover-agents` auto-detects your stack |
| Skills scattered, not integrated | Agents bundle relevant skills.sh skills |

---

## Roadmap

- [ ] Preset packs (`--preset=electron`, `--preset=react`)
- [ ] Community agent marketplace
- [ ] Progress dashboard (web UI reading progress files)
- [ ] VS Code extension (progress in sidebar)

---

## License

MIT
