---
description: "Analyze codebase to auto-discover optimal agent roles and generate definitions"
---

# Discover Agents

You are a codebase analyst. Your job is to deeply index the user's project, detect what specialist agents would be valuable, and let the user pick which ones to generate.

## Phase 1: Full Codebase Index

Perform a thorough analysis of the project. Run ALL of these in parallel:

### 1.1 Languages & Runtimes
- Glob for file extensions: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`, `**/*.py`, `**/*.go`, `**/*.rs`, `**/*.java`, `**/*.rb`, `**/*.php`, `**/*.swift`, `**/*.kt`, `**/*.vue`, `**/*.svelte`, `**/*.astro`, `**/*.css`, `**/*.scss`, `**/*.sql`
- Read `tsconfig.json`, `jsconfig.json`, `.python-version`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json` if they exist
- Note: language, version, strict mode, module system

### 1.2 Package Ecosystem
- Read `package.json` — extract ALL dependencies and devDependencies
- Read `requirements.txt`, `pyproject.toml`, `Pipfile`, `go.sum`, `Cargo.lock` if they exist
- Categorize packages by purpose: framework, UI, state, testing, build, database, auth, API, etc.

### 1.3 Framework Detection
- Detect from packages and config files:
  - **Frontend**: React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, Astro, Remix, Gatsby, Expo, React Native
  - **Backend**: Express, Fastify, NestJS, Django, Flask, FastAPI, Rails, Laravel, Spring, Gin, Actix
  - **Desktop**: Electron, Tauri
  - **Mobile**: React Native, Expo, Flutter, Swift UI, Kotlin/Android
  - **Fullstack**: Next.js, Nuxt, SvelteKit, Remix, Blitz

### 1.4 Architecture Patterns
- Grep for patterns:
  - `createSlice|configureStore|useSelector` → Redux/RTK
  - `createContext|useContext` → React Context
  - `atom\(|useAtom` → Jotai
  - `create\(.*set.*get\)` → Zustand
  - `observable|makeAutoObservable` → MobX
  - `ipcMain|ipcRenderer|contextBridge` → Electron IPC
  - `Router|createBrowserRouter|useRouter` → Routing
  - `prisma|drizzle|sequelize|typeorm|knex|mongoose` → ORM/DB
  - `trpc|createTRPCRouter` → tRPC
  - `GraphQL|gql\`|useQuery` → GraphQL
  - `WebSocket|socket\.io|ws\(` → WebSockets
  - `REST|fetch\(|axios|ky\(` → REST API
  - `Dockerfile|docker-compose` → Docker
  - `terraform|pulumi|cdk` → IaC
  - `jest|vitest|mocha|pytest|go test` → Testing
  - `playwright|cypress|puppeteer` → E2E testing
  - `storybook` → Component docs
  - `i18n|intl|useTranslation` → Internationalization
  - `Stripe|stripe` → Payments
  - `next-auth|passport|clerk|auth0|supabase.*auth` → Auth
  - `S3|cloudfront|blob|uploadthing` → File storage
  - `Redis|redis|bull|bullmq` → Caching/queues
  - `cron|schedule|agenda` → Job scheduling
  - `winston|pino|bunyan|morgan` → Logging
  - `sentry|datadog|newrelic` → Monitoring

### 1.5 Project Structure
- Glob for directory patterns:
  - `src/components/**` → Component layer
  - `src/services/**` or `src/api/**` → Service layer
  - `src/hooks/**` → Custom hooks
  - `src/store/**` or `src/state/**` → State management
  - `src/utils/**` or `src/lib/**` → Utilities
  - `src/types/**` or `src/**/*.d.ts` → Type definitions
  - `src/styles/**` → Styling layer
  - `src/routes/**` or `src/pages/**` or `app/` → Routing
  - `prisma/` or `drizzle/` or `db/` → Database layer
  - `tests/` or `__tests__/` or `*.test.*` or `*.spec.*` → Test files
  - `e2e/` or `cypress/` or `playwright/` → E2E tests
  - `public/` or `static/` or `assets/` → Static assets
  - `.github/workflows/` → CI/CD
  - `docs/` → Documentation
  - `scripts/` → Build/dev scripts
  - `main/` or `electron/` or `src-tauri/` → Desktop process

