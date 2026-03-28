---
name: start-sprint
description: "Sprint kickoff orchestration — fetches Jira tickets, spawns parallel research agents, assesses difficulty 1-5, generates plans for easy-medium tickets, flags hard ones for human review"
---

# /start-sprint — Sprint Kickoff Orchestration

> Team Leader agent that orchestrates a full sprint kickoff: fetches all Jira tickets, spawns parallel research agents, assesses difficulty, and generates implementation plans for Level 1-3 tickets. Level 4-5 tickets are flagged for human review. You do NOT perform research — you only orchestrate.

## COMMAND OVERVIEW

The `/start-sprint` command is the **central orchestration hub** for sprint kickoff. It acts as a **Team Leader** agent that:

1. **Fetches** all tickets from the active Jira sprint
2. **Spawns research agents in parallel** to deeply analyze each ticket
3. **Assesses difficulty** of each ticket based on research findings
4. **Generates plans in parallel** for tickets rated LOW-MEDIUM difficulty
5. **Produces a sprint summary dashboard** with actionable next steps

The command **never performs research itself** — it only orchestrates, collects results, and synthesizes summaries.

---

## PHASE 1: SPRINT INTAKE

### 1.1 Memory System & Sprint Context

Before starting, verify or establish sprint context:

```yaml
# .claude/.memory/sprint-context.json (managed by memory system)
{
  "active_sprint_id": "SPRINT-42",
  "active_sprint_name": "Q1 2026 Sprint 2",
  "jira_board_id": "123",
  "jira_project_key": "DEV",
  "confluence_space_key": "DEV",
  "start_timestamp": "2026-03-27T09:00:00Z",
  "agent_team_size": 0,  # Updated as agents spawn
  "max_parallel_agents": 20
}
```

**Action**: If sprint context missing, prompt user to:
- Run `/connect-atlassian` to link Jira
- Provide Jira board ID and project key
- Select active sprint from available sprints list

### 1.2 Identify Active Sprint (CRITICAL: Sprint Scope Filtering)

**You MUST identify and filter to the active sprint. Never fetch the full backlog or future sprint tickets.**

Step 1: Fetch all sprints for the board and identify the ACTIVE one:

```
jira_get_sprints_from_board(boardId: <board_id>)
```

From the response, find the sprint where `state == "active"`. If multiple active sprints exist (rare), present them to the user and ask which one. If NO active sprint exists, check for the next `future` sprint and ask if they want to kick off that one.

**Sprint state meanings:**
- `active` — Currently in progress (this is what we want)
- `future` — Planned but not started
- `closed` — Completed

```
# CORRECT: Filter to active sprint only
active_sprint = sprints.find(s => s.state === "active")

# WRONG: Using all sprints or board-level queries that return backlog
# jira_get_board_issues() ← DO NOT USE — returns ALL board tickets including backlog
```

Step 2: Fetch ONLY tickets assigned to the active sprint:

```
jira_get_sprint_issues(sprintId: <active_sprint.id>) → Fetch ONLY this sprint's tickets
```

**IMPORTANT**: `jira_get_sprint_issues` returns only tickets IN that specific sprint. This excludes backlog items, future sprint items, and tickets from closed sprints. This is the correct tool. Do NOT use `jira_get_board_issues` or `jira_search` with broad JQL — those return the entire board/backlog.

Step 3: For each ticket in the active sprint, fetch full details:

```
jira_get_issue(ticketId) → Get full details
jira_get_comments(ticketId) → Get discussion context
```

Step 4: Validate sprint scope — after fetching, verify:
- Every ticket has a `sprint` field matching the active sprint ID
- No backlog-only tickets leaked in (check for `sprint == null`)
- Log warning if ticket count seems unusually high (> 30 tickets may indicate scope leak)

```
# Validation JQL (use as sanity check, not primary query)
sprint = <active_sprint_id> AND project = <PROJECT_KEY>
```

