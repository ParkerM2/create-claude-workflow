---
description: "Deep technical planning — analyzes codebase, designs architecture, decomposes into agent-ready tasks with wave ordering"
---

# /create-feature-plan — Deep Technical Planning for /implement-feature

> Invoke this skill to produce an in-depth technical plan for a feature before handing it off to `/implement-feature`. Uses brainstorming, codebase analysis, and architectural thinking to create a design document that the Team Leader can execute directly — no interpretation needed.

---

## When to Use

- Before running `/implement-feature` on a complex or ambiguous feature
- When you have a feature idea but need to refine requirements and design
- When you want the Team Leader to receive a ready-made decomposition plan
- When the feature touches unfamiliar parts of the codebase and needs deep analysis first
- When conversation context contains scattered requirements that need consolidation

## When NOT to Use

- The feature is small and well-defined (just run `/implement-feature` directly)
- You already have a complete design document
- The task is a bug fix (use `/hotfix`) or restructuring (use `/refactor`)

---

## Phase 1: Gather Requirements

### 1a. Source the Feature Description

The feature description comes from one of these sources (check in order):

1. **The current prompt** — if the user included a feature description with this invocation
2. **Conversation context** — if the feature was discussed in earlier messages
3. **A referenced document** — if the user points to a design doc, issue, or spec

If the source is conversation context, consolidate all relevant details into a single requirements summary. Do not lose nuance from the discussion.

### 1b. Clarify Ambiguities

Use the AskUserQuestion tool to resolve any unknowns. Focus on questions that affect architecture or scope:

```
Questions to consider:
- What is the primary user-facing behavior this feature enables?
- Are there specific UI/UX requirements or wireframes?
- Which existing systems does this feature interact with?
- Are there performance requirements or constraints?
- Are there security or privacy implications?
- Should this feature be behind a feature flag?
- What is the expected data volume / scale?
- Are there any hard constraints on technology choices?
```

Only ask questions that you genuinely cannot answer from the codebase and conversation context. Do not ask questions you can resolve by reading code.

### 1c. Check for Prior Art

Before designing from scratch, check if similar patterns exist in the codebase:

```bash
# Search for related patterns, modules, or features
# Adapt search terms to the feature being planned
```

Read any related existing code to understand conventions, patterns, and integration points.

---

## Phase 2: Deep Codebase Analysis

### 2a. Load Project Context

Read these files to understand the full system:

```
1. the project rules file                                              — Project rules
2. the architecture file                                               — System architecture
3. prompts/implementing-features/README.md                     — Playbook (for plan format)
4. prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md       — Context estimation
5. prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md — Role-based QA
```

### 2b. Map the Impact Zone

Identify every part of the codebase this feature will touch:

1. **Data layer** — What types, schemas, or database changes are needed?
2. **Service layer** — What business logic needs to be created or modified?
3. **API layer** — What endpoints or handlers are needed?
4. **State layer** — What client state changes are needed?
5. **UI layer** — What components, pages, or views are needed?
6. **Infrastructure** — Any config, env, migration, or deployment changes?

For each layer, read the relevant existing files to understand:
- Current structure and conventions
- Integration points (what this feature will connect to)
- Existing patterns to follow (how similar things were done before)

### 2c. Map Dependencies

Build a dependency graph of the feature's components:

```
Which new code depends on which other new code?
Which new code depends on existing code?
Which existing code needs to be modified?
Are there any circular dependencies?
```

### 2d. Identify Available Agents

Read `.claude/agents/` to see which specialist agents exist:

```bash
ls .claude/agents/
```

For each agent, note its scope (file patterns) and capabilities. Map feature components to agents:

```
Component → Best Agent → Files
Types/schemas → schema-designer → src/types/...
Business logic → service-engineer → src/services/...
API handlers → api-engineer → src/routes/...
UI components → component-engineer → src/components/...
```

If a component needs an agent that doesn't exist, note it — suggest creating one or assigning to the closest match.

---

## Phase 3: Architectural Design

### 3a. Use Brainstorming Skills

If the Superpowers plugin is installed, invoke brainstorming to explore the design space:

```
Use the brainstorming skill to:
- Explore 2-3 architectural approaches
- Evaluate trade-offs (complexity, performance, maintainability)
- Select the best approach with justification
```

If Superpowers is not installed, perform the analysis manually:

1. **Approach A** — describe the approach, list pros/cons
2. **Approach B** — describe the approach, list pros/cons
3. **Selected approach** — which one and why

### 3b. Design the Data Model

If the feature introduces new data:

```
Define:
- Types/interfaces with field names, types, and descriptions
- Database schema changes (if applicable)
- API request/response shapes
- State shape (if client state is needed)

Show the actual type definitions you expect the implementation to produce.
```

### 3c. Design the API Surface

If the feature introduces new APIs or modifies existing ones:

```
For each endpoint/handler:
- Method and path (e.g., POST /api/settings)
- Request shape (body, params, query)
- Response shape (success and error)
- Auth requirements
- Validation rules
- Error scenarios
```