### 1.6 Existing Agents, Skills & Plugins
- Check `.claude/agents/` — list all existing agent definitions
- Check `.claude/commands/` — list all existing skills
- Check if `skills.sh` skills are installed (look for `.skills/` directory or skill config files)
- Check `.claude/settings.json` or `.mcp.json` for installed MCP servers
- **Check if Superpowers plugin is installed**: Look for any of these indicators:
  - `.claude/plugins/superpowers/` directory exists
  - Grep for `superpowers` in `.claude/settings.json` or `.claude/plugins.json`
  - Check if superpowers skills are available (e.g., `superpowers:brainstorming`, `superpowers:systematic-debugging`)
  - Record result as `superpowers_installed: true/false` — this is used in Phase 6

## Phase 2: Agent Recommendation Engine

Based on the index, build a recommendation list. For EACH detected pattern/technology, map it to a specialist agent role.

### Agent Mapping Rules

```
Detection                          → Agent Role                    → Skills to Bundle
─────────────────────────────────────────────────────────────────────────────────────
React/Next.js/Vue/Svelte           → component-engineer            → vercel-labs/agent-skills (react-best-practices, web-design-guidelines)
                                                                     anthropics/skills (frontend-design)
React Native / Expo                → mobile-engineer               → vercel-labs/agent-skills (react-native-guidelines)
CSS/SCSS/Tailwind/styled           → styling-engineer              → anthropics/skills (frontend-design)
Express/Fastify/NestJS/Django      → api-engineer                  → (none currently)
Prisma/Drizzle/TypeORM/SQL         → database-engineer             → (none currently)
Redux/Zustand/Jotai/MobX          → state-engineer                → (none currently)
Electron IPC/main process          → ipc-handler-engineer          → (none currently)
Electron/Tauri (desktop)           → desktop-engineer              → (none currently)
WebSocket/Socket.io                → realtime-engineer             → (none currently)
tRPC/GraphQL                       → api-schema-engineer           → (none currently)
Auth (next-auth/passport/clerk)    → auth-engineer                 → (none currently)
Jest/Vitest/Mocha/pytest           → test-engineer                 → anthropics/skills (webapp-testing)
Playwright/Cypress                 → e2e-test-engineer             → anthropics/skills (webapp-testing)
Docker/Docker Compose              → devops-engineer               → (none currently)
Terraform/Pulumi/CDK               → infra-engineer                → (none currently)
CI/CD (GitHub Actions)             → ci-cd-engineer                → (none currently)
Stripe/Payments                    → payments-engineer             → (none currently)
i18n/Intl                          → i18n-engineer                 → (none currently)
S3/File uploads                    → storage-engineer              → (none currently)
Redis/BullMQ/Queues                → queue-engineer                → (none currently)
Logging/Monitoring (Sentry)        → observability-engineer        → (none currently)
TypeScript types layer             → type-architect                → (none currently)
Router/Pages/App dir               → router-engineer               → (none currently)
Custom hooks layer                 → hook-engineer                 → (none currently)
Storybook                          → component-docs-engineer       → (none currently)
Any project                        → team-leader                   → (always recommended)
Any project                        → qa-reviewer                   → anthropics/skills (webapp-testing)
Any project                        → codebase-guardian             → (always recommended)
```

### Filtering
- EXCLUDE any agent role that already exists in `.claude/agents/`
- ONLY recommend agents for technologies actually detected in the codebase
- Always recommend `team-leader`, `qa-reviewer`, and `codebase-guardian` if they don't exist

## Phase 3: Present to User

Present the recommendations as a structured selection list using the AskUserQuestion tool.

Format your findings as a summary FIRST, then ask:

### Codebase Summary
```
Languages:    TypeScript, CSS
Frameworks:   Next.js 14, Tailwind CSS
State:        Zustand
Database:     Prisma + PostgreSQL
Testing:      Vitest, Playwright
Auth:         NextAuth.js
Desktop:      N/A
Packages:     47 deps, 23 devDeps
```

### Then present agent options using AskUserQuestion with multiSelect: true

Group agents into:

**Core (recommended for every project):**
- team-leader — Orchestrates multi-agent feature development
- qa-reviewer — Per-task quality assurance and verification
- codebase-guardian — Documentation maintenance and architecture integrity