**Metadata to extract per ticket**:
- `ticket_id`, `summary`, `description`, `acceptance_criteria`
- `story_points`, `priority`, `status`, `labels`
- `linked_issues`, `assignee`, `reporter`
- `issue_type` (Story/Task/Bug/Spike)
- `sprint` (verify it matches active sprint — reject if it doesn't)
- `linked_pages` (Confluence references in description)

### 1.3 Create Ticket Directories

For each ticket, create:

```
.claude/progress/<TICKET_ID>/
├── sprint-metadata.json          # Ticket context (created here)
├── initial-research-findings.md  # (created in Phase 2)
├── plans/                        # (created in Phase 4)
├── tasks/                        # (created in Phase 4)
└── events.jsonl                  # Append-only event log
```

**File: `sprint-metadata.json`**

```json
{
  "ticket_id": "DEV-1234",
  "summary": "Implement dark mode toggle in settings",
  "description": "Users need ability to toggle dark mode...",
  "acceptance_criteria": [
    "Dark mode persists across sessions",
    "All UI components support dark mode",
    "Lighthouse accessibility score >= 95"
  ],
  "story_points": 8,
  "priority": "HIGH",
  "issue_type": "Story",
  "status": "TO_DO",
  "labels": ["frontend", "ui", "accessibility"],
  "linked_issues": ["DEV-1233", "DEV-1235"],
  "linked_confluence_pages": [
    { "page_id": "CONF-567", "title": "Design System Dark Theme" }
  ],
  "assignee": null,
  "reporter": "alice@company.com",
  "created_at": "2026-03-20T14:22:00Z",
  "sprint_start": "2026-03-27T09:00:00Z",
  "sprint_end": "2026-04-10T17:00:00Z",
  "difficulty_rating": null,  # Set in Phase 3
  "research_complete": false,  # Set in Phase 2
  "plan_complete": false       # Set in Phase 4
}
```

### 1.4 Verification Checkpoint: Phase 1

**Checklist before proceeding to Phase 2**:

```
✓ [ ] Jira connection verified
✓ [ ] Active sprint identified (show: sprint name, start/end dates)
✓ [ ] All ticket metadata fetched (show: ticket count, story point total)
✓ [ ] All ticket directories created in .claude/progress/
✓ [ ] Sprint metadata files written for each ticket
✓ [ ] Events.jsonl logs created
```

**Summary to display**:

```
📋 SPRINT INTAKE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sprint: Q1 2026 Sprint 2 (8 days remaining)
Tickets: 12 total, 47 story points
├─ Story: 8
├─ Task: 3
└─ Bug: 1

Ticket Categories:
├─ Frontend: 4
├─ Backend: 5
└─ DevOps: 3

Next Phase: PARALLEL RESEARCH (spawning 12 agents)
Estimated time: 3-5 minutes

Proceeding to Phase 2...
```

---

## PHASE 2: PARALLEL RESEARCH

### 2.1 Team Leader Orchestration

The Team Leader (command runner) now spawns ONE research agent per ticket, all in parallel.

**Constraint**: Batch spawn in groups of 4-5 agents per API call (to respect rate limits). Collect results sequentially.

**Spawn template for each ticket**:

```
Agent.spawn({
  description: "Research ticket DEV-1234: Implement dark mode toggle",
  prompt: `
ROLE: Research Agent for Sprint Planning
TICKET_ID: DEV-1234
TICKET_SUMMARY: Implement dark mode toggle in settings

You are a specialized research agent. Your job is to deeply analyze this ticket and produce comprehensive research findings that will inform difficulty assessment and planning.

INSTRUCTIONS:
1. READ TICKET DETAILS from .claude/progress/DEV-1234/sprint-metadata.json
2. CODEBASE ANALYSIS:
   - Search for existing dark mode implementations
   - Locate settings page component files
   - Identify theme-related utilities, styles, context stores
   - Map component dependencies
3. CONFLUENCE RESEARCH:
   - Fetch linked pages (especially "Design System Dark Theme")
   - Extract design specs, color palettes, accessibility requirements
4. EXTERNAL RESEARCH:
   - Check documentation for any theme libraries (if applicable)
   - Research best practices for accessibility in dark mode
5. ANALYZE LINKED ISSUES:
   - Review related tickets (DEV-1233, DEV-1235)
   - Understand dependencies and integration points
6. PRODUCE RESEARCH FINDINGS:
   - Create .claude/progress/DEV-1234/initial-research-findings.md
   - Include: scope, affected files, dependencies, risks, complexity signals

OUTPUT REQUIREMENTS:
- File: .claude/progress/DEV-1234/initial-research-findings.md
- Format: Markdown with structured sections (see schema below)
- Tone: Technical, evidence-based, actionable
  `,
  subagent_type: "general-purpose",
  model: "sonnet",
  isolation: "worktree"
})
```

### 2.2 Research Findings Schema

Each agent produces: `initial-research-findings.md`

```markdown
# Research Findings: DEV-1234
**Ticket**: Implement dark mode toggle in settings
**Researcher**: Agent-001
**Timestamp**: 2026-03-27T09:15:00Z
**Confidence**: HIGH (verified findings with code review)

---

## SUMMARY
2-3 sentence executive summary of what needs to be done and why it's complex or simple.

---

## SCOPE ANALYSIS

### Affected Components
- Settings page (`src/pages/Settings.tsx`)
- Theme context (`src/context/ThemeContext.tsx`)
- Style utilities (`src/styles/theme.ts`)
- Dark mode CSS (`src/styles/dark.css`)
- Components: Button, Card, Input, Navbar (12 total)

### Files to Modify
**Count**: 18 files
**By type**:
- React components: 10
- Styles/CSS: 5
- Context/state: 2
- Tests: 1

### File Risk Assessment
```
HIGH RISK (core files):
  - src/context/ThemeContext.tsx (existing theme system)
  - src/App.tsx (root component)

MEDIUM RISK (component updates):
  - src/components/ (12 files to update)

LOW RISK (tests, docs):
  - src/__tests__/ (1 file)
```

---

## DEPENDENCY ANALYSIS

### Internal Dependencies
- Existing theme system via ThemeContext (already supports light mode)
- Tailwind CSS with custom config (no dark mode config yet)
- Redux store (for user preferences persistence)
- localStorage for theme persistence

### External Dependencies
- Tailwind CSS v3.3 (already has dark mode support built-in)
- No new npm dependencies required

### Integration Points
- Settings page: Route `/settings` (exists)
- Redux store: `user/preferences` (exists)
- localStorage: `app-theme` (key)

---

## COMPLEXITY SIGNALS

### Positive Signals (reduces complexity)
✓ Existing theme context infrastructure in place
✓ Tailwind CSS natively supports dark mode
✓ Component structure is consistent and modular
✓ No new external libraries needed
✓ Redux store already exists for persistence

### Risk Signals (increases complexity)
⚠ 12 components need CSS-in-JS updates (manual review needed)
⚠ Accessibility: WCAG AA contrast requirements for all colors
⚠ No existing dark mode color palette defined (needs design)
⚠ Testing required on 5+ browsers (Safari dark mode quirks)
⚠ Database migration for user preferences (if not already flexible)

---

## DESIGN & SPECIFICATION GAPS

**From Confluence "Design System Dark Theme" page**:
- Color palette defined: 12 primary colors + semantics
- Typography: No changes needed (accessible contrast verified)
- Components requiring custom styling: Modal, Dropdown (3 total)

**Missing specs**:
- Animation preferences (respects prefers-reduced-motion?)
- Transition timing for theme switch
- Icon behavior in dark mode (some icons need inversion)

---

## ESTIMATED FILE IMPACT

| Category | Count | Avg Lines Changed | Total Est. LOC |
|----------|-------|-------------------|----------------|
| Components | 10 | 15-30 | 150-300 |
| Styles | 5 | 50-100 | 250-500 |
| Context/Store | 2 | 20-40 | 40-80 |
| Tests | 1 | 30 | 30 |
| **TOTAL** | **18** | — | **470-910** |

---

## DEPENDENCIES & BLOCKERS

### Hard Blockers
- ❌ None identified

### Soft Blockers
- ⚠ Design specs (exists in Confluence, but needs review)
- ⚠ Brand color palette for dark mode (may need design team review)

### Related Tickets
- **DEV-1233**: "Refactor ThemeContext" (dependency — review first)
- **DEV-1235**: "Add system preference detection" (should be done together)

---

## RESEARCH RECOMMENDATIONS

### Phase 1: Intake (pre-planning)
1. Review DEV-1233 status — may affect our approach
2. Verify Tailwind dark mode is enabled in `tailwind.config.js`
3. Confirm localStorage structure in current codebase

### Phase 2: Planning (before starting dev)
1. Create exact dark mode color palette file
2. Design testing matrix (browsers, OS, accessibility)
3. Write component update checklist

### Phase 3: Development
1. Start with ThemeContext (enables all downstream components)
2. Update components in groups (buttons, inputs, containers)
3. Add dark mode tests incrementally
4. Accessibility audit before code review

---

## EVIDENCE & REFERENCES

**Codebase Search Results**:
```
grep -r "ThemeContext" src/
  src/context/ThemeContext.tsx (exported, 145 lines)
  src/App.tsx (imported, line 22)
  src/pages/Settings.tsx (imported, line 5)

grep -r "dark:" src/
  src/styles/tailwind.config.js (exists, checking dark mode config)
  → dark mode config: NOT YET CONFIGURED
```

**Confluence Reference**:
- Page: "Design System Dark Theme" (CONF-567)
- Status: PUBLISHED
- Color palette: 12 colors defined
- Last updated: 2026-02-15

---

## CONFIDENCE LEVELS

| Finding | Confidence | Notes |
|---------|-----------|-------|
| File count (18) | 95% | Verified via grep + visual code review |
| Tailwind dark mode support | 100% | Built-in feature, v3.3+ |
| Accessibility risks | 85% | Standard dark mode risks, no unusual factors |
| Design spec completeness | 75% | Specs exist but may need small updates |
| Timeline estimate | 60% | High variance due to testing requirements |

---

## NEXT STEPS FOR PLANNING

**Recommended for Plan Generation**:
- [x] Proceed to plan generation (sufficient clarity)
- [ ] Flag for human review (insufficient information)
- [ ] Spike needed (unknowns blocking planning)

**Key assumptions made**:
1. ThemeContext is flexible enough for dark mode
2. No major API changes required
3. Accessibility testing can be done in-sprint
4. Design specs are sufficient (may need minor updates)

---

## AGENT NOTES

- Search method: grep for theme-related files, then visual inspection
- Confluence fetch: Used confluence_get_page("CONF-567")
- Linked tickets: Verified DEV-1233 and DEV-1235 exist, pulled summaries
- Codebase scan depth: 2 levels (components, utilities, context)
- Total research time: ~3 minutes
```

### 2.3 Agent Spawning Batches

**Batch 1-N**: Spawn research agents in groups of 4-5

```
Spawn 4 research agents (DEV-1234, DEV-1235, DEV-1236, DEV-1237) in parallel
↓ Wait for all 4 to complete
Spawn 4 more research agents (DEV-1238, DEV-1239, DEV-1240, DEV-1241)
↓ Wait for all 4 to complete
[Continue until all tickets researched]
```

### 2.4 Error Handling: Research Phase

**If a research agent fails**:

1. **Immediate retry** (once only):
   - Re-spawn agent with same prompt
   - Wait 30 seconds, then try again

2. **If retry fails**:
   - Mark ticket as `research_failed: true` in sprint-metadata.json
   - Append to events.jsonl: `{"type": "research_failed", "ticket": "DEV-1234", "error": "Agent timeout", "timestamp": "..."}`
   - Flag ticket for human review in Phase 3

3. **Collect partial results**:
   - If only some agents fail, continue to Phase 3 with available findings
   - Phase 3 will mark failed-research tickets as `needs_human_review: true`

### 2.5 Verification Checkpoint: Phase 2

**Checklist before proceeding to Phase 3**:

```
✓ [ ] All research agents spawned and completed (show: success rate %)
✓ [ ] initial-research-findings.md created for each ticket
✓ [ ] Events.jsonl updated with research completion timestamps
✓ [ ] No agents still running (wait if needed)
```

**Summary to display**:

```
🔬 PARALLEL RESEARCH COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tickets researched: 12/12 (100%)
Research agents: 12 spawned, 12 completed, 0 failed
Total time: 4m 23s
Agent batches: 3 waves

Research Summary:
├─ Low complexity signals: 4 tickets
├─ Medium signals: 5 tickets
├─ High complexity signals: 3 tickets
└─ Blockers found: 1 (soft blocker in DEV-1233)

Next Phase: DIFFICULTY ASSESSMENT
Proceeding to Phase 3...
```

---

## PHASE 3: DIFFICULTY ASSESSMENT

### 3.1 Difficulty Rubric

**Scale: 1-5** (used for sprint planning, not for task breaking)

The Team Leader reads each `initial-research-findings.md` and assigns difficulty using:

#### Level 1: TRIVIAL
- **Characteristics**: Single file, no dependencies, obvious solution
- **Scope**: < 50 LOC
- **Examples**: Config change, copy update, single utility function, rename
- **Risk**: None
- **Files affected**: 1-2
- **Complexity signals**: None
- **Time estimate**: < 2 hours

#### Level 2: EASY
- **Characteristics**: Well-understood pattern, minimal design decisions
- **Scope**: 50-200 LOC
- **Examples**: Add feature flag, simple form field, new utility function, small component
- **Risk**: Low (existing patterns)
- **Files affected**: 2-4
- **Complexity signals**: 0-2 minor signals
- **Time estimate**: 2-4 hours

#### Level 3: MEDIUM
- **Characteristics**: Multiple files, some design decisions, standard patterns
- **Scope**: 200-500 LOC
- **Examples**: New component with integration, API endpoint, refactoring, performance optimization
- **Risk**: Medium (requires testing, integration points)
- **Files affected**: 4-8
- **Complexity signals**: 2-4 signals
- **Time estimate**: 4-8 hours (1 day)

#### Level 4: HARD
- **Characteristics**: Cross-cutting concerns, new patterns, external integrations
- **Scope**: 500-1000 LOC
- **Examples**: System redesign, major refactor, new architecture, complex state management
- **Risk**: High (affects multiple systems, needs QA)
- **Files affected**: 8-15
- **Complexity signals**: 4-6 signals
- **Time estimate**: 8-16 hours (2 days)
- **Action**: **FLAG FOR HUMAN REVIEW** (no automatic planning)

#### Level 5: VERY HARD
- **Characteristics**: Architectural changes, performance-critical, high risk
- **Scope**: 1000+ LOC
- **Examples**: Major system redesign, migration, security overhaul, performance rewrite
- **Risk**: Very High (affects product, performance, security)
- **Files affected**: 15+ files or core files
- **Complexity signals**: 6+ signals
- **Time estimate**: 16+ hours (3+ days)
- **Action**: **FLAG FOR HUMAN REVIEW** (require spike/design review)

### 3.2 Difficulty Assessment Algorithm

For each ticket's research findings:

```python
def assess_difficulty(research_findings):
    signals = count_complexity_signals(research_findings)
    files_affected = count_files_affected(research_findings)
    scope_loc = estimate_loc(research_findings)
    risk_level = assess_risk(research_findings)

    # Primary factors
    if scope_loc < 50 and files_affected <= 2:
        base_difficulty = 1
    elif scope_loc < 200 and files_affected <= 4:
        base_difficulty = 2
    elif scope_loc < 500 and files_affected <= 8:
        base_difficulty = 3
    elif scope_loc < 1000 and files_affected <= 15:
        base_difficulty = 4
    else:
        base_difficulty = 5

    # Adjust based on signals
    signal_adjustment = {
        0: 0,
        1: 0,
        2: 0,
        3: +1,
        4: +1,
        5: +1,
        6: +2
    }.get(signals, +2)

    # Adjust based on risk
    if risk_level == "very_high":
        signal_adjustment += 1
    elif risk_level == "high":
        signal_adjustment += 1

    final_difficulty = min(5, max(1, base_difficulty + signal_adjustment))
    return final_difficulty
```

### 3.3 Assessment Output

Update `sprint-metadata.json` with:

```json
{
  "difficulty_rating": 3,
  "difficulty_justification": {
    "primary_factors": {
      "estimated_loc": 350,
      "files_affected": 6,
      "complexity_signals": 3
    },
    "risk_assessment": "medium",
    "blocking_issues": ["soft blocker in DEV-1233"],
    "recommended_action": "proceed_to_planning",
    "reasoning": "Standard pattern, multiple integration points, but well-understood scope. Sufficient clarity for planning."
  },
  "assessed_at": "2026-03-27T09:45:00Z",
  "assessed_by": "team-lead"
}
```

### 3.4 Human Review Flagging

For tickets rated 4-5:

```json
{
  "difficulty_rating": 4,
  "needs_human_review": true,
  "human_review_reason": "High complexity with cross-cutting concerns. Needs architect review.",
  "review_checklist": [
    "Verify design approach with tech lead",
    "Assess impact on performance/security",
    "Determine if spike is needed",
    "Reassess scope or break into sub-tickets"
  ],
  "assessed_at": "2026-03-27T09:45:00Z"
}
```

Append to events.jsonl:

```json
{"type": "difficulty_assessment", "ticket": "DEV-1240", "difficulty": 4, "flagged_for_review": true, "reason": "High complexity, needs architect input", "timestamp": "2026-03-27T09:45:00Z"}
```

### 3.5 Verification Checkpoint: Phase 3

**Checklist before proceeding to Phase 4**:

```
✓ [ ] All tickets assessed for difficulty (show: distribution)
✓ [ ] Sprint-metadata.json updated with difficulty_rating
✓ [ ] High-risk tickets (4-5) flagged for human review
✓ [ ] Events.jsonl updated with assessment results
```

**Summary to display**:

```
📊 DIFFICULTY ASSESSMENT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Distribution:
  Level 1 (Trivial):    1 ticket  (8%)
  Level 2 (Easy):       4 tickets (33%)
  Level 3 (Medium):     5 tickets (42%)
  Level 4 (Hard):       2 tickets (17%) ⚠️ REVIEW NEEDED
  Level 5 (Very Hard):  0 tickets (0%)

Tickets requiring human review: 2
  ├─ DEV-1240: "Database migration" (Level 4)
  └─ DEV-1243: "Auth system redesign" (Level 4)

Estimated sprint capacity: 47 points
  ├─ Can plan: 10 tickets (Level 1-3) = 32 points
  └─ Needs review: 2 tickets = 15 points

Next Phase: PARALLEL PLAN GENERATION (for Level 1-3 tickets)
Proceeding to Phase 4...
```

---

## PHASE 4: PARALLEL PLAN GENERATION

### 4.1 Plan Generation Agent Spawning

For tickets rated 1-3 (only), spawn planning agents in parallel.

**Constraint**: Spawn in batches of 4-5, similar to research phase.

**Spawn template for each eligible ticket**:

```
Agent.spawn({
  description: "Plan generation for DEV-1234: Implement dark mode toggle",
  prompt: `
ROLE: Planning Agent for Sprint Tickets
TICKET_ID: DEV-1234
TICKET_SUMMARY: Implement dark mode toggle in settings

You are a planning agent. Your job is to create a comprehensive implementation plan based on research findings and ticket details.

INSTRUCTIONS:

1. READ INPUTS:
   - Ticket metadata: .claude/progress/DEV-1234/sprint-metadata.json
   - Research findings: .claude/progress/DEV-1234/initial-research-findings.md

2. DESIGN DOCUMENT:
   - Create .claude/progress/DEV-1234/plans/dark-mode-design.md
   - Include: approach, technical decisions, component breakdown, testing strategy
   - Keep at 1000-2000 words (high-level, not exhaustive)

3. TASK BREAKDOWN:
   - Create task files in .claude/progress/DEV-1234/tasks/
   - Name: task-001.md through task-NNN.md (sequentially)
   - Each task: 2-4 hour work item
   - Order tasks in waves: setup → core logic → integration → testing → QA

4. WAVE STRUCTURE:
   Wave 1 (Foundation): Tasks that must be done first (ThemeContext, config)
   Wave 2 (Core): Main implementation (components, styles)
   Wave 3 (Integration): Wiring up (persistence, linking to Settings page)
   Wave 4 (Polish): Testing, edge cases, accessibility
   Wave 5 (QA): Final review, deployment prep

OUTPUTS REQUIRED:

Design Document Format: .claude/progress/DEV-1234/plans/dark-mode-design.md
---

# Implementation Plan: DEV-1234
**Title**: Implement dark mode toggle in settings
**Difficulty**: Level 3 (Medium)
**Estimated Effort**: 16 hours (2 days)
**Wave Count**: 4 waves

## APPROACH

[2-3 paragraphs: high-level strategy, why this approach, key decisions]

## TECHNICAL DECISIONS

### Decision 1: [Decision name]
**Choice**: [What we chose]
**Rationale**: [Why this is the best approach]
**Alternatives considered**: [What we didn't choose and why]
**Impact**: [What this enables/constrains]

[Repeat for 3-5 key decisions]

## COMPONENT BREAKDOWN

| Component | Changes | LOC Est. | Risk | Notes |
|-----------|---------|---------|------|-------|
| ThemeContext | Add dark mode state, persistence | 40 | Low | Setup wave |
| Button | Update dark mode styles | 15 | Low | Wave 2 |
| Card | Update dark mode styles | 15 | Low | Wave 2 |
| Input | Update dark mode styles | 15 | Low | Wave 2 |
| Modal | Custom dark mode styling | 20 | Medium | Wave 2 |
| Dropdown | Custom dark mode styling | 20 | Medium | Wave 2 |
| Settings page | Add toggle UI, connect to ThemeContext | 25 | Low | Wave 3 |
| Redux store | Update user preferences shape | 15 | Low | Wave 3 |
| Tests | New dark mode test suite | 30 | Low | Wave 4 |

**Total Estimated LOC**: 195-300

## TESTING STRATEGY

### Unit Tests
- ThemeContext state transitions
- Theme persistence (localStorage)
- Redux store updates

### Integration Tests
- Settings page toggle → theme change
- Page refresh → theme persists
- System preference detection

### Accessibility Tests
- WCAG AA contrast verification (all colors)
- Screen reader behavior
- Keyboard navigation in dark mode

### Browser Testing
- Chrome (latest)
- Firefox (latest)
- Safari (dark mode quirks)
- Mobile Safari (iOS dark mode)

## DEPENDENCIES & BLOCKERS

### Hard Blockers
- None

### Soft Blockers
- [ ] DEV-1233 should be reviewed (but not blocking)
- [ ] Design palette finalization (if specs incomplete)

### Integration Points
- Redux store (user preferences)
- localStorage (persistence)
- Tailwind CSS (theme provider)

## RISKS & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Accessibility contrast issues | Medium | High | Automated contrast checking in CI |
| Safari dark mode bugs | Medium | Medium | Thorough Safari testing in Wave 4 |
| Performance (CSS size) | Low | Medium | Monitor bundle size after build |

## ACCESSIBILITY CHECKLIST

- [ ] All colors meet WCAG AA contrast (4.5:1 for text)
- [ ] Icons inverted correctly (if needed)
- [ ] Focus styles visible in dark mode
- [ ] Motion preferences respected (prefers-reduced-motion)
- [ ] Screen reader compatibility verified

## DELIVERY PLAN

**Wave 1 (Setup)**: 2h
- ThemeContext dark mode support
- Tailwind dark mode config

**Wave 2 (Core)**: 6h
- Component dark mode styles (10 components)
- Custom styling for Modal, Dropdown

**Wave 3 (Integration)**: 4h
- Settings page toggle UI
- Redux + localStorage wiring

**Wave 4 (Testing)**: 4h
- Unit + integration tests
- Accessibility + browser testing

**Total**: 16 hours

---

Task Files Format: .claude/progress/DEV-1234/tasks/task-XXX.md
---

# Task task-001.md

\`\`\`yaml
---
ticket_id: DEV-1234
wave: 1
sequence: 001
title: "Set up ThemeContext for dark mode support"
description: "Add dark mode state and preferences to existing ThemeContext"
estimated_time_hours: 2
priority: critical
acceptance_criteria:
  - ThemeContext supports 'light' and 'dark' theme values
  - Theme state persists to localStorage
  - useTheme() hook returns current theme and setter
  - No breaking changes to existing light mode logic
files_to_create:
  - none (updating existing file)
files_to_modify:
  - src/context/ThemeContext.tsx
  - src/context/ThemeContext.test.tsx (update tests)
dependencies:
  - none
related_tickets:
  - DEV-1233
---
\`\`\`

## Context

The ThemeContext currently only supports light mode. We need to extend it to support dark mode while maintaining backward compatibility.

## Requirements

1. Add dark mode state to ThemeContext
2. Implement theme persistence to localStorage with key 'app-theme'
3. Export useTheme() hook that provides {theme: 'light' | 'dark', setTheme: (theme) => void}
4. Default to 'light' if no preference stored
5. All existing tests pass, add new tests for dark mode

## Approach

[3-5 bullet points describing exact implementation steps]

## Verification

- [ ] Run \`npm test src/context/ThemeContext.test.tsx\`
- [ ] Verify localStorage persists across page reload
- [ ] Check no console errors in dev tools
- [ ] Review code for accessibility compliance

---

# Task task-002.md

\`\`\`yaml
---
ticket_id: DEV-1234
wave: 1
sequence: 002
title: "Configure Tailwind CSS dark mode"
description: "Enable dark mode in tailwind.config.js and add dark theme colors"
estimated_time_hours: 1
priority: critical
acceptance_criteria:
  - Tailwind dark mode enabled in tailwind.config.js
  - Dark theme color palette defined
  - dark: prefix works in all component styles
files_to_create:
  - none
files_to_modify:
  - tailwind.config.js
dependencies:
  - none
related_tickets: []
---
\`\`\`

## Context

Tailwind v3.3+ has native dark mode support. We need to enable it and configure the dark color palette.

## Requirements

1. Set darkMode: 'class' in tailwind.config.js (class-based dark mode via HTML class)
2. Add dark theme colors from Design System (see Confluence CONF-567)
3. Ensure all semantic color tokens have dark mode values
4. Verify build includes dark mode CSS

## Approach

[Implementation steps]

## Verification

- [ ] Build succeeds: \`npm run build\`
- [ ] dark: prefix works: add \`dark:bg-dark-bg\` to a component
- [ ] CSS file size increase is acceptable (< 10KB)

---

[Continue with task-003.md through task-NNN.md...]

Key task sequence example:
- task-001: ThemeContext setup (Wave 1)
- task-002: Tailwind config (Wave 1)
- task-003: Button dark styles (Wave 2)
- task-004: Card dark styles (Wave 2)
- task-005: Input dark styles (Wave 2)
- task-006: Modal custom dark styles (Wave 2)
- task-007: Dropdown custom dark styles (Wave 2)
- task-008: Settings page toggle UI (Wave 3)
- task-009: Redux store update (Wave 3)
- task-010: localStorage persistence test (Wave 3)
- task-011: Unit tests (Wave 4)
- task-012: Integration tests (Wave 4)
- task-013: Accessibility audit (Wave 4)
- task-014: Browser testing (Wave 4)
- task-015: QA + deployment prep (Wave 5)

`,
  subagent_type: "general-purpose",
  model: "sonnet",
  isolation: "worktree"
})
```

### 4.2 Planning Error Handling

**If a planning agent fails**:

1. **Immediate retry** (once only):
   - Re-spawn agent with same prompt
   - Wait 30 seconds, then try again

2. **If retry fails**:
   - Mark ticket as `plan_failed: true` in sprint-metadata.json
   - Append to events.jsonl: `{"type": "plan_failed", "ticket": "DEV-1234", "error": "Agent timeout", "timestamp": "..."}`
   - Do NOT include in sprint summary planning section (requires human intervention)

3. **Partial planning**:
   - If only some agents fail, continue with completed plans
   - Phase 5 will flag failed-plan tickets in the summary

### 4.3 Verification Checkpoint: Phase 4

**Checklist before proceeding to Phase 5**:

```
✓ [ ] All Level 1-3 tickets have planning agents spawned
✓ [ ] Planning agents completed (show: success rate %)
✓ [ ] Design documents created in plans/ directories
✓ [ ] Task files created with YAML frontmatter and sequencing
✓ [ ] Events.jsonl updated with plan completion timestamps
```

**Summary to display**:

```
📐 PARALLEL PLAN GENERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tickets planned: 10/10 (Level 1-3 only)
Planning agents: 10 spawned, 10 completed, 0 failed
Total time: 5m 12s

