---
description: "Unified creation entry point — create a feature, plan, task, phase, agent, or idea from a single command"
---

# /new — Unified Creation Entry Point

> Invoke this skill to create any new workflow artifact: feature, phase, task, plan, agent, or idea. Parses your intent, loads context, and routes to the appropriate creation sub-flow.
>
> **Usage**: `/new <type> <description>` or `/new <bare description>` (type inferred)
>
> **Examples**:
> - `/new feature user authentication`
> - `/new task add password validation to auth service`
> - `/new idea real-time collaboration`
> - `/new agent database-engineer`
> - `/new plan notification system redesign`
> - `/new phase add caching layer to user-settings`

---

## When to Use / When NOT to Use

### Use When
- Starting any new piece of work (feature, task, phase, agent, plan, idea)
- You want a guided workflow that loads context before creating
- You're unsure which specific command to invoke

### Don't Use When
- Resuming existing work → use `/resume`
- Checking status → use `/status`
- Reviewing a PR → use `/review-pr`
- Running a full implementation → use `/new-feature` directly

---

## Phase 1: Parse Input & Determine Type

### Step 1: Extract Type and Description

Parse the user's input to determine the artifact type:

| Explicit Keyword | Maps To |
|-----------------|---------|
| `feature` | → Phase 3: Create Feature |
| `phase` or `wave` | → Phase 4: Add Phase |
| `task` | → Phase 5: Add Task |
| `plan` | → Phase 6: Create Plan |
| `agent` | → Phase 7: Scaffold Agent |
| `idea` or `backlog` | → Phase 8: Log Idea |

### Step 2: Inference for Bare Descriptions

If no explicit keyword is provided, infer the type using these signals:

| Signal | Inferred Type |
|--------|--------------|
| Description mentions a role name (e.g., "database engineer") | agent |
| Description starts with action verb + specific file/function | task |
| Active feature exists + description extends it | phase |
| Description is broad/strategic (e.g., "redesign the auth system") | feature |
| Description is exploratory/vague (e.g., "maybe we should try...") | idea |
| Description focuses on architecture/design (e.g., "plan out the API") | plan |

### Step 3: Ambiguity Resolution

If the type cannot be confidently determined, use AskUserQuestion:

```
AskUserQuestion:
  question: "What type of artifact should I create for '<description>'?"
  header: "Type"
  options:
    - label: "Feature"
      description: "New feature branch with full orchestration"
    - label: "Task"
      description: "Add a task to the active feature"
    - label: "Phase/Wave"
      description: "Add a new phase to the active feature"
    - label: "Plan"
      description: "Create a design document for analysis"
    - label: "Agent"
      description: "Scaffold a new agent definition"
    - label: "Idea"
      description: "Log to the ideas backlog for later"
```

---

## Phase 2: Load Context

Before executing any sub-flow, load shared context:

### Step 1: Read Project Configuration
1. Read the project rules file — project rules and conventions
2. Read the architecture file — system architecture (if it exists)

### Step 2: Scan for Active Features
1. Scan the progress directory for progress files
2. Identify any features with status `IN_PROGRESS` or `PLANNING`
3. If an active feature exists, read its progress file

### Step 3: Scan for Existing Agents
1. List files in `.claude/agents/`
2. Note existing agent roles to avoid conflicts

### Step 4: Check Ideas Backlog
1. Check if the progress directory contains `ideas-backlog.md`
2. If creating an idea, prepare to append to it

---

## Phase 3: Create Feature (sub-flow)

> Triggered by: `/new feature <name>` or inferred feature type

### Step 1: Validate Feature Name
- Convert description to kebab-case for branch name
- Check that no `feature/<name>` branch already exists
- Check that no progress file exists for this feature name

### Step 2: Create Feature Branch
```bash
git checkout main  # or master
git checkout -b feature/<feature-name>
```

### Step 3: Create Progress File
Create the progress file using the template from `prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md`.

Fill in:
- Feature name from the description
- Status: `PLANNING`
- Started: current timestamp
- Feature branch name

### Step 4: Create Stub Design Doc
Create a design doc in the progress directory with:

```markdown
# Design: <Feature Name>

---
status: DRAFT
feature: <feature-name>
created: <YYYY-MM-DD>
---

## Overview

<brief description from user input>

## Requirements

- [ ] <to be filled during planning>

## Technical Approach

<to be determined — run `/new-plan` for deep analysis>

## Task Decomposition

<to be determined — run `/new-feature` to decompose and execute>
```

### Step 5: Next Steps
Report what was created and suggest:
- Run `/new-plan "<feature-name>"` for deep technical analysis
- Run `/new-feature "<feature-name>"` to decompose and execute immediately

---

## Phase 4: Add Phase (sub-flow)

> Triggered by: `/new phase <description>` or inferred phase type

### Step 1: Find Active Feature
- Scan the progress directory for a feature with status `IN_PROGRESS`
- If multiple active features: ask user which one
- If no active feature: error — suggest `/new feature` first

### Step 2: Read Progress File
- Read the progress file for the active feature
- Identify the current wave structure and last wave number

### Step 3: Add New Phase
Append a new wave/task group to the progress file:

```markdown
---

## Wave <N+1>: <Phase Description>

> Added via /new phase

| Task | Agent Role | Files | Status | Dependencies |
|------|-----------|-------|--------|-------------|
| (to be decomposed) | | | PENDING | Wave <N> |

### Notes
- <description from user input>
- Dependencies: Requires Wave <N> completion
```

### Step 4: Update Dependency Graph
Add the new wave to the dependency graph section of the progress file.