**Detected from your codebase:**
- component-engineer — React/Vue/Svelte component development
- api-engineer — Backend route and controller development
- database-engineer — Schema design, migrations, queries
- (etc. — only what was actually detected)

For each agent, note which skills.sh skills would be bundled.

## Phase 4: Generate Selected Agents

For each agent the user selects:

1. **Create the agent file** at `.claude/agents/{agent-name}.md`
2. **Tailor it to the project** — use actual file paths, actual packages, actual patterns found during indexing
3. **Include skill references** — if a skills.sh skill maps to this agent, add an initialization step:
   ```
   ## Skills Integration
   This agent benefits from installed skills. Ensure these are installed:
   - `npx skills add vercel-labs/agent-skills` — React best practices
   - `npx skills add anthropics/skills` — Frontend design, webapp testing
   ```
4. **Include MCP references** — if relevant MCP servers are installed, reference them in the agent's capabilities
5. **Scope the agent** — set file ownership patterns based on the actual project structure found during indexing

### Agent Template Structure

Each generated agent MUST follow this format:

```markdown
# {{AGENT_ROLE}}

## Initialization Protocol

Before writing ANY code:
1. Read `CLAUDE.md` — Project rules and conventions
2. Read relevant architecture docs
3. Check the progress file for current feature context
4. Use /skill tools: thinking, planning, debugging, verification

## Scope — Files You Own

ONLY create/modify files matching:
- {{SCOPED_PATHS}}

NEVER modify:
- {{EXCLUDED_PATHS}}

## Skills Integration

This agent benefits from:
{{SKILL_LIST}}

## MCP Servers Available

{{MCP_LIST}}

## Quality Gates

Before marking work complete:
- [ ] All changes within scope
- [ ] No TypeScript/lint errors introduced
- [ ] Existing tests still pass
- [ ] New code has appropriate test coverage
- [ ] Changes documented if architectural
```

## Phase 5: Post-Install Summary

After generating all selected agents, output:

```
Created agents:
  ✔ .claude/agents/team-leader.md
  ✔ .claude/agents/component-engineer.md
  ✔ .claude/agents/qa-reviewer.md
  ...

Recommended skills to install:
  npx skills add vercel-labs/agent-skills
  npx skills add anthropics/skills

Run /implement-feature to start orchestrated development.
```

## Phase 6: Superpowers Plugin Check (Standalone — Final Step)

**This phase runs AFTER everything else is complete.** It is intentionally standalone because installing Superpowers requires a CLI restart.

### 6.1 Check if already installed

If `superpowers_installed` was `true` from Phase 1.6, skip this phase entirely and output:
```
✔ Superpowers plugin already installed.
```

### 6.2 Prompt the user

If Superpowers is NOT installed, ask the user using AskUserQuestion:

```
Question: "Would you like to install Claude Superpowers to enable agents to utilize the plugin's built-in features?"
Options:
  - "Yes, install Superpowers" — Installs the plugin (requires CLI restart after)
  - "No, skip for now" — Agents will still work, but without superpowers skills
```

### 6.3 Install if accepted

If the user selects yes, run these commands sequentially:

```bash
claude /plugin marketplace add obra/superpowers-marketplace
claude /plugin install superpowers@superpowers-marketplace
```

Then output this EXACT message — do NOT continue with any other operations after this:

```
✔ Superpowers plugin installed successfully.

⚠ RESTART REQUIRED
  Close and reopen Claude Code for Superpowers to activate.
  After restart, your agents will have access to:
    - Socratic brainstorming & design refinement
    - Systematic debugging (4-phase root cause analysis)
    - Test-driven development workflows
    - Verification-before-completion checks
    - Implementation planning & code review skills

  Run /implement-feature after restarting to begin.
```

### 6.4 If declined

Output:
```
Skipped Superpowers installation.
You can install it later with:
  /plugin marketplace add obra/superpowers-marketplace
  /plugin install superpowers@superpowers-marketplace

Run /implement-feature to start orchestrated development.
```

**IMPORTANT**: Phase 6 is the LAST thing that happens. Do not run any other operations after the Superpowers install prompt. The user must restart their CLI before any superpowers-dependent features will work.