Plan Summary:
├─ Level 1 tickets: 1 plan (1 task file each)
├─ Level 2 tickets: 4 plans (avg 3 task files each)
├─ Level 3 tickets: 5 plans (avg 8 task files each)
└─ Total task files created: 67

Total estimated effort: 32 story points across 10 tickets

Tickets NOT planned (requires human review): 2
  ├─ DEV-1240: "Database migration" (Level 4)
  └─ DEV-1243: "Auth system redesign" (Level 4)

Next Phase: SPRINT SUMMARY DASHBOARD
Proceeding to Phase 5...
```

---

## PHASE 5: SPRINT SUMMARY DASHBOARD

### 5.1 Sprint Index File

Create `sprint-index.json` at `.claude/progress/.sprint-index/current-sprint.json`:

```json
{
  "sprint_id": "SPRINT-42",
  "sprint_name": "Q1 2026 Sprint 2",
  "sprint_dates": {
    "start": "2026-03-27T09:00:00Z",
    "end": "2026-04-10T17:00:00Z",
    "days_remaining": 8
  },
  "team_lead": "Claude Agent (Team Leader)",
  "orchestration_timestamp": "2026-03-27T10:15:00Z",
  "phase_completion_times": {
    "intake": "2026-03-27T09:05:00Z",
    "research": "2026-03-27T09:25:00Z",
    "difficulty_assessment": "2026-03-27T09:45:00Z",
    "plan_generation": "2026-03-27T10:10:00Z",
    "summary": "2026-03-27T10:15:00Z"
  },
  "total_tickets": 12,
  "total_story_points": 47,
  "tickets_by_difficulty": {
    "1_trivial": {
      "count": 1,
      "story_points": 3,
      "tickets": ["DEV-1232"]
    },
    "2_easy": {
      "count": 4,
      "story_points": 13,
      "tickets": ["DEV-1234", "DEV-1235", "DEV-1236", "DEV-1237"]
    },
    "3_medium": {
      "count": 5,
      "story_points": 16,
      "tickets": ["DEV-1238", "DEV-1239", "DEV-1241", "DEV-1242", "DEV-1244"]
    },
    "4_hard": {
      "count": 2,
      "story_points": 15,
      "tickets": ["DEV-1240", "DEV-1243"],
      "status": "FLAGGED_FOR_HUMAN_REVIEW"
    }
  },
  "tickets_with_plans": 10,
  "tickets_flagged_for_review": 2,
  "tickets_failed_research": 0,
  "tickets_failed_planning": 0,
  "research_success_rate_percent": 100,
  "planning_success_rate_percent": 100,
  "risk_summary": {
    "high_risk_count": 2,
    "soft_blockers": ["DEV-1233 should be reviewed before DEV-1234"],
    "blockers": []
  },
  "estimated_capacity": {
    "plannable_story_points": 32,
    "review_required_story_points": 15,
    "planning_coverage_percent": 68
  },
  "next_actions": [
    "Review flagged tickets (DEV-1240, DEV-1243) with tech lead",
    "Start Wave 1 tasks for Level 1-3 tickets (suggest dev team pickup)",
    "Schedule spike meeting for high-complexity tickets",
    "Run `/agent-team` to begin Wave 1 execution"
  ]
}
```

### 5.2 Sprint Dashboard Output

Display comprehensive summary in markdown format:

```markdown
# 🎯 SPRINT KICKOFF SUMMARY
**Sprint**: Q1 2026 Sprint 2
**Orchestration Time**: 2026-03-27 09:00–10:15 (75 minutes)
**Team Lead**: Claude Agent (Sonnet)