### Step 5: Next Steps
Suggest:
- Decompose the phase into specific tasks with `/new task`
- Or let `/new-feature` handle decomposition automatically

---

## Phase 5: Add Task (sub-flow)

> Triggered by: `/new task <description>` or inferred task type

### Step 1: Find Active Feature
- Same as Phase 4 Step 1

### Step 2: Determine Task Details
Analyze the description to determine:
- **Agent role**: What type of specialist should handle this? (schema-designer, service-eng, component-eng, etc.)
- **File scope**: What files will be created/modified?
- **Wave placement**: Which wave does this belong in? (based on dependencies)

If details can't be inferred, ask:

```
AskUserQuestion:
  question: "What agent role should handle '<task description>'?"
  header: "Agent role"
  options:
    - label: "Auto-detect"
      description: "Infer from task description and file scope"
    - label: "Schema Designer"
      description: "Types, schemas, contracts"
    - label: "Service Engineer"
      description: "Business logic, services"
    - label: "Component Engineer"
      description: "UI components, pages"
```

### Step 3: Determine Dependencies
- Read the progress file for existing tasks
- Identify which tasks this new task depends on
- Identify which existing tasks depend on the files this task touches

### Step 4: Append Task to Progress File
Add to the appropriate wave section:

```markdown
### Task #<N>: <task name> [PENDING]
- **Agent**: <agent-role>
- **Workbranch**: work/<feature>/<task-slug>
- **Files to Create**: <list or "TBD">
- **Files to Modify**: <list or "TBD">
- **Blocked By**: <task IDs or "none">
- **Acceptance Criteria**:
  - [ ] <derived from description>
```

### Step 5: Create Team Task (if team active)
If a team is active (check `~/.claude/teams/` for the feature's team):
```
TaskCreate:
  subject: "<task name>"
  description: "<full task description with acceptance criteria>"
  activeForm: "Working on <task name>"
```
Then set dependencies with TaskUpdate if applicable.

### Step 6: Next Steps
Confirm the task was added and suggest reviewing the wave plan.

---

## Phase 6: Create Plan (sub-flow)

> Triggered by: `/new plan <description>` or inferred plan type

### Step 1: Create Design Doc
Create a design doc in the progress directory:

```markdown
# Design: <Plan Name>

---
status: DRAFT
created: <YYYY-MM-DD>
---

## Overview

<description from user input>

## Requirements

- [ ] <to be analyzed>

## Technical Approach

<to be determined>

## Open Questions

- <what needs investigation?>
```

### Step 2: Next Steps
Suggest running `/new-plan "<name>"` for deep technical analysis with codebase scanning.

---

## Phase 7: Scaffold Agent (sub-flow)

> Triggered by: `/new agent <role>` or inferred agent type

### Step 1: Pre-fill Role Info
From the description, extract:
- Agent role name (e.g., "database-engineer")
- Likely file scope (inferred from role)
- Likely skills (from skills.sh mapping)

### Step 2: Check for Scope Conflicts
Read existing agent definitions in `.claude/agents/`:
- Check if the role already exists
- Check if file scopes would overlap with existing agents
- If conflicts found, warn the user

### Step 3: Delegate to /new agent
Pass the pre-filled information to the `/new agent` sub-flow:

```
Invoke /new agent with pre-filled context:
- Role: <role-name>
- Suggested scope: <inferred file scope>
- Existing agents: <list of current agents>
- Potential conflicts: <any detected conflicts>
```

---

## Phase 8: Log Idea (sub-flow)

> Triggered by: `/new idea <description>` or inferred idea type

### Step 1: Create Backlog if First Use
If the progress directory does not contain `ideas-backlog.md`, create it using the template from `prompts/implementing-features/IDEAS-BACKLOG-TEMPLATE.md`.

### Step 2: Determine Metadata
Ask the user for priority (or default to UNSET):

```
AskUserQuestion:
  question: "What priority for this idea?"
  header: "Priority"
  options:
    - label: "HIGH"
      description: "Should be addressed soon"
    - label: "MEDIUM"
      description: "Important but not urgent"
    - label: "LOW"
      description: "Nice to have, someday"
    - label: "UNSET (Recommended)"
      description: "Decide priority later during planning"
```

Estimate size from description:
- Mentions single file/function → SMALL
- Mentions a module/service → MEDIUM
- Mentions a system/feature → LARGE
- Can't tell → UNKNOWN

### Step 3: Append Entry
Append to the ideas backlog:

```markdown
### <Idea Title>
- **Date**: <YYYY-MM-DD>
- **Priority**: <HIGH/MEDIUM/LOW/UNSET>
- **Size**: <SMALL/MEDIUM/LARGE/UNKNOWN>
- **Tags**: <inferred from description>
- **Status**: NEW
- **Notes**: <original description>
```

### Step 4: Confirm
Report the idea was logged and show current backlog count.

---

## Phase 9: Summary & Next Steps

After any sub-flow completes, provide a type-conditional summary:

| Type Created | Follow-Up Suggestions |
|-------------|----------------------|
| Feature | `/new-plan` for analysis, `/new-feature` to execute |
| Phase | `/new task` to decompose, `/new-feature` to execute |
| Task | `/status` to see updated plan, wait for Team Leader to assign |
| Plan | `/new-plan` for deep analysis |
| Agent | `/settings` to verify scopes, `/new` (discover mode) to check coverage |
| Idea | `/new idea` to log more, review backlog periodically |

Always show:
1. What was created (files, branches, entries)
2. Relevant next command(s)
3. Current state (active feature, task count, etc.)
