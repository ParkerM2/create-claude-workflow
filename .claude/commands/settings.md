---
description: "Workflow settings hub — guard permissions, agent audit, and performance audit"
---

# /settings — Workflow Settings & Audits

> Manage workflow configuration, toggle guard hooks, audit agent definitions, and diagnose performance bottlenecks.

---

## Phase 1: Present Menu

Use `AskUserQuestion` to ask the user what they want to do:

**Question**: "What would you like to configure or audit?"

Options:
1. **Guard Permissions** — Toggle branch guard, destructive guard, and config guard on/off. Controls which PreToolUse hooks are active.
2. **Audit Agents** — Scan agent definitions, validate scopes against project structure, flag stale paths, overlaps, and uncovered directories.
3. **Audit Performance** — Diagnose workflow performance bottlenecks: file sizes, hook overhead, context budget, progress file growth.

---

## Phase 2: Execute Selected Flow

Based on the user's selection, read and follow the corresponding sub-flow file:

### If "Guard Permissions" selected:

Read and follow: `prompts/settings/guard-permissions.md`

(This file contains the full guard permissions workflow — reading current settings, presenting the toggle checklist, and updating `.claude/workflow.json`.)

### If "Audit Agents" selected:

Read and follow: `prompts/settings/audit-agents.md`

(This file contains the full agent audit workflow — scanning definitions, indexing project structure, detecting stale paths/overlaps/uncovered directories, and generating a report with fix suggestions.)

### If "Audit Performance" selected:

Read and follow: `prompts/settings/audit-performance.md`

(This file contains the full performance audit workflow — measuring file sizes, counting hooks, checking context budgets, and generating a 10-category report with recommendations.)