---

## OVERVIEW

| Metric | Value | Status |
|--------|-------|--------|
| **Total Tickets** | 12 | ✓ |
| **Total Story Points** | 47 | — |
| **Tickets Researched** | 12/12 | ✓ 100% |
| **Tickets Planned** | 10/12 | ⚠ 83% (2 flagged) |
| **Plannable Points** | 32 | ✓ |
| **Review-Required Points** | 15 | ⚠ |

---

## DIFFICULTY DISTRIBUTION

```
Level 1 (Trivial)  ████░░░░░░  1 ticket   8%   3 points
Level 2 (Easy)     ████████░░  4 tickets  33%  13 points
Level 3 (Medium)   ██████████  5 tickets  42%  16 points
Level 4 (Hard)     ██░░░░░░░░  2 tickets  17%  15 points ⚠️ REVIEW
Level 5 (V. Hard)  ░░░░░░░░░░  0 tickets  0%   0 points
```

---

## TICKET STATUS MATRIX

| Ticket | Type | Title | Points | Difficulty | Research | Plan | Status |
|--------|------|-------|--------|-----------|----------|------|--------|
| **DEV-1232** | Story | Update docs for dark mode | 3 | 1 | ✓ | ✓ | Ready |
| **DEV-1234** | Story | Implement dark mode toggle | 8 | 3 | ✓ | ✓ | Ready |
| **DEV-1235** | Story | System theme detection | 5 | 2 | ✓ | ✓ | Ready |
| **DEV-1236** | Task | Update modal styles | 4 | 2 | ✓ | ✓ | Ready |
| **DEV-1237** | Task | Update dropdown styles | 4 | 2 | ✓ | ✓ | Ready |
| **DEV-1238** | Story | Performance dashboard | 6 | 3 | ✓ | ✓ | Ready |
| **DEV-1239** | Story | Caching layer | 6 | 3 | ✓ | ✓ | Ready |
| **DEV-1240** | Story | Database migration | 10 | 4 | ✓ | ✗ | ⚠️ REVIEW |
| **DEV-1241** | Task | Auth logging | 3 | 3 | ✓ | ✓ | Ready |
| **DEV-1242** | Bug | Memory leak in WS | 5 | 3 | ✓ | ✓ | Ready |
| **DEV-1243** | Story | Auth system redesign | 5 | 4 | ✓ | ✗ | ⚠️ REVIEW |
| **DEV-1244** | Task | API docs update | 2 | 3 | ✓ | ✓ | Ready |

