# Context Budget Guide

> Estimate context window usage before spawning agents. If a task exceeds the budget, split it into smaller tasks. This prevents the "ran out of context" failure mode where agents lose track of rules and plans.

---

## Why Context Budget Matters

Agents operate within a finite context window. When context fills up:
- Early instructions (rules, plans) get compressed or lost
- The agent loses track of its task scope
- Code quality drops as the agent "forgets" conventions
- QA failures increase, wasting rounds

Proactive context budgeting prevents these failures.

---

## Context Estimation Table

Use this table to estimate context consumption for a task:

| Activity | Estimated Context Cost | Notes |
|----------|----------------------|-------|
| Phase 0: Load Rules | ~3,000–5,000 tokens | Project rules + architecture + agent def + playbook |
| Phase 1: Write Plan | ~1,000–2,000 tokens | Plan output stays in context |
| Reading existing files | ~500–1,500 tokens per file | Depends on file size |
| Writing new code | ~200–800 tokens per file | Depends on complexity |
| Modifying existing code | ~300–1,000 tokens per file | Read + edit + verify |
| Running commands | ~100–500 tokens per command | Command + output |
| Error recovery | ~500–2,000 tokens per error | Re-read plan + debug + fix |
| Self-review (Phase 3) | ~500–1,000 tokens | Re-read plan + verify |
| QA spawn message | ~1,000–2,000 tokens | Plan + files + checklist |

### Quick Estimate Formula

```
Estimated context = Base overhead + (files × per-file cost) + error margin

Where:
  Base overhead     = 8,000 tokens (Phase 0 + Phase 1 + Phase 3 + QA spawn)
  Per-file cost     = 1,000 tokens (read + write/edit + verify)
  Error margin      = 3,000 tokens (for unexpected errors, re-reads)
```

---

## Size Limits

| Task Size | Files | Estimated Context | Recommendation |
|-----------|-------|-------------------|----------------|
| Small | 1–3 files | ~12,000 tokens | Single agent, no concerns |
| Medium | 4–7 files | ~18,000 tokens | Single agent, monitor |
| Large | 8–12 files | ~25,000 tokens | Consider splitting |
| Too Large | 13+ files | ~30,000+ tokens | Must split |

> **Rule of thumb**: If a task touches more than 10 files, split it.

---

## Splitting Protocol

When a task exceeds the context budget:

### Step 1: Identify Natural Split Points

Look for:
- **Layer boundaries** — split types/schemas from implementation
- **Feature boundaries** — split independent sub-features
- **File group boundaries** — split by directory or module

### Step 2: Create Sub-Tasks

Each sub-task must:
- Be independently completable (has its own acceptance criteria)
- Touch a distinct set of files (no overlap with other sub-tasks)
- Have a clear dependency relationship with other sub-tasks

### Step 3: Assign to Waves

Sub-tasks from the same original task often fall into adjacent waves:
```
Original: "Build settings service" (12 files)
  ↓ Split into:
  Task A: "Define settings types and schemas" (3 files) → Wave 1
  Task B: "Implement settings CRUD service" (4 files) → Wave 2
  Task C: "Create settings API handlers" (3 files) → Wave 3
  Task D: "Add settings validation middleware" (2 files) → Wave 3
```

---

## Team Leader Protocol

### Before Spawning Each Agent

1. Count the files in the task (create + modify + read-for-context)
2. Apply the quick estimate formula
3. If over the Medium threshold (18,000 tokens):
   - Flag the task for potential splitting
   - Consider which files are "read for context" vs "actually modify" — only count modifications
   - If still over threshold after re-assessment: split per the protocol above
4. Record the estimate in the progress file

### In the Agent Spawn Template

Include a context budget note in the agent's prompt:

```markdown
## Context Budget

This task is estimated at ~<N> tokens of context.
Files to create/modify: <count>
Files to read for context: <count>

If you find yourself running low on context:
1. Re-read your Phase 1 plan (it's your anchor)
2. Focus on the remaining steps in order
3. Skip non-essential reads (you've already internalized the rules)
4. Report to Team Leader if you cannot complete all steps
```

---

## Context Budget in the Progress File

Record estimates per task:

```markdown
## Context Budget

| Task | Files (Create/Modify) | Files (Read) | Estimated Tokens | Actual Outcome |
|------|----------------------|-------------|-----------------|----------------|
| #1 | 3 | 2 | ~14,000 | Completed, no issues |
| #2 | 7 | 3 | ~20,000 | Split into #2a, #2b |
| #2a | 4 | 2 | ~15,000 | Completed, no issues |
| #2b | 3 | 1 | ~13,000 | Completed, no issues |
```

This data helps calibrate the estimation table over time.

---

## Mode Interaction

| Mode | Context Budget Check |
|------|---------------------|
| Strict | Check before every agent spawn |
| Standard | Check before every agent spawn |
| Fast | Skip — trust the Team Leader's judgment |