### 3d. Design the UI Flow

If the feature has UI components:

```
For each screen/component:
- Purpose and user interaction
- States: loading, empty, error, populated
- Data it needs (props, queries, state)
- Events it emits (actions, callbacks)
- Where it lives in the navigation/routing
```

### 3e. Design the Integration Points

Map how new code connects to existing code:

```
New → Existing connections:
- NewService calls ExistingRepository.findById()
- NewComponent uses existing useAuth() hook
- NewHandler validates with existing validateSchema()

Existing → New connections (if existing code needs modification):
- ExistingRouter adds route for NewHandler
- ExistingNavigation adds link to NewPage
```

---

## Phase 4: Task Decomposition

### 4a. Break Into Atomic Tasks

Decompose the feature into tasks that the Team Leader can assign directly. Each task MUST include:

```markdown
### Task #<N>: <task name>

**Agent**: <agent role from .claude/agents/>
**Wave**: <wave number>
**Blocked by**: <task numbers or "none">
**Estimated complexity**: LOW / MEDIUM / HIGH
**Context budget**: ~<N> tokens (files: <count>)

**Description**:
<detailed description of what to build — specific enough that the agent
doesn't need to make architectural decisions>

**Files to Create**:
- <exact path> — <purpose and what it contains>

**Files to Modify**:
- <exact path> — <what changes and why>

**Files to Read for Context**:
- <exact path> — <why the agent needs to read this>

**Acceptance Criteria**:
- [ ] <specific, verifiable criterion>
- [ ] <specific, verifiable criterion>
- [ ] Automated checks pass (lint, typecheck, test, build)

**QA Sections** (from auto-fill rules):
<list the QA checklist sections that apply to this agent role>

**Feature-Specific QA Checks**:
- [ ] <check specific to this task>
- [ ] <check specific to this task>

**Implementation Notes**:
<any specific guidance: patterns to follow, pitfalls to avoid,
existing code to reference>
```

### 4b. Validate Task Isolation

Verify that no two tasks modify the same file:

```
File Ownership Matrix:
  src/types/settings.ts      → Task #1 (schema-designer)
  src/services/settings.ts   → Task #2 (service-engineer)
  src/routes/settings.ts     → Task #3 (api-engineer)
  src/components/Settings.tsx → Task #4 (component-engineer)
  ...

Conflicts: NONE
```

If conflicts exist, restructure tasks to eliminate them.

### 4c. Estimate Context Budget

For each task, apply the estimation formula:

```
Base overhead (8,000) + files x 1,000 + margin (3,000) = estimated tokens

Task #1: 8,000 + 3 x 1,000 + 3,000 = ~14,000 tokens
Task #2: 8,000 + 7 x 1,000 + 3,000 = ~18,000 tokens (at threshold)
Task #3: 8,000 + 15 x 1,000 + 3,000 = ~26,000 tokens (must split)
```

Split any task that exceeds ~18,000 tokens.

---

## Phase 5: Wave Planning

### 5a. Assign Waves

Group tasks into dependency-ordered waves:

```markdown
## Wave Plan

### Wave 1: Foundation (no blockers)
- Task #1: Define types and schemas — schema-designer
- Task #2: Create database migration — database-engineer

### Wave 2: Business Logic (blocked by Wave 1)
- Task #3: Implement settings service — service-engineer

### Wave 3: Integration (blocked by Wave 2)
- Task #4: Create API handlers — api-engineer
- Task #5: Create state management — state-engineer
  (Tasks #4 and #5 touch different files — can run in parallel)

### Wave 4: Presentation (blocked by Wave 3)
- Task #6: Build settings page — component-engineer
```

### 5b. Visualize Dependencies

```
#1 Types ─────┐
              ├──> #3 Service ──> #4 API ──────┐
#2 Migration ─┘                  #5 State ──┐  ├──> #6 UI
                                            └──┘
```

### 5c. Identify Parallel Opportunities

Within each wave, note which tasks can run simultaneously:
- Tasks in the same wave that touch **different files** can run in parallel
- Tasks in the same wave that share read-only dependencies can run in parallel
- Tasks that share writable files CANNOT run in parallel (restructure if found)

---

## Phase 6: Risk Assessment

### 6a. Technical Risks

For each identified risk:

```markdown
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema migration breaks existing data | Low | High | Write reversible migration, test with prod-like data |
| New API conflicts with existing routes | Medium | Medium | Check route table before implementation |
| UI state management adds complexity | Low | Low | Follow existing patterns, avoid new state libraries |
```

### 6b. Scope Risks

```markdown
| Risk | Mitigation |
|------|----------|
| Feature may grow beyond initial scope | Acceptance criteria are specific and bounded |
| Task #3 may be too large for one context | Already checked — context budget is ~14K, under threshold |
| Missing test coverage in adjacent modules | QA will catch, but note for Team Leader awareness |
```

### 6c. Integration Risks