---

## DETAILED FINDINGS BY COMPLEXITY LEVEL

### Level 1: TRIVIAL (1 ticket, 3 points, 100% ready)

**DEV-1232**: Update docs for dark mode
- **Scope**: 1 file (docs/DARK_MODE.md)
- **Changes**: ~100 LOC
- **Research**: Documentation existing, straightforward update
- **Plan**: 1 task file, 1 hour
- **Status**: ✓ READY

---

### Level 2: EASY (4 tickets, 13 points, 100% ready)

**DEV-1234**: Implement dark mode toggle
- **Scope**: 10 components, 18 files
- **Changes**: ~350 LOC
- **Research**: Existing theme context, well-understood pattern
- **Plan**: 15 task files, 16 hours (2 days)
- **Status**: ✓ READY
- **Wave 1**: Setup ThemeContext + Tailwind (2h)
- **Wave 2**: Component styles (6h)
- **Wave 3**: Integration (4h)
- **Wave 4**: Testing & accessibility (4h)

**DEV-1235**: System theme detection
- **Scope**: 3 files, hooks + utilities
- **Changes**: ~120 LOC
- **Research**: Uses prefers-color-scheme API (standard)
- **Plan**: 4 task files, 4 hours
- **Status**: ✓ READY
- **Note**: Pairs well with DEV-1234, can start after Wave 1

