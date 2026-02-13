# /scaffold-agent — Interactive Agent Definition Creator

> Invoke this skill to create a new specialist agent definition through interactive Q&A. Generates a fully structured `.claude/agents/<role>.md` file with the phased workflow, scoping, and domain rules.

---

## When to Use

- You want to create a new specialist agent without writing markdown from scratch
- You've identified a domain area that no existing agent covers
- You want to ensure the new agent follows the standard template structure

---

## Phase 1: Read Context

Before starting the Q&A, read:

1. `.claude/agents/` — list all existing agent definitions, read their Scope sections
2. `templates/docs/CREATING-AGENTS.md` (if installed) — agent creation guide
3. `{{PROJECT_RULES_FILE}}` — project rules for reference
4. `{{ARCHITECTURE_FILE}}` — project structure for scoping

Build a picture of:
- Which file patterns are already owned by existing agents
- Which areas of the codebase have no agent coverage
- What naming conventions existing agents follow

---

## Phase 2: Interactive Q&A

Ask the user a series of questions to define the agent. Use AskUserQuestion for each.

### Question 1: Role Name

```
What role should this agent have?

Examples: database-engineer, auth-engineer, worker-engineer, i18n-engineer

Naming convention:
- Use kebab-case
- Suffix coding agents with "-engineer"
- Suffix review agents with "-reviewer"
```

Let the user type a custom name.

### Question 2: Description

```
Describe what this agent does in one sentence.

Examples:
- "Handles database schema design, migrations, queries, and data integrity"
- "Manages authentication flows, session handling, and authorization rules"
- "Builds and maintains background worker processes and job queues"
```

### Question 3: File Scope

```
What files should this agent own? Use glob patterns.

Examples:
- src/workers/**/*.ts
- prisma/**, src/db/**
- src/**/auth*, src/**/login*, src/**/session*

Current coverage by existing agents:
<list existing agent scopes from Phase 1>
```

### Question 4: File Exclusions

```
What files should this agent NEVER modify?

Common exclusions:
- package.json, tsconfig.json (shared configs)
- src/components/** (owned by component-engineer)
- Files owned by other agents (listed above)

Or type "auto" to exclude all files owned by existing agents.
```

If the user types "auto", generate exclusions from the existing agents' scope patterns.

### Question 5: Domain-Specific Rules

```
List any hard rules specific to this agent's domain.
One rule per line. These become the "Rules — Non-Negotiable" section.

Examples:
- Never block the event loop — all I/O must be async
- Always implement graceful shutdown
- Always use structured logging — no console.log
- Always use parameterized queries — never string concatenation

Type "none" if no domain-specific rules are needed.
```

---

## Phase 3: Validate Against Existing Agents

Before generating, check for issues:

### Scope Overlap Check

Compare the new agent's file scope against every existing agent's scope:

```
Checking for scope overlaps...

<new-agent> scope: src/workers/**
  vs team-leader:       NO OVERLAP ✓
  vs qa-reviewer:       NO OVERLAP ✓ (read-only)
  vs codebase-guardian:  NO OVERLAP ✓ (read-only)
  vs service-engineer:  NO OVERLAP ✓
  vs component-engineer: NO OVERLAP ✓
```

If overlaps are found:

```
⚠ Scope overlap detected:

  <new-agent> scope:     src/services/worker-*.ts
  service-engineer scope: src/services/**

  These agents would both own files matching: src/services/worker-*.ts

Options:
  1. Narrow <new-agent> scope to exclude the overlap
  2. Narrow service-engineer scope to exclude worker files
  3. Keep the overlap (not recommended — may cause merge conflicts)
```

Use AskUserQuestion to resolve.

### Naming Check

Verify the role name doesn't conflict with existing agents:

```
Agent name "worker-engineer" is available. ✓
```

Or:

```
⚠ An agent named "worker-engineer" already exists.
  Choose a different name or update the existing agent instead.
```

---

## Phase 4: Generate Agent Definition

Create the agent file at `.claude/agents/<role-name>.md` using the standard template:

```markdown
# <Agent Role Name>

> <one-line description from Q&A>

---

## Identity

You are the <Agent Role Name>. You <description>. You do NOT <anti-responsibilities — inferred from scope>.

## Initialization Protocol

Before writing ANY code, read these in full:

1. `{{PROJECT_RULES_FILE}}` — Project rules and conventions
2. `{{ARCHITECTURE_FILE}}` — System architecture
3. `.claude/prompts/implementing-features/README.md` — Implementation playbook

## Scope — Files You Own

ONLY create/modify files matching:
<scope patterns from Q&A>

NEVER modify:
<exclusion patterns from Q&A>

## Mandatory Planning Gate

### PHASE 0: Load Rules
Read ALL files listed in the Initialization Protocol above. Do not skim.

### PHASE 1: Write Execution Plan [BLOCKING — do NOT write code yet]
Before writing ANY code, produce a written plan that includes:

1. **Task Summary** — restate the task in your own words
2. **Rules That Apply** — cite SPECIFIC rules from Phase 0 files by section
3. **Files I Will Create** — exact paths and purposes
4. **Files I Will Modify** — exact paths and what changes
5. **Files I Will NOT Touch** — adjacent files outside scope
6. **Step-by-Step Implementation Order** — numbered, specific steps
7. **Acceptance Criteria Check** — how you will satisfy each criterion
8. **Risk Assessment** — what could go wrong, how you will handle it

Output this plan BEFORE proceeding. Do NOT start coding until this plan is complete.

### PHASE 2: Execute Plan
Follow your Phase 1 plan step by step. State each step before executing.

### PHASE 3: Self-Review
Verify work against Phase 1 plan. Re-read plan, check every criterion, run automated checks.

## Error Recovery Protocol

When you encounter ANY error:

1. **STOP** — do not continue fixing blindly
2. **Re-read your Phase 1 plan** — this is your context anchor
3. **Classify** — is this error within your scope?
   - In scope, your file → fix (max 2 attempts)
   - In scope, not your file → report to Team Leader
   - Out of scope → ignore, continue with plan
4. **NEVER**:
   - Modify files outside your scope
   - Refactor unrelated code
   - Abandon your plan for tangential investigation
   - Spend more than 2 attempts on one error

## Quality Gates

Before marking work complete:
- [ ] All changes are within scope
- [ ] Lint passes — zero violations
- [ ] Type checking passes — zero errors
- [ ] Tests pass — all passing
- [ ] Build succeeds
- [ ] Acceptance criteria met
<domain-specific gates from Q&A, if any>

## Rules — Non-Negotiable

1. **Never modify files outside your scope** — report issues to Team Leader
2. **Always write your plan before coding** — Phase 1 is mandatory
3. **Always follow the Error Recovery Protocol** — no chasing errors
<domain-specific rules from Q&A>
```

---

## Phase 5: Summary & Next Steps

After generating the agent file:

```
✔ Created agent definition:
  .claude/agents/<role-name>.md

Agent Summary:
  Role:       <role name>
  Scope:      <scope summary>
  Exclusions: <exclusion summary>
  Rules:      <count> domain-specific rules

Next steps:
  1. Review the generated file and customize as needed
  2. Test the agent: spawn it on a small task to verify it follows the workflow
  3. Run /audit-agents to verify no scope overlaps with existing agents
  4. The Team Leader can now assign tasks to this agent in /implement-feature
```
