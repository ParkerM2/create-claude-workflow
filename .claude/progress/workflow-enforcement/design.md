# Feature Design: Workflow Enforcement — Phase Gates & Hook-Based Compliance

**Author**: /create-feature-plan
**Created**: 2026-02-22
**Status**: READY FOR IMPLEMENTATION
**Workflow Mode**: standard

---

## 1. Overview

Claude Code systematically fails to follow the multi-step workflow defined by claude-workflow. The Team Leader agent skips agent delegation, omits QA spawning, jumps directly to coding, or loses track of the workflow after context compaction. This is a known, structural problem documented across multiple GitHub issues (#26761, #742, #7248, #18660, #24318) — prose instructions alone are insufficient for enforcing complex sequential workflows.

This feature implements a multi-layer enforcement system:

1. **Phase Gate Protocol** — A compact (~90 line) state machine reference that replaces reading 2000+ lines of detailed docs at each phase transition
2. **Workflow State File** — An on-disk JSON file that survives context compaction, tracking exactly which phase the workflow is in and which gates have passed
3. **Hook-Based Hard Enforcement** — PreToolUse hooks that block agent spawning when prerequisites aren't met, and a compact re-injection hook that restores critical rules after context compaction
4. **Condensed Prompt Architecture** — Restructured command/agent prompts that front-load the Phase Gate Protocol and defer detailed docs to progressive disclosure

## 2. Requirements

### Functional Requirements

- Team Leader MUST NOT be able to spawn coding agents (Task tool) before creating a team and tasks
- Team Leader MUST NOT be able to merge workbranches before QA passes
- After context compaction, the Phase Gate Protocol and current workflow state MUST be re-injected
- Each phase transition MUST be recorded to an on-disk state file that survives session crashes
- The workflow state file MUST be human-readable and serve as a quick-resume artifact
- All enforcement MUST be toggleable via `.claude/workflow.json` guards section (for users who want to opt out)

### Non-Functional Requirements

- Hook execution time < 100ms per invocation (read JSON, check state, respond)
- Phase Gate Protocol file < 100 lines (must fit in working memory after compaction)
- No external dependencies (no Graphiti, no MCP memory servers, no databases)
- Backward compatible — users who don't upgrade their workflow.json still get defaults

### Out of Scope

- Cross-session memory (Graphiti/memory MCP) — research confirms this is irrelevant to the compliance problem
- Visual QA enforcement — too environment-specific to gate with hooks
- Rewriting the full playbook — we supplement it with the phase gate, not replace it

## 3. Architecture

### Selected Approach: Layered Enforcement with External State

**Why this approach over alternatives:**

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| More prose instructions | Rejected | The core problem IS that prose instructions get ignored |
| Graphiti/memory MCP | Rejected | Solves cross-session persistence, not within-session compliance |
| Full state machine (LangGraph-style) | Rejected | Would require rewriting the plugin as a programmatic orchestrator, not markdown-based |
| **Phase gates + hooks + state file** | **Selected** | Works within Claude Code's plugin model (markdown + hooks), provides hard enforcement where it matters, degrades gracefully |

### 3a. Phase Gate Protocol (New File)

A single compact file that defines the workflow as a numbered sequence of gates with binary pass/fail conditions. The Team Leader reads this instead of the 680-line playbook for phase transitions.

**Key design decisions:**
- Each gate has exactly 3-5 verifiable conditions (not prose paragraphs)
- Gates reference the state file — "verify gate N is passed in workflow-state.json"
- The file is short enough to survive context compaction re-injection (~90 lines)

### 3b. Workflow State File (External State)

Location: `.claude/progress/<feature>/workflow-state.json`

```json
{
  "feature": "my-feature",
  "mode": "strict",
  "startedAt": "2026-02-22T10:00:00Z",
  "currentPhase": 5,
  "teamCreated": false,
  "tasksCreated": 0,
  "gates": {
    "1_context_loaded": { "passed": true, "ts": "2026-02-22T10:01:00Z" },
    "2_plan_complete": { "passed": true, "ts": "2026-02-22T10:05:00Z" },
    "3_branch_team_ready": { "passed": true, "ts": "2026-02-22T10:07:00Z" },
    "4_wave1_spawned": { "passed": true, "ts": "2026-02-22T10:08:00Z" },
    "5_wave1_qa_complete": { "passed": false }
  },
  "waves": {
    "1": { "status": "in_progress", "agentsSpawned": 2, "qaComplete": 1, "merged": 0 },
    "2": { "status": "pending" }
  }
}
```

**Why external state works:**
- Survives context compaction (it's on disk, not in context)
- Hooks can read it to enforce gates (programmatic, not prose)
- Crash recovery reads it to know exactly where to resume
- Team Leader reads it at each phase transition to anchor itself

### 3c. Hook Architecture

```
hooks.json (updated)
├── SessionStart [compact]     → compact-reinject.js    (re-inject phase gates + state after compaction)
├── PreToolUse [Task]          → workflow-gate.js        (block agent spawning without prerequisites)
├── PreToolUse [Bash]          → safety-guard.js         (existing — unchanged)
├── PreToolUse [Edit|Write]    → config-guard.js         (existing — unchanged)
```

**workflow-gate.js** — The enforcement hook:
- Triggers on every `Task` tool call (which is how agents are spawned)
- Reads workflow-state.json from the progress directory
- If the current gate hasn't passed, returns `{ decision: "block", reason: "..." }`
- The reason message tells Claude exactly what gate to pass first
- Respects `guards.workflowGate` setting (default: true, can be disabled)

**compact-reinject.js** — The memory restoration hook:
- Triggers on SessionStart with matcher `compact`
- Reads PHASE-GATE-PROTOCOL.md
- Reads workflow-state.json (if it exists for any active feature)
- Injects both as `additionalContext` so Claude gets the rules back after compaction

### 3d. Integration Points

```
New → Existing:
- workflow-gate.js reads config.js (getWorkflowConfig, getGuardsConfig)
- workflow-gate.js reads tracker.js (getFeatureFromBranch)
- compact-reinject.js reads session-start.js pattern (same output format)
- PHASE-GATE-PROTOCOL.md references existing files by name (README.md, AGENT-SPAWN-TEMPLATES.md)

Existing → New:
- new-feature.md adds phase gate initialization + state file creation
- team-leader.md adds phase gate protocol to initialization reads
- hooks.json adds 2 new hook entries
- config.js adds workflowGate to GUARDS_DEFAULTS
- tracker.js emitEvent() auto-updates workflow-state.json on significant events
```

## 4. Task Breakdown

### Task #1: Create Phase Gate Protocol file

**Agent**: general-purpose (documentation/design specialist)
**Wave**: 1
**Blocked by**: none
**Estimated complexity**: MEDIUM
**Context budget**: ~14,000 tokens (files: 4)

**Description**:
Create `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` — a compact (~90 line) state machine definition for the workflow. This replaces the need to re-read the 680-line playbook at each phase transition. Each gate has 3-5 binary verifiable conditions. The file must be self-contained (no external references needed to understand the gates) and short enough to survive context re-injection after compaction.

The gates are:
1. Context Loaded (rules + architecture read)
2. Plan Complete (written decomposition exists)
3. Branch + Team Ready (feature branch, team, tasks created)
4. Wave N Spawned (worktrees, agents via full templates)
5. Wave N QA Complete (all agents reported QA PASS)
6. Wave N Merged (workbranches merged, fence passed)
7. All Waves Complete
8. Guardian Passed
9. Feature Complete (PR, cleanup, shutdown)

Each gate includes: gate name, prerequisite gate, 3-5 verification conditions, the state file key to update on pass, and what to read next (progressive disclosure pointer).

Include at the top a "STOP AND READ" section that explains:
- This file IS the workflow. Do not proceed past any gate without verifying.
- After context compaction, re-read this file and the workflow state file.
- The workflow state file at `.claude/progress/<feature>/workflow-state.json` is the source of truth for which gates have passed.

**Files to Create**:
- `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` — The phase gate state machine

**Files to Read for Context**:
- `prompts/implementing-features/README.md` — Extract the phase sequence from the existing playbook
- `commands/new-feature.md` — Understand the current phase numbering
- `agents/team-leader.md` — Understand the Team Leader's current phase protocol
- `prompts/implementing-features/WAVE-FENCE-PROTOCOL.md` — Wave fence integration

**Acceptance Criteria**:
- [ ] File is under 100 lines
- [ ] All 9 gates defined with 3-5 binary conditions each
- [ ] Each gate specifies its prerequisite gate
- [ ] Each gate specifies the state file key to update
- [ ] Progressive disclosure pointers tell the agent what detailed file to read next
- [ ] Self-contained — an agent reading only this file knows the full workflow sequence

---

### Task #2: Add workflow state utilities to config.js

**Agent**: general-purpose (Node.js engineer)
**Wave**: 1
**Blocked by**: none
**Estimated complexity**: LOW
**Context budget**: ~13,000 tokens (files: 3)

**Description**:
Extend `hooks/config.js` with utilities for reading and writing the workflow state file. Add `workflowGate` to `GUARDS_DEFAULTS`. These utilities will be used by the enforcement hook (Task #3) and the tracker integration (Task #4).

Functions to add:
- `getWorkflowState(feature)` — Read `.claude/progress/<feature>/workflow-state.json`, return parsed object or null
- `updateWorkflowState(feature, updates)` — Deep-merge updates into the state file, write atomically
- `getActiveFeature()` — Detect the active feature from git branch or by scanning progress dir for features without `session.end` events
- Add `workflowGate: true` to `GUARDS_DEFAULTS`

**Files to Modify**:
- `hooks/config.js` — Add workflow state utilities and workflowGate default

**Files to Read for Context**:
- `hooks/config.js` — Current structure and patterns
- `hooks/tracker.js` — How it reads progress dir and feature detection

**Acceptance Criteria**:
- [ ] `getWorkflowState(feature)` returns parsed JSON or null if file doesn't exist
- [ ] `updateWorkflowState(feature, updates)` deep-merges and writes atomically
- [ ] `getActiveFeature()` detects active feature from branch or progress scan
- [ ] `GUARDS_DEFAULTS` includes `workflowGate: true`
- [ ] All functions fail gracefully (return null/undefined, never throw)
- [ ] Export all new functions

---

### Task #3: Create workflow-gate.js enforcement hook

**Agent**: general-purpose (Node.js engineer)
**Wave**: 2
**Blocked by**: Task #2
**Estimated complexity**: MEDIUM
**Context budget**: ~15,000 tokens (files: 5)

**Description**:
Create `hooks/workflow-gate.js` — a PreToolUse hook that fires on `Task` tool calls (agent spawning). It reads the workflow state file and blocks agent spawning if prerequisite gates haven't passed.

Enforcement logic:
1. Read stdin for tool_input (standard hook protocol)
2. Check if `guards.workflowGate` is enabled (skip if disabled)
3. Detect the active feature using `getActiveFeature()`
4. If no active feature found, allow (we're not in a workflow)
5. Read workflow-state.json for the active feature
6. If no state file, allow (workflow state tracking not initialized yet)
7. Check the tool_input: is this spawning a coding/QA/guardian agent?
   - Look for keywords in description/prompt: "coding", "implement", "QA", "guardian"
   - If it's a general research/explore agent, allow without gate check
8. For coding agent spawns: verify `3_branch_team_ready` gate is passed
   - If not: block with message "Gate 3 (Branch + Team Ready) not passed. Create the feature branch, team, and tasks first. Read PHASE-GATE-PROTOCOL.md."
9. For QA agent spawns: allow (QA is spawned by coding agents, not gated)
10. For guardian spawns: verify all wave gates are passed
    - If not: block with message "Gate 7 (All Waves Complete) not passed."

Output format: `{ decision: "block", reason: "..." }` or allow (exit 0 with no output).

**Files to Create**:
- `hooks/workflow-gate.js` — The enforcement hook

**Files to Read for Context**:
- `hooks/config.js` — Use getGuardsConfig, getWorkflowState, getActiveFeature
- `hooks/safety-guard.js` — Pattern for PreToolUse hooks (stdin reading, output format)
- `hooks/config-guard.js` — Another PreToolUse hook pattern
- `hooks/hooks.json` — Current hook registration format

**Acceptance Criteria**:
- [ ] Blocks Task tool calls when prerequisite gates haven't passed
- [ ] Returns clear, actionable error messages referencing specific gates
- [ ] Respects guards.workflowGate toggle (disabled = always allow)
- [ ] Allows non-workflow agent spawns (research, explore)
- [ ] Fails open on any error (never blocks due to its own bugs)
- [ ] Execution time < 100ms

---

### Task #4: Create compact-reinject.js compaction recovery hook

**Agent**: general-purpose (Node.js engineer)
**Wave**: 2
**Blocked by**: Task #2
**Estimated complexity**: LOW
**Context budget**: ~13,000 tokens (files: 4)

**Description**:
Create `hooks/compact-reinject.js` — a SessionStart hook with matcher `compact` that re-injects the Phase Gate Protocol and current workflow state after context compaction.

When context compaction occurs, Claude loses its loaded rules. This hook ensures the most critical workflow instructions are immediately restored.

Logic:
1. Read `PHASE-GATE-PROTOCOL.md` from the plugin root
2. Detect active feature using `getActiveFeature()`
3. If active feature exists, read `workflow-state.json`
4. Build additionalContext string:
   ```
   <workflow-enforcement>
   CONTEXT WAS COMPACTED. Re-read your workflow state.

   [Phase Gate Protocol contents]

   Current workflow state for feature "<name>":
   [JSON state or "No active feature detected"]

   IMPORTANT: Re-read the workflow state file at .claude/progress/<feature>/workflow-state.json
   and continue from the current phase. Do NOT restart from Phase 1.
   </workflow-enforcement>
   ```
5. Output in SessionStart hook format: `{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "..." } }`

**Files to Create**:
- `hooks/compact-reinject.js` — The compaction recovery hook

**Files to Read for Context**:
- `hooks/session-start.js` — Pattern for SessionStart hooks (output format)
- `hooks/config.js` — Use getActiveFeature, getWorkflowState
- `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` — File to read and inject (from Task #1)

**Acceptance Criteria**:
- [ ] Reads and injects PHASE-GATE-PROTOCOL.md after compaction
- [ ] Includes current workflow state if an active feature exists
- [ ] Clear "CONTEXT WAS COMPACTED" header so Claude knows what happened
- [ ] Matches SessionStart hook output format (hookSpecificOutput.additionalContext)
- [ ] Fails silently if protocol file or state file doesn't exist
- [ ] Execution time < 100ms

---

### Task #5: Extend tracker.js to auto-update workflow state

**Agent**: general-purpose (Node.js engineer)
**Wave**: 2
**Blocked by**: Task #2
**Estimated complexity**: LOW
**Context budget**: ~14,000 tokens (files: 3)

**Description**:
Extend `hooks/tracker.js` so that when significant events are emitted via `emitEvent()`, the workflow state file is automatically updated. This ensures the state file stays in sync with progress tracking without requiring the Team Leader to manually update it.

Event-to-state mappings:
- `session.start` → Initialize workflow-state.json with feature name, mode, gates all false
- `plan.created` → Set `2_plan_complete` gate to passed
- `task.started` → Increment tasksCreated count, update wave status
- `task.completed` → Update wave qaComplete count
- `qa.passed` → Update wave qaComplete count
- `branch.merged` → Update wave merged count; if all tasks in wave merged, mark wave gate passed
- `checkpoint` with data.message matching "wave-N-complete" → Mark wave fence gate passed
- `checkpoint` with data.message matching "guardian-passed" → Mark `8_guardian_passed` gate
- `session.end` → Mark `9_feature_complete` gate

Add a new internal function `updateWorkflowStateFromEvent(feature, event)` that maps events to state updates, then calls `updateWorkflowState()` from config.js.

**Files to Modify**:
- `hooks/tracker.js` — Add workflow state auto-update in emitEvent()

**Files to Read for Context**:
- `hooks/tracker.js` — Current emitEvent implementation
- `hooks/config.js` — updateWorkflowState utility (from Task #2)

**Acceptance Criteria**:
- [ ] session.start initializes workflow-state.json
- [ ] Significant events auto-update the state file
- [ ] State file stays in sync with events.jsonl
- [ ] Never crashes emitEvent — state update failures are swallowed
- [ ] Existing emitEvent behavior unchanged (state update is additive)

---

### Task #6: Update hooks.json with new hook registrations

**Agent**: general-purpose (config engineer)
**Wave**: 3
**Blocked by**: Tasks #3, #4
**Estimated complexity**: LOW
**Context budget**: ~12,000 tokens (files: 2)

**Description**:
Update `hooks/hooks.json` to register the two new hooks:

1. Add `compact-reinject.js` to SessionStart hooks (matcher: `compact`)
2. Add `workflow-gate.js` to PreToolUse hooks (matcher: `Task`)

The compact matcher ensures the re-injection only fires after compaction, not on every session start (the existing session-start.js handles the normal startup). The Task matcher ensures the gate hook only fires when Claude tries to spawn agents.

**Files to Modify**:
- `hooks/hooks.json` — Add 2 new hook entries

**Files to Read for Context**:
- `hooks/hooks.json` — Current structure

**Acceptance Criteria**:
- [ ] compact-reinject.js registered under SessionStart with matcher "compact"
- [ ] workflow-gate.js registered under PreToolUse with matcher "Task"
- [ ] Existing hooks unchanged
- [ ] Valid JSON

---

### Task #7: Update new-feature.md command to integrate phase gates

**Agent**: general-purpose (documentation engineer)
**Wave**: 3
**Blocked by**: Task #1
**Estimated complexity**: MEDIUM
**Context budget**: ~16,000 tokens (files: 4)

**Description**:
Restructure `commands/new-feature.md` to front-load the Phase Gate Protocol and integrate state file management. The key changes:

1. **Add Phase Gate Protocol to mandatory reads** (Phase 1):
   - Add `PHASE-GATE-PROTOCOL.md` as the FIRST mandatory read (before README.md)
   - Move README.md to a "deferred read" that's loaded when detailed instructions are needed

2. **Add workflow state initialization** (Phase 4):
   - After creating feature branch and progress directory, initialize `workflow-state.json`
   - Pass gate 1 after context loading, gate 2 after planning, gate 3 after branch+team creation

3. **Add gate checks at each phase transition**:
   - Before Phase 5 (team setup): "Verify gate 2 passed in workflow-state.json"
   - Before Phase 6 (waves): "Verify gate 3 passed"
   - Before Phase 7 (guardian): "Verify all wave gates passed"
   - Before Phase 10 (completion): "Verify gate 8 passed"

4. **Add prominent "STOP AND VERIFY" markers** between phases:
   ```
   ═══════════════════════════════════════════
   GATE CHECK: Verify gate N before proceeding
   Read: .claude/progress/<feature>/workflow-state.json
   Required: <gate conditions>
   Update state file after passing this gate.
   ═══════════════════════════════════════════
   ```

5. **Move detailed sections to "read when needed" pattern**:
   - Phase 6 says "Read AGENT-SPAWN-TEMPLATES.md NOW" instead of front-loading it
   - This reduces initial context consumption

**Files to Modify**:
- `commands/new-feature.md` — Restructure with phase gate integration

**Files to Read for Context**:
- `commands/new-feature.md` — Current structure
- `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` — Gate definitions (from Task #1)
- `prompts/implementing-features/README.md` — Detailed playbook (for cross-referencing)
- `agents/team-leader.md` — Team Leader's initialization protocol

**Acceptance Criteria**:
- [ ] PHASE-GATE-PROTOCOL.md is the first mandatory read
- [ ] Workflow state file initialized in Phase 4
- [ ] Gate verification checkpoints between every phase
- [ ] "STOP AND VERIFY" visual markers at each gate
- [ ] Progressive disclosure — detailed docs loaded when needed, not upfront
- [ ] No information lost from current new-feature.md (reorganized, not deleted)

---

### Task #8: Update team-leader.md agent to integrate phase gates

**Agent**: general-purpose (documentation engineer)
**Wave**: 3
**Blocked by**: Task #1
**Estimated complexity**: MEDIUM
**Context budget**: ~15,000 tokens (files: 3)

**Description**:
Update `agents/team-leader.md` to integrate the Phase Gate Protocol into the Team Leader's operating instructions. Key changes:

1. **Add PHASE-GATE-PROTOCOL.md to Phase 0 reads**:
   - Make it the first file read, before project rules
   - This ensures the Team Leader has the state machine loaded before anything else

2. **Add state file management to the planning gate**:
   - After Phase 0: update workflow-state.json gate 1
   - After Phase 1: update gate 2
   - After team creation: update gate 3

3. **Add gate verification to task decomposition protocol**:
   - Step 7 (Spawn): "Read workflow-state.json. Verify gate 3 passed. If not, STOP."
   - Step 8 (Monitor): "After QA pass, update wave gate in state file before merging."

4. **Add a "Context Recovery" section**:
   ```
   ## Context Recovery (After Compaction)

   If you notice your context was compacted (the compact-reinject hook will
   tell you), immediately:
   1. Read .claude/progress/<feature>/workflow-state.json
   2. Read PHASE-GATE-PROTOCOL.md (re-injected by the hook)
   3. Determine your current phase from the state file
   4. Continue from that phase — do NOT restart from Phase 0
   ```

5. **Add non-negotiable rule**:
   - Add to the rules section: "11. **Always update workflow-state.json** — after passing each gate, update the state file immediately. This is your crash-recovery and compaction-recovery artifact."

**Files to Modify**:
- `agents/team-leader.md` — Add phase gate integration

**Files to Read for Context**:
- `agents/team-leader.md` — Current structure
- `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` — Gate definitions (from Task #1)
- `commands/new-feature.md` — Updated command (from Task #7, but can work in parallel since both read Task #1)

**Acceptance Criteria**:
- [ ] PHASE-GATE-PROTOCOL.md in Phase 0 reads (first file)
- [ ] State file updates at each gate transition
- [ ] Context Recovery section added
- [ ] Non-negotiable rule #11 added
- [ ] No information lost from current team-leader.md

---

### Task #9: Update AGENT-SPAWN-TEMPLATES.md with state file awareness

**Agent**: general-purpose (documentation engineer)
**Wave**: 3
**Blocked by**: Task #1
**Estimated complexity**: LOW
**Context budget**: ~14,000 tokens (files: 2)

**Description**:
Update `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` to add workflow state file awareness to the Standard Coding Agent template. The coding agent should update the state file after completing its work and spawning QA.

Changes:
1. In the Standard Coding Agent template, Phase 4 (Spawn QA):
   - After QA PASS, add: "Update the workflow state file to reflect task completion"
   - The coding agent doesn't need to read the full state file — it just reports completion

2. In the Team Leader Kickoff Checklist:
   - Add step between items 4 and 5: "Initialize workflow-state.json with gates"
   - Add after each major step: "Update workflow-state.json"

3. Add a brief "Workflow State File" section at the top:
   ```
   ## Workflow State File

   The Team Leader maintains a workflow state file at:
   `.claude/progress/<feature>/workflow-state.json`

   This file tracks which gates have passed. Hooks enforce these gates.
   Coding agents do NOT need to read or manage this file — the Team Leader
   and hooks handle it.
   ```

**Files to Modify**:
- `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` — Add state file awareness

**Files to Read for Context**:
- `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` — Current content

**Acceptance Criteria**:
- [ ] Team Leader checklist includes state file management
- [ ] Workflow State File section added at top
- [ ] Coding agent template unchanged (agents don't manage state file)
- [ ] No changes to QA or Guardian templates (they're spawned by others)

---

### Task #10: Update README.md playbook with phase gate cross-references

**Agent**: general-purpose (documentation engineer)
**Wave**: 3
**Blocked by**: Task #1
**Estimated complexity**: LOW
**Context budget**: ~14,000 tokens (files: 2)

**Description**:
Add Phase Gate Protocol cross-references to the README.md playbook so the Team Leader knows to consult the gates at each phase transition.

Changes:
1. Add to the Table of Contents: "16. [Phase Gate Protocol](#16-phase-gate-protocol)"
2. Add a new Section 16 that briefly describes the phase gate system and points to `PHASE-GATE-PROTOCOL.md`
3. At each major section boundary (between phases), add a one-line gate reminder:
   ```
   > **GATE CHECK**: Before proceeding, verify gate N in workflow-state.json. See PHASE-GATE-PROTOCOL.md.
   ```
4. Update the REFERENCE-INDEX.md to include PHASE-GATE-PROTOCOL.md in the file table

**Files to Modify**:
- `prompts/implementing-features/README.md` — Add phase gate cross-references
- `prompts/implementing-features/REFERENCE-INDEX.md` — Add new file to index

**Files to Read for Context**:
- `prompts/implementing-features/README.md` — Current structure
- `prompts/implementing-features/REFERENCE-INDEX.md` — Current index

**Acceptance Criteria**:
- [ ] Section 16 added with phase gate overview
- [ ] Gate check reminders at each phase boundary
- [ ] REFERENCE-INDEX.md updated with PHASE-GATE-PROTOCOL.md entry
- [ ] No content deleted from existing sections

## 5. Wave Plan

### Wave 1: Foundation (no blockers)
- Task #1: Create Phase Gate Protocol file — documentation specialist
- Task #2: Add workflow state utilities to config.js — Node.js engineer

### Wave 2: Core Hooks (blocked by Wave 1)
- Task #3: Create workflow-gate.js enforcement hook — Node.js engineer
- Task #4: Create compact-reinject.js compaction recovery hook — Node.js engineer
- Task #5: Extend tracker.js to auto-update workflow state — Node.js engineer

(Tasks #3, #4, #5 touch different files — can run in parallel)

### Wave 3: Integration (blocked by Waves 1 & 2)
- Task #6: Update hooks.json — config engineer
- Task #7: Update new-feature.md command — documentation engineer
- Task #8: Update team-leader.md agent — documentation engineer
- Task #9: Update AGENT-SPAWN-TEMPLATES.md — documentation engineer
- Task #10: Update README.md + REFERENCE-INDEX.md — documentation engineer

(Tasks #6-#10 touch different files — can run in parallel)

### Dependency Graph

```
#1 Phase Gate Protocol ──────┐
                              ├──> #3 workflow-gate.js ──────┐
#2 config.js state utils ────┤                               │
                              ├──> #4 compact-reinject.js ───┤
                              │                               ├──> #6 hooks.json
                              └──> #5 tracker.js state ──────┘

#1 Phase Gate Protocol ──────────────────────────────────────> #7 new-feature.md
                              ├─────────────────────────────> #8 team-leader.md
                              ├─────────────────────────────> #9 AGENT-SPAWN-TEMPLATES.md
                              └─────────────────────────────> #10 README.md + REFERENCE-INDEX.md
```

### Parallel Opportunities

- Wave 1: Tasks #1 and #2 are fully independent (different file types)
- Wave 2: Tasks #3, #4, and #5 all touch different JS files
- Wave 3: All 5 tasks touch different files and can run simultaneously

## 6. File Ownership Matrix

| File | Task | Operation |
|------|------|-----------|
| `prompts/implementing-features/PHASE-GATE-PROTOCOL.md` | #1 | CREATE |
| `hooks/config.js` | #2 | MODIFY |
| `hooks/workflow-gate.js` | #3 | CREATE |
| `hooks/compact-reinject.js` | #4 | CREATE |
| `hooks/tracker.js` | #5 | MODIFY |
| `hooks/hooks.json` | #6 | MODIFY |
| `commands/new-feature.md` | #7 | MODIFY |
| `agents/team-leader.md` | #8 | MODIFY |
| `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` | #9 | MODIFY |
| `prompts/implementing-features/README.md` | #10 | MODIFY |
| `prompts/implementing-features/REFERENCE-INDEX.md` | #10 | MODIFY |

**Conflicts: NONE** — no two tasks modify the same file.

## 7. Context Budget

| Task | Files (Create/Modify) | Files (Read) | Estimated Tokens |
|------|----------------------|-------------|-----------------|
| #1 | 1 | 4 | ~14,000 |
| #2 | 1 | 2 | ~13,000 |
| #3 | 1 | 4 | ~15,000 |
| #4 | 1 | 3 | ~13,000 |
| #5 | 1 | 2 | ~14,000 |
| #6 | 1 | 1 | ~12,000 |
| #7 | 1 | 4 | ~16,000 |
| #8 | 1 | 3 | ~15,000 |
| #9 | 1 | 1 | ~14,000 |
| #10 | 2 | 2 | ~14,000 |

All tasks under the 18K threshold. No splitting needed.

## 8. Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hook blocks legitimate agent spawning | Medium | High | Fail-open design: any error in hook = allow. Clear "why blocked" messages. Guards toggle in config. |
| Workflow state file gets corrupted | Low | Medium | Atomic writes (write to .tmp, rename). State file is supplementary — events.jsonl is still source of truth. |
| Compact re-injection adds too much context | Low | Low | Phase Gate Protocol is <100 lines (~2000 tokens). State file is ~500 tokens. Total re-injection ~2500 tokens — well under budget. |
| Hooks slow down every Task tool call | Medium | Medium | Target <100ms. Read one JSON file, check one condition. No git operations in hot path. |

### Scope Risks

| Risk | Mitigation |
|------|----------|
| Feature may not fully prevent step-skipping | Hooks provide hard enforcement for the most critical gate (agent spawning). Prose gates catch the rest. This is a 80/20 solution — perfect enforcement would require a programmatic orchestrator. |
| Users may find enforcement too strict | All gates are toggleable via `guards.workflowGate`. Default is on; users can disable. |

### Integration Risks

| Risk | Mitigation |
|------|----------|
| config.js changes affect existing hooks | Only additive changes — new functions, new default. Existing functions unchanged. |
| tracker.js changes affect event emission | State update in emitEvent is wrapped in try/catch — never disrupts event logging. |
| hooks.json changes break existing hooks | Only additive — new entries, existing entries untouched. |

## 9. QA Strategy

### Per-Task QA Sections

| Task | QA Focus |
|------|----------|
| #1 (Phase Gate Protocol) | Content accuracy, completeness, conciseness (<100 lines) |
| #2 (config.js) | Function correctness, error handling, exports |
| #3 (workflow-gate.js) | Hook protocol compliance, gate logic, fail-open behavior |
| #4 (compact-reinject.js) | Hook protocol compliance, content injection format |
| #5 (tracker.js) | Event-to-state mapping accuracy, no regression in emitEvent |
| #6 (hooks.json) | Valid JSON, correct matchers, no duplicate entries |
| #7-#10 (documentation) | Accuracy, cross-reference integrity, no content loss |

### Feature-Specific QA Checks

- [ ] workflow-gate.js blocks Task tool when gate 3 not passed
- [ ] workflow-gate.js allows Task tool when gate 3 is passed
- [ ] workflow-gate.js fails open on any internal error
- [ ] compact-reinject.js produces valid SessionStart hook output
- [ ] workflow-state.json is created when session.start event is emitted
- [ ] workflow-state.json gates update correctly for each event type
- [ ] hooks.json is valid JSON with no syntax errors
- [ ] All cross-references between files point to correct paths

### Guardian Focus Areas

- File placement: all new files in correct directories (hooks/ for JS, prompts/ for MD)
- Export consistency: config.js exports all new functions
- Hook protocol: both new hooks follow the stdin/stdout JSON protocol
- No circular dependencies between hooks

## 10. Implementation Notes

### Patterns to Follow

- **Hook output protocol**: See `safety-guard.js` for the canonical PreToolUse pattern (stdin JSON, stdout JSON with `decision`/`reason`)
- **SessionStart output**: See `session-start.js` for the `hookSpecificOutput.additionalContext` pattern
- **Config access**: Always use `getWorkflowConfig()` → never read .claude/workflow.json directly
- **Error handling**: All hooks MUST fail open. Wrap everything in try/catch. A broken hook that blocks all operations is worse than no enforcement.
- **Cross-platform paths**: Use `path.join()` and normalize with `replace(/\\/g, '/')` for pattern matching (see config-guard.js)

### Known Gotchas

- The `Task` tool matcher in hooks.json will fire for ALL Task tool calls, not just workflow agents. The gate hook must distinguish workflow spawns from general agent spawns (research, explore). Use heuristics on the prompt content.
- `SessionStart` matcher `compact` fires specifically on context compaction. The existing `startup|resume|clear|compact` matcher in session-start.js handles all cases. The new hook should ONLY use `compact`.
- Workflow state file writes must be atomic — write to `.tmp`, then `fs.renameSync()` — to prevent corruption if the process is killed mid-write.

### Configuration Changes

After implementation, `.claude/workflow.json` guards section supports:
```json
{
  "guards": {
    "branchGuard": true,
    "destructiveGuard": true,
    "configGuard": true,
    "workflowGate": true    // NEW — enables/disables phase gate enforcement
  }
}
```