**DEV-1236**: Update modal styles
- **Scope**: 2 component files
- **Changes**: ~80 LOC
- **Research**: Follows established pattern from DEV-1234
- **Plan**: 2 task files, 2 hours
- **Status**: ✓ READY
- **Dependency**: DEV-1234 Wave 2 (component styling pattern)

**DEV-1237**: Update dropdown styles
- **Scope**: 2 component files
- **Changes**: ~80 LOC
- **Research**: Follows established pattern from DEV-1234
- **Plan**: 2 task files, 2 hours
- **Status**: ✓ READY
- **Dependency**: DEV-1234 Wave 2

---

### Level 3: MEDIUM (5 tickets, 16 points, 100% ready)

**DEV-1238**: Performance dashboard
- **Scope**: 5 files, new page + components
- **Changes**: ~300 LOC
- **Research**: Uses existing metrics API, standard React patterns
- **Plan**: 8 task files, 8 hours (1 day)
- **Status**: ✓ READY
- **Risks**: Requires design review of dashboard layout

**DEV-1239**: Caching layer
- **Scope**: 3 files, new utility module + integrations
- **Changes**: ~250 LOC
- **Research**: Needs to understand current data flow, testing strategy important
- **Plan**: 7 task files, 7 hours (1 day)
- **Status**: ✓ READY
- **Risks**: Cache invalidation edge cases, needs thorough testing

**DEV-1241**: Auth logging
- **Scope**: 4 files (auth service + tests)
- **Changes**: ~200 LOC
- **Research**: Standard logging pattern, low complexity
- **Plan**: 4 task files, 4 hours
- **Status**: ✓ READY

**DEV-1242**: Memory leak in WebSocket
- **Scope**: 3 files (WS utilities + components)
- **Changes**: ~120 LOC
- **Research**: Issue reproduced, root cause identified (cleanup missing)
- **Plan**: 3 task files, 3 hours
- **Status**: ✓ READY
- **Priority**: HIGH (affects production reliability)

**DEV-1244**: API docs update
- **Scope**: 2 files (docs + OpenAPI spec)
- **Changes**: ~150 LOC
- **Research**: Straightforward documentation update
- **Plan**: 3 task files, 3 hours
- **Status**: ✓ READY

---

### Level 4: HARD (2 tickets, 15 points, ⚠️ REVIEW REQUIRED)

**DEV-1240**: Database migration
- **Scope**: 6 files, schema + migrations + integration
- **Changes**: ~400 LOC
- **Research**: Major schema change, affects multiple services
- **Risk**: Very High (production data, downtime potential)
- **Complexity signals**: 5+ signals
  - Schema versioning needed
  - Rollback strategy critical
  - Testing on production-like data required
  - Downtime mitigation unknown
- **Status**: ⚠️ **FLAGGED FOR HUMAN REVIEW**
- **Next steps**:
  1. Schedule with DBA + backend tech lead
  2. Define downtime window or zero-downtime strategy
  3. Create detailed rollback plan
  4. Possibly break into multiple tickets or spike
- **Soft blockers**: Related to DEV-1233 (refactoring)

**DEV-1243**: Auth system redesign
- **Scope**: 8 files, core auth system
- **Changes**: ~500 LOC
- **Research**: Cross-cutting concern, affects all users
- **Risk**: Very High (security, login flows, breaking changes)
- **Complexity signals**: 6+ signals
  - Backward compatibility questions
  - Security audit required
  - Token expiration handling complex
  - Multiple integration points (API, frontend, mobile)
  - Testing matrix very large
- **Status**: ⚠️ **FLAGGED FOR HUMAN REVIEW**
- **Next steps**:
  1. Schedule with security team + auth architect
  2. Review backward compatibility requirements
  3. Plan for staged rollout vs. big bang
  4. Consider breaking into multiple sprints
  5. Security audit of new design

---

## RESEARCH QUALITY REPORT

| Metric | Value | Assessment |
|--------|-------|-----------|
| **Research success rate** | 100% (12/12) | ✓ Excellent |
| **Average confidence** | 88% | ✓ High |
| **Codebase analysis depth** | 2 levels | ✓ Sufficient |
| **External research** | Confluence + docs | ✓ Complete |
| **Research time** | ~3 min per ticket | ✓ Efficient |

**Tickets with high confidence findings**: 11/12
**Tickets needing additional info**: 1 (DEV-1239 — cache strategy TBD)
**Blockers discovered**: 0 hard, 2 soft

---

## PLANNING QUALITY REPORT

