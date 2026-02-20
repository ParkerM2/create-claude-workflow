# Creating & Updating Agents

> Guide for creating new specialist agent definitions and maintaining existing ones. Every agent is a plain `.md` file in `agents/` — you own it, you can customize it.

---

## Table of Contents

1. [Agent Anatomy](#1-agent-anatomy)
2. [Creating a New Agent — Step by Step](#2-creating-a-new-agent--step-by-step)
3. [Updating an Existing Agent](#3-updating-an-existing-agent)
4. [Scoping Agents to Avoid Conflicts](#4-scoping-agents-to-avoid-conflicts)
5. [Naming Conventions](#5-naming-conventions)
6. [Skills Integration](#6-skills-integration)
7. [Testing Your Agent](#7-testing-your-agent)
8. [Common Patterns](#8-common-patterns)

---

## 1. Agent Anatomy

Every agent definition follows this structure. The phased workflow sections are the enforcement mechanism — they prevent agents from skipping planning, drifting off-task, or writing code before understanding the rules.

```markdown
# <Agent Role Name>

> One-line description: what this agent does and what it does NOT do.

---

## Identity

Who you are, what you do, what you DON'T do.
This section sets the agent's mental model of itself.

## Initialization Protocol

Files to read before starting ANY task:
1. `the project rules file` — Project rules and conventions
2. `the architecture file` — System architecture
3. Any domain-specific docs this agent needs

## Scope — Files You Own

ONLY create/modify files matching:
- <glob patterns>

NEVER modify:
- <glob patterns>

## Mandatory Planning Gate

Phase 0: Load rules (read all files, do not skim)
Phase 1: Write plan (cite specific rules, list files, steps, risks)
Phase 2: Execute (follow plan step by step)
Phase 3: Self-review (verify against plan)

## Error Recovery Protocol

What to do when things go wrong:
1. STOP — re-read Phase 1 plan
2. Classify — in scope or out of scope?
3. Fix (max 2 attempts) or report to Team Leader

## Quality Gates

Checks the agent runs before marking work complete:
- [ ] All changes within scope
- [ ] Lint/typecheck/test/build pass
- [ ] Acceptance criteria met

## Rules — Non-Negotiable

Hard constraints specific to this agent's domain.
```

### Required Sections

| Section | Required | Why |
|---------|----------|-----|
| Identity | Yes | Prevents agents from exceeding their role |
| Initialization Protocol | Yes | Ensures agents read project rules before coding |
| Scope | Yes | Prevents file conflicts between agents |
| Mandatory Planning Gate | Yes | Core enforcement mechanism |
| Error Recovery Protocol | Yes | Prevents agents from chasing errors endlessly |
| Quality Gates | Yes | Agents must self-verify before spawning QA |
| Rules | Yes | Domain-specific guardrails |

---

## 2. Creating a New Agent — Step by Step

### Step 1: Identify the Need

Ask yourself:
- What files or domain does no existing agent cover?
- Is this work distinct enough to warrant a separate agent?
- Would a single task assignment to an existing agent work instead?

**Good reasons to create an agent**:
- A new domain area with distinct file patterns (e.g., `src/workers/**`)
- A specialized skill set (e.g., database migrations, i18n)
- Recurring tasks that benefit from domain-specific rules

**Bad reasons**:
- A one-off task (use an existing agent with custom instructions)
- Overlapping scope with an existing agent (update the existing agent instead)

### Step 2: Define the Scope

Be specific about which files this agent owns:

```markdown
## Scope — Files You Own

ONLY create/modify files matching:
- src/workers/**/*.ts
- src/workers/**/*.test.ts
- src/types/worker-*.ts

NEVER modify:
- src/services/**          ← owned by service-engineer
- src/components/**        ← owned by component-engineer
- package.json             ← shared file, Team Leader only
- tsconfig.json            ← shared config
```

**Rules for good scoping**:
- Use glob patterns for broad ownership
- Use explicit exclusions for files near your scope boundary
- No two agents should own the same file
- Shared files (package.json, configs) should be off-limits or assigned to one specific agent

### Step 3: Write the Initialization Protocol

List the exact files this agent must read before starting:

```markdown
## Initialization Protocol

Before writing ANY code, read these in full:

1. `the project rules file` — Project rules and conventions
2. `the architecture file` — System architecture
3. `docs/WORKER-ARCHITECTURE.md` — Worker-specific design docs
4. `prompts/implementing-features/README.md` — Playbook
```

Include any domain-specific documentation. The more context the agent has, the better its Phase 1 plan will be.

### Step 4: Add Domain-Specific Quality Gates

Beyond the standard gates (lint, typecheck, test, build), add checks relevant to this domain:

```markdown
## Quality Gates

Before marking work complete:
- [ ] All changes within scope
- [ ] Lint/typecheck/test/build pass
- [ ] Worker properly handles graceful shutdown signals
- [ ] Worker has retry logic for transient failures
- [ ] Worker logs include correlation IDs
- [ ] No blocking I/O on the main worker thread
```

### Step 5: Add Domain-Specific Rules

These are hard constraints that override general conventions:

```markdown
## Rules — Non-Negotiable

1. **Never block the event loop** — all I/O must be async
2. **Always implement graceful shutdown** — handle SIGTERM and SIGINT
3. **Always use structured logging** — no console.log
4. **Never hardcode queue names** — use config/environment variables
5. **Always add dead-letter queue handling** — failed messages must not be lost
```

### Step 6: Save and Register

1. Save the file as `agents/<role-name>.md`
2. The agent is immediately available for spawning by the Team Leader
3. No other registration is needed — the Team Leader reads `agents/` to discover available agents

### Step 7: Update the Spawn Template (Optional)

If this agent needs a spawn template different from the standard one, add a section to `AGENT-SPAWN-TEMPLATES.md`. Most agents can use the Standard Coding Agent template as-is.

---

## 3. Updating an Existing Agent

### When to Update

- Project structure changed (new directories, renamed files)
- New conventions added to `the project rules file`
- New tools or dependencies introduced
- Agent consistently fails QA for the same reason (add a rule to prevent it)
- Agent scope needs to expand or contract

### What to Change

| Section | Safe to Change | Notes |
|---------|---------------|-------|
| Identity | Yes | Refine the role description |
| Initialization Protocol | Yes | Add/remove docs to read |
| Scope | Yes | Adjust file patterns |
| Planning Gate | **Careful** | Change prompts, keep the phase structure |
| Error Recovery | **Careful** | Adjust limits, keep the protocol |
| Quality Gates | Yes | Add/remove domain checks |
| Rules | Yes | Add/remove domain rules |

### What NOT to Change

- **Do not remove the phased workflow structure** — it is the enforcement mechanism
- **Do not remove Phase 1 (Write Plan)** — this is the primary drift-prevention tool
- **Do not remove the Error Recovery Protocol** — without it, agents chase errors indefinitely

### How to Test Changes

1. Spawn the agent on a small, well-defined task
2. Verify it produces a written plan in Phase 1 that cites the updated rules
3. Verify it stays within scope during Phase 2
4. Verify QA passes on the first round

---

## 4. Scoping Agents to Avoid Conflicts

### The Golden Rule

**No two agents should own the same file.**

If two agents can modify the same file, you will get merge conflicts. The entire branch-per-task model depends on file-level isolation.

### Scope Table

Maintain a mental (or documented) mapping of agent → files:

```
team-leader:        orchestration only (no application code)
schema-designer:    src/types/**, src/schemas/**
service-engineer:   src/services/**
api-engineer:       src/routes/**, src/handlers/**, src/middleware/**
component-engineer: src/components/**, src/pages/**
state-engineer:     src/store/**, src/hooks/**
test-engineer:      src/**/*.test.*, src/**/*.spec.*, tests/**
database-engineer:  prisma/**, db/**, src/db/**
qa-reviewer:        READ ONLY (+ docs on PASS)
codebase-guardian:  READ ONLY (+ trivial structural fixes)
```

### Handling Shared Files

Some files are legitimately shared (e.g., `src/types/index.ts`, `package.json`):

**Option A: Assign to one agent**
```markdown
# In schema-designer.md
Scope: src/types/** (including barrel exports)

# In service-engineer.md
NEVER modify: src/types/** (read-only for you)
```

**Option B: Off-limits for all agents**
```markdown
# In every agent's scope section
NEVER modify: package.json, tsconfig.json, .env
```

The Team Leader handles changes to off-limits files directly, or creates a specific task for one agent.

### Resolving Scope Overlaps

If you discover two agents claiming the same files:

1. Run `/settings` to identify overlaps
2. Decide which agent is the natural owner
3. Update the other agent's scope to exclude those files
4. Add explicit `NEVER modify` entries for clarity

---

## 5. Naming Conventions

### Agent File Names

- Use **kebab-case**: `component-engineer.md`, `database-engineer.md`
- Suffix coding agents with **`-engineer`**: `service-engineer`, `api-engineer`
- Suffix QA-like agents with **`-reviewer`**: `qa-reviewer`, `security-reviewer`
- Core agents use fixed names: `team-leader`, `qa-reviewer`, `codebase-guardian`

### Agent Role Names (Inside the File)

- Use **title case** in the Identity section: "Component Engineer", "Database Engineer"
- Use the role name consistently in prompts, progress files, and QA reports

### Don't Use Technology-Specific Names

```
Bad:  react-component-builder.md   ← locks you into React
Good: component-engineer.md        ← works for any UI framework

Bad:  prisma-migration-writer.md   ← locks you into Prisma
Good: database-engineer.md         ← works for any ORM/DB
```

Technology specifics go in the agent's Scope and Rules sections, not the file name.

---

## 6. Skills Integration

Agents can reference skills from the `skills.sh` marketplace:

```markdown
## Skills Integration

This agent benefits from installed skills:
- `npx skills add vercel-labs/agent-skills` — React best practices, composition patterns
- `npx skills add anthropics/skills` — Frontend design guidelines
```

### Default Skill Mappings

| Agent Role | Recommended Skills |
|------------|-------------------|
| component-engineer | `vercel-labs/agent-skills` (react-best-practices, web-design-guidelines) |
| mobile-engineer | `vercel-labs/agent-skills` (react-native-guidelines) |
| styling-engineer | `anthropics/skills` (frontend-design) |
| qa-reviewer | `anthropics/skills` (webapp-testing) |
| test-engineer | `anthropics/skills` (webapp-testing) |
| Any (if MCP detected) | `anthropics/skills` (mcp-builder) |

### Adding Custom Skills

If you publish or find skills relevant to an agent:

1. Add the skill reference to the agent's Skills Integration section
2. Install the skill: `npx skills add <publisher>/<skill-pack>`
3. The agent will automatically use the skill's guidelines during its planning phase

---

## 7. Testing Your Agent

### Quick Test

1. Create a small, focused task that exercises the agent's scope
2. Spawn the agent using the Standard Coding Agent template from `AGENT-SPAWN-TEMPLATES.md`
3. Watch for:
   - Does it read all initialization files?
   - Does it produce a written plan citing specific rules?
   - Does it stay within scope?
   - Does it follow the Error Recovery Protocol on errors?
   - Does QA pass on the first round?

### Red Flags

- Agent skips Phase 1 and starts coding immediately → Strengthen the planning gate prompt
- Agent modifies files outside its scope → Tighten the scope section and add explicit exclusions
- Agent fails QA repeatedly for the same reason → Add a rule addressing that specific issue
- Agent produces a vague plan ("follow all rules") → Add examples of specific rules to cite

### Iterating

Agent definitions are living documents. After each feature:
1. Review QA reports for patterns in failures
2. Check the performance log for recurring issues
3. Update the agent definition to address common problems
4. Run `/settings` periodically to catch scope drift

---

## 8. Common Patterns

### The "Read-Only + Docs" Pattern (QA Reviewer)

```markdown
## Scope
You REVIEW all changed files (read-only).
You MODIFY documentation files ONLY (and only on PASS).
```

Use for: QA agents, documentation agents, audit agents.

### The "Foundation Layer" Pattern (Schema Designer)

```markdown
## Scope
ONLY: src/types/**, src/schemas/**, src/contracts/**
NEVER: anything that imports from these files
```

Use for: agents that define contracts other agents consume. Always Wave 1.

### The "Integration Layer" Pattern (API Engineer)

```markdown
## Scope
ONLY: src/routes/**, src/handlers/**, src/middleware/**
NEVER: src/services/** (call them, don't modify them)
```

Use for: agents that wire together other layers. Usually Wave 3.

### The "Full Stack Narrow" Pattern (Auth Engineer)

```markdown
## Scope
ONLY: src/**/auth*, src/**/login*, src/**/session*
NEVER: anything not related to authentication
```

Use for: agents that own a vertical slice across multiple layers. Careful with scoping — must not overlap with layer-based agents.