```markdown
| Risk | Mitigation |
|------|----------|
| Wave 3 depends on Wave 1+2 types being correct | Schema task includes comprehensive type tests |
| Multiple agents editing adjacent files | File ownership matrix verified — no overlaps |
```

---

## Phase 7: Generate Design Document

Compile everything into a single design document saved to disk. This is the artifact that `/implement-feature` will consume.

### Output Location

Save to the progress directory as `<feature-name>-design.md`.

### Document Format

```markdown
# Feature Design: <Feature Name>

**Author**: /create-feature-plan
**Created**: <YYYY-MM-DD>
**Status**: READY FOR IMPLEMENTATION
**Workflow Mode**: <strict|standard|fast>

---

## 1. Overview

<2-3 paragraph summary of the feature, its purpose, and its scope>

## 2. Requirements

<consolidated requirements from Phase 1>

### Functional Requirements
- <requirement 1>
- <requirement 2>

### Non-Functional Requirements
- <performance, security, accessibility, etc.>

### Out of Scope
- <explicitly excluded items>

## 3. Architecture

### Selected Approach
<description of chosen approach with justification>

### Data Model
<type definitions, schema changes>

### API Surface
<endpoints, request/response shapes>

### UI Flow
<component hierarchy, user interactions, states>

### Integration Points
<new → existing and existing → new connections>

## 4. Task Breakdown

<full task decomposition from Phase 4a, with all fields>

## 5. Wave Plan

<wave assignments from Phase 5a>

### Dependency Graph
<visualization from Phase 5b>

### Parallel Opportunities
<notes from Phase 5c>

## 6. File Ownership Matrix

<from Phase 4b — every file mapped to exactly one task>

## 7. Context Budget

<from Phase 4c — estimation per task>

## 8. Risk Assessment

<from Phase 6 — technical, scope, and integration risks>

## 9. QA Strategy

### Per-Task QA Sections
<from Phase 4a — auto-fill sections per task>

### Feature-Specific QA Checks
<consolidated list of feature-specific checks across all tasks>

### Guardian Focus Areas
<specific structural concerns for the final Guardian check>

## 10. Implementation Notes

<any additional guidance for the Team Leader:
 - Patterns to follow from existing code
 - Known gotchas in adjacent systems
 - Configuration or environment changes needed
 - Migration or deployment considerations>
```

---

## Phase 8: Handoff

After saving the design document, present a summary to the user:

```
═══════════════════════════════════════════════════════════
  FEATURE PLAN READY
═══════════════════════════════════════════════════════════

  Feature:      <feature name>
  Design Doc:   <progress directory>/<feature-name>-design.md
  Tasks:        <count>
  Waves:        <count>
  Agents:       <list of agent roles needed>
  Mode:         <strict|standard|fast>

  ─── Task Summary ───────────────────────────────────────

  Wave 1: <task count> tasks (<agent roles>)
  Wave 2: <task count> tasks (<agent roles>)
  ...

  ─── Risks ──────────────────────────────────────────────

  <count> technical, <count> scope, <count> integration

═══════════════════════════════════════════════════════════

  To implement this feature, run:

    /implement-feature "<feature name>"

  The Team Leader will read the design document and
  use it as the decomposition plan — skipping the
  analysis work because /create-feature-plan already did it.
═══════════════════════════════════════════════════════════
```

### Updating /implement-feature to Use the Design Doc

The design document is automatically discovered by `/implement-feature` Phase 1:

> "If a design document or spec exists for this feature, read it too."

The Team Leader reads the design doc during Phase 0 (Load Rules) and uses it as its decomposition plan in Phase 1 (Write Decomposition Plan) — skipping the analysis work because `/create-feature-plan` already did it.

The Team Leader SHOULD:
1. Read the design doc
2. Verify the plan is still valid (no code changes since the plan was written)
3. Use the task breakdown, wave plan, and file ownership exactly as specified
4. Add the design doc path to the progress file
5. Proceed to Phase 4 (Create Feature Branch)

The Team Leader MAY:
- Adjust the plan if the codebase changed since the plan was written
- Split tasks further if context budget estimates were optimistic
- Ask the user for clarification if the plan has ambiguities

The Team Leader MUST NOT:
- Ignore the design doc and re-plan from scratch
- Change the architectural approach without user approval
- Skip tasks or merge tasks without updating the plan

---

## Quick Reference — Design Doc Checklist

Before saving the design document, verify:

- [ ] All requirements are captured (nothing lost from conversation/prompt)
- [ ] Architecture section includes data model, API, UI, and integration points
- [ ] Every task has: description, agent, wave, files, acceptance criteria, QA sections
- [ ] No two tasks modify the same file (file ownership matrix verified)
- [ ] All tasks are under context budget threshold
- [ ] Dependencies are correct (no circular dependencies, waves ordered properly)
- [ ] Risks are identified with mitigations
- [ ] QA strategy covers both per-task checks and feature-specific checks
- [ ] Design doc path follows the convention: `<progress directory>/<feature-name>-design.md`