| Metric | Value | Assessment |
|--------|-------|-----------|
| **Plans generated** | 10/10 (of Level 1-3) | ✓ Complete |
| **Planning success rate** | 100% | ✓ Perfect |
| **Avg task files per ticket** | 5.5 | ✓ Reasonable |
| **Total task files** | 55 | ✓ Ready |
| **Avg estimated effort** | 6.6 hours | ✓ Realistic |

**Task breakdown quality**:
- Proper wave ordering: ✓ All plans
- Acceptance criteria defined: ✓ All plans
- File dependencies tracked: ✓ All plans
- Risk identification: ✓ All plans

---

## CAPACITY PLANNING

**Plannable Tickets** (Levels 1-3): 10 tickets
**Plannable Story Points**: 32 points
**Estimated Effort**: ~65 hours total

**Planning coverage**: 68% of sprint points
**Review-required points**: 15 points (32%)

**Recommended lane allocation**:
```
Lane 1: DEV-1234 (dark mode) — 16h, 8 points — 2 developers
Lane 2: DEV-1235 (system detection) — 4h, 5 points — start after Lane 1 Wave 1
Lane 3: DEV-1238 (performance dashboard) — 8h, 6 points — 1 developer
Lane 4: DEV-1239 (caching) — 7h, 6 points — 1 developer
Lane 5: DEV-1241, DEV-1242, DEV-1244 (misc) — 10h, 10 points — 1 developer
```

**Human Review Tickets**:
- DEV-1240 + DEV-1243: Schedule with tech lead + architects (2h review + planning)

---

## KEY FINDINGS & RISKS

### Soft Blockers (not blocking, but review recommended)
- **DEV-1233** ("Refactor ThemeContext") should be reviewed before DEV-1234
  - Not blocking (DEV-1234 can extend existing ThemeContext)
  - Recommended: Ensure no conflict in refactoring approach
  - Action: Notify DEV-1233 owner before DEV-1234 starts

- **Design specs** for DEV-1238 (dashboard layout) need finalization
  - Not blocking (happy-path can proceed)
  - Recommended: Design review in Wave 1

### Risk Summary
| Risk | Tickets | Severity | Mitigation |
|------|---------|----------|-----------|
| Testing coverage (dark mode) | DEV-1234, 1235 | Medium | Automated + manual testing in Wave 4 |
| Cache invalidation edge cases | DEV-1239 | Medium | Thorough integration testing + monitoring |
| WebSocket cleanup (production impact) | DEV-1242 | High | High priority, test in staging first |
| Database downtime | DEV-1240 | Very High | Requires spike + planning (not included) |
| Auth security | DEV-1243 | Very High | Requires security review (not included) |

---

## NEXT ACTIONS (PRIORITY ORDER)

### Immediate (TODAY)
1. ✓ Kickoff meeting with team (review this dashboard)
2. ✓ Assign developers to lanes
3. ✓ Schedule tech lead reviews for DEV-1240 + DEV-1243
4. ✓ Ensure DEV-1233 status known (before DEV-1234 starts)

### This Week
1. Run `/agent-team` to begin Wave 1 execution (Level 1-3 tickets)
2. Complete tech review for DEV-1240 (database migration)
3. Complete security review for DEV-1243 (auth redesign)
4. Start development on high-priority path: DEV-1234 → DEV-1235

### Before Next Sprint
1. Resolve DEV-1240 and DEV-1243 (break into sub-tickets or spike plan)
2. Assess if review-required tickets need re-planning
3. Monitor Level 1-3 ticket progress with `/status` command

---

## TEAM LEADER NOTES

**What went well**:
- All 12 tickets successfully researched in 20 minutes (excellent parallel execution)
- Research quality high (88% avg confidence)
- Clear blockers + soft blockers identified early
- Planning generated for all plannable tickets

**Potential improvements**:
- Consider pre-meeting with architects on DEV-1240 + DEV-1243 (to speed up review)
- DEV-1239 cache strategy could be clarified in research phase (minor issue)

**Recommendations for sprint execution**:
- Start with DEV-1234 dark mode (critical path, enables DEV-1235 and DEV-1236/1237)
- Parallelize independent tickets (DEV-1238, 1239, 1241, 1242)
- Prioritize DEV-1242 (memory leak — production impact)
- Keep DEV-1240 + DEV-1243 unassigned until human review complete

**For next sprint**:
- Consider breaking very large tickets (4-5) into smaller chunks
- Assign architect/lead review time for complex tickets upfront

---

## HOW TO PROCEED

### Option 1: Start Execution Now
Run the `/agent-team` command to begin Wave 1 development:
```
/agent-team
```

This will:
- Load all Level 1-3 ticket plans
- Spawn development agents for Wave 1 tasks
- Begin parallel implementation

### Option 2: Review & Adjust
If you want to adjust plans before execution:
1. Review specific ticket plans: `/deep-research DEV-1234`
2. Modify task files in `.claude/progress/<TICKET>/tasks/`
3. Then run `/agent-team`

### Option 3: Handle Flagged Tickets First
If DEV-1240 or DEV-1243 need immediate decision:
1. Schedule human review meetings
2. Once decisions made, update sprint-metadata.json
3. Use `/resume` to continue with remaining tickets

---

## FILE REFERENCES

All sprint data located in:
- **Tickets**: `.claude/progress/DEV-*/`
- **Sprint index**: `.claude/progress/.sprint-index/current-sprint.json`
- **Team memory**: `.claude/.memory/sprint-context.json`

Each ticket has:
- `sprint-metadata.json` — ticket details + difficulty rating
- `initial-research-findings.md` — research conclusions
- `plans/<feature>-design.md` — implementation design
- `tasks/task-*.md` — individual work items (8 YAML frontmatter)
- `events.jsonl` — append-only event log (for auditing)

---

**Orchestration Complete**
Generated by: Claude Team Leader (Sonnet)
Timestamp: 2026-03-27T10:15:00Z
```

### 5.3 Summary Checklist

Before displaying final summary, verify:

```
✓ [ ] All 5 phases completed successfully
✓ [ ] Sprint index file created
✓ [ ] All ticket directories have required files:
       - sprint-metadata.json ✓
       - initial-research-findings.md ✓
       - plans/ + tasks/ (if Level 1-3) ✓
       - events.jsonl ✓
✓ [ ] Difficulty ratings assigned to all tickets
✓ [ ] Human review flags set for Level 4-5 tickets
✓ [ ] No orphaned agents running (all completed)
✓ [ ] Memory system updated with sprint context
```

### 5.4 Command Completion

Display final status:

```
═══════════════════════════════════════════════════════════════
✅ SPRINT ORCHESTRATION COMPLETE
═══════════════════════════════════════════════════════════════

PHASE SUMMARY:
  ✓ Phase 1 (Intake):                COMPLETE (5m)
  ✓ Phase 2 (Parallel Research):     COMPLETE (20m) — 12 agents
  ✓ Phase 3 (Difficulty Assessment): COMPLETE (15m)
  ✓ Phase 4 (Parallel Planning):     COMPLETE (30m) — 10 agents
  ✓ Phase 5 (Summary Dashboard):     COMPLETE (5m)

TOTAL TIME: 75 minutes
TOTAL AGENTS SPAWNED: 22 (12 research + 10 planning)

SPRINT STATUS:
  Tickets:               12 total, 47 story points
  ├─ Researched:        12/12 ✓
  ├─ Planned:           10/12 ✓
  ├─ Ready to develop:  10 tickets (32 points)
  └─ Needs review:      2 tickets (15 points)

NEXT COMMAND:
  /agent-team                    (start Wave 1 development)
  or
  /status                        (view current progress)
  or
  /deep-research DEV-1240        (investigate flagged ticket)

═══════════════════════════════════════════════════════════════
```

---

## COMMAND IMPLEMENTATION DETAILS

### Error Recovery Strategies

#### Missing Sprint Context
```
IF sprint-context.json NOT found:
  → Prompt user: "No active sprint configured. Please run /connect-atlassian first."
  → Return early with helpful error message
```

#### Agent Failure (Research Phase)
```
IF research agent fails or times out:
  → Log failure to events.jsonl
  → RETRY ONCE (same agent + prompt, 30s timeout)
  → IF retry fails:
       → Mark ticket: research_failed = true
       → Flag for manual review
       → Continue with other tickets (partial results acceptable)
```

#### Agent Failure (Planning Phase)
```
IF planning agent fails or times out:
  → Log failure to events.jsonl
  → RETRY ONCE (same agent + prompt, 30s timeout)
  → IF retry fails:
       → Mark ticket: plan_failed = true
       → DO NOT include in execution path
       → Require human re-planning
```

#### Partial Batch Failure
```
IF some agents in batch succeed, some fail:
  → Collect successful results
  → Proceed to next phase
  → Mark failures clearly in summary
  → Offer user choice: retry now, or fix and resume later
```

### Memory Management

Store in `.claude/.memory/`:

```
sprint-context.json          # Active sprint + board info
├─ active_sprint_id
├─ jira_board_id
├─ jira_project_key
├─ agent_team_size
└─ start_timestamp

agent-team-status.json       # (updated by /agent-team)
├─ current_wave
├─ active_agents: [...]
├─ completed_tasks: [...]
└─ in_progress_tasks: [...]
```

### File Structure Guarantees

After `/start-sprint` completes, guaranteed structure:

```
.claude/
├─ .memory/
│  ├─ sprint-context.json
│  └─ agent-team-status.json
├─ progress/
│  ├─ .sprint-index/
│  │  └─ current-sprint.json
│  ├─ DEV-1232/
│  │  ├─ sprint-metadata.json
│  │  ├─ initial-research-findings.md
│  │  ├─ plans/
│  │  │  └─ update-docs-design.md
│  │  ├─ tasks/
│  │  │  └─ task-001.md
│  │  └─ events.jsonl
│  ├─ DEV-1234/
│  │  ├─ sprint-metadata.json
│  │  ├─ initial-research-findings.md
│  │  ├─ plans/
│  │  │  └─ dark-mode-design.md
│  │  ├─ tasks/
│  │  │  ├─ task-001.md
│  │  │  ├─ task-002.md
│  │  │  ├─ ...
│  │  │  └─ task-015.md
│  │  └─ events.jsonl
│  └─ [... remaining tickets ...]
```

---

## EXAMPLE INVOCATION

### User Command
```
/start-sprint
```

### Command Execution
```
Team Leader: Fetching active sprint from Jira...
  → Sprint: "Q1 2026 Sprint 2" (DEV board)
  → Tickets: 12 total, 47 story points
  → Sprint duration: 8 days

Team Leader: Creating ticket directories...
  → .claude/progress/DEV-1232/
  → .claude/progress/DEV-1234/
  → ... [12 total]
  ✓ Complete

Team Leader: Spawning research agents in parallel...
  Batch 1: Spawning DEV-1232, DEV-1234, DEV-1235, DEV-1236
  Batch 2: Spawning DEV-1237, DEV-1238, DEV-1239, DEV-1240
  Batch 3: Spawning DEV-1241, DEV-1242, DEV-1243, DEV-1244

  [4 min waiting for agents to complete...]

  ✓ All 12 research agents completed
  ✓ Research findings written to all tickets

Team Leader: Assessing difficulty for all tickets...
  → DEV-1232: Level 1 (trivial)
  → DEV-1234: Level 3 (medium)
  → DEV-1235: Level 2 (easy)
  → ... [12 total]

  ⚠️  Flagging for human review:
      DEV-1240 (Level 4 — database migration)
      DEV-1243 (Level 4 — auth redesign)
  ✓ Difficulty ratings assigned

Team Leader: Spawning planning agents for Level 1-3 tickets...
  Batch 1: Spawning DEV-1232, DEV-1234, DEV-1235, DEV-1236
  Batch 2: Spawning DEV-1237, DEV-1238, DEV-1239, DEV-1241
  Batch 3: Spawning DEV-1242, DEV-1244

  [5 min waiting for agents to complete...]

  ✓ All 10 planning agents completed
  ✓ Design documents + task files written
  ✓ 55 total task files created

Team Leader: Generating sprint summary...
  ✓ Sprint index created
  ✓ Dashboard written
  ✓ Next actions documented

[DISPLAY SPRINT SUMMARY DASHBOARD HERE]

Team Leader: Sprint kickoff orchestration complete!
Next command: /agent-team (to start Wave 1)
```

---

## INTEGRATION WITH OTHER COMMANDS

### `/agent-team`
Reads from:
- `.claude/progress/<TICKET>/tasks/task-*.md` (Wave execution)
- `.claude/.memory/sprint-context.json` (sprint info)

Updates:
- `.claude/progress/<TICKET>/events.jsonl` (task progress)
- `.claude/.memory/agent-team-status.json` (wave status)

### `/status`
Reads from:
- `.claude/progress/.sprint-index/current-sprint.json` (overall status)
- `.claude/progress/<TICKET>/sprint-metadata.json` (ticket status)

### `/deep-research <TICKET>`
Reads from:
- `.claude/progress/<TICKET>/initial-research-findings.md` (existing findings)

Can expand on specific aspect (file impact, risks, etc.)

### `/resume`
Reads from:
- `.claude/progress/<TICKET>/sprint-metadata.json` (which phase each ticket is at)
- `.claude/.memory/agent-team-status.json` (execution state)

Can resume from any phase if interrupted

---

## PRODUCTION CONSIDERATIONS

### Rate Limiting
- Jira API: 10 requests per second → Fetch tickets in sequential batches
- Agent spawning: 20 concurrent max → Batch in groups of 4-5

### Timeout Handling
- Research agents: 5 minute timeout per ticket
- Planning agents: 5 minute timeout per ticket
- Batch operations: 30 minute timeout total

### Scalability
- Tested with: 12 tickets (this example)
- Recommended max: 20 tickets per sprint
- Beyond 20: Consider splitting sprint into two batches

### Data Safety
- All data written to `.claude/progress/` before summary
- No data lost if command interrupted (can resume)
- Events.jsonl provides full audit trail

---

## TEAM LEADER PERSONALITY

The Team Leader (command runner) communicates with:
- Clear phase-based progress updates
- Specific numbers (agent counts, time estimates, success rates)
- Actionable warnings (soft blockers, flagged tickets)
- Honest assessment (what's ready, what needs review)
- Humble tone (doesn't claim to know code without researching)

Voice example:
```
"I've researched all 12 tickets in detail. 10 are ready for immediate planning,
but 2 need architect input due to their complexity (database migration and auth
redesign). I'd recommend getting those reviewed before sprint starts. For the
10 ready tickets, I've created detailed plans with task breakdowns. Total estimated
effort across the ready tickets: 65 hours. Let me know if you want to adjust
scope or approach for any of them."
```

---

## END OF `/start-sprint` COMMAND SPECIFICATION

This is the production-grade orchestration command for sprint kickoff with the Claude Workflow plugin v4.0.0.
