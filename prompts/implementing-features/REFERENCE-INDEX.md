# Reference Index

> Minimal trigger table for workflow reference files. Agents load full content only when needed. The Team Leader pre-digests relevant rules into spawn prompts — most agents never need to read these files directly.

---

## Who Reads What

| File | Team Leader | Coding Agent | QA Agent | Guardian |
|------|:-----------:|:------------:|:--------:|:--------:|
| `the project rules file` | Phase 0 | Phase 0 | Phase 0 | Phase 0 |
| `the architecture file` | Phase 0 | *pre-digested* | *pre-digested* | Phase 0 |
| `README.md` (playbook) | Phase 1 | *pre-digested* | — | — |
| `THIN-SPAWN-TEMPLATE.md` | Phase 2 | — | — | — |
| `AGENT-WORKFLOW-PHASES.md` | — | Phase 0 | Phase 0 | Phase 0 |
| `QA-CHECKLIST-TEMPLATE.md` | Step 4 | — | Phase 0 | — |
| `QA-CHECKLIST-AUTO-FILL-RULES.md` | Step 4 | — | — | — |
| `CONTEXT-BUDGET-GUIDE.md` | Step 5 | — | — | — |
| `WORKFLOW-MODES.md` | Phase 1 | — | — | — |
| `PROGRESS-FILE-TEMPLATE.md` | Phase 4 | — | — | — |
| `PHASE-GATE-PROTOCOL.md` | Phase 0 (first!) | — | — | — |
| `PRE-FLIGHT-CHECKS.md` | Phase 1 | — | — | — |
| `EVENT-SCHEMA.md` | Phase 3 | — | — | — |
| `WAVE-FENCE-PROTOCOL.md` | Phase 3 | — | — | — |
| Agent definition (`agents/*.md`) | — | Phase 0 | Phase 0 | Phase 0 |

*"pre-digested"* = relevant rules are extracted by Team Leader and included in the spawn prompt. The agent does not need to read the full file.

---

## File Summaries (for quick reference)

| File | Purpose | Size |
|------|---------|------|
| `README.md` | Full implementation playbook: phases, progress format, wave execution | ~300 lines |
| `THIN-SPAWN-TEMPLATE.md` | ~500 token thin spawn templates for coding, QA, and guardian agents | ~100 lines |
| `AGENT-WORKFLOW-PHASES.md` | Agent-side workflow phases (0-4) that agents follow after spawn | ~150 lines |
| `QA-CHECKLIST-TEMPLATE.md` | Checklist sections for QA review (code quality, architecture, etc.) | ~100 lines |
| `QA-CHECKLIST-AUTO-FILL-RULES.md` | Rules for pre-selecting QA sections by agent role | ~80 lines |
| `CONTEXT-BUDGET-GUIDE.md` | Token estimation formula, size limits, splitting protocol | ~155 lines |
| `WORKFLOW-MODES.md` | Strict/Standard/Fast mode definitions | ~170 lines |
| `PHASE-GATE-PROTOCOL.md` | Workflow state machine — sequential gates with binary conditions for phase enforcement | ~97 lines |
| `PROGRESS-FILE-TEMPLATE.md` | Template for progress markdown files | ~50 lines |
| `PRE-FLIGHT-CHECKS.md` | Codebase baseline verification before spawning agents (strict mode) | ~140 lines |
| `EVENT-SCHEMA.md` | JSONL event type reference for progress tracking | ~80 lines |
| `WAVE-FENCE-PROTOCOL.md` | Inter-wave verification protocol | ~40 lines |
| `IDEAS-BACKLOG-TEMPLATE.md` | Template for capturing improvement ideas during execution | ~30 lines |
| `AGENT-PERFORMANCE-LOG-TEMPLATE.md` | Template for logging agent performance metrics | ~40 lines |
| `REFERENCE-INDEX.md` | This file | ~60 lines |

---

## Model Routing Summary

| Agent Role | Model | Rationale |
|-----------|-------|-----------|
| Team Leader | Opus (user's model) | Complex decomposition, multi-wave reasoning |
| Coding Agent | Sonnet | Focused file-scope work with clear instructions |
| QA Reviewer | Haiku | Read-only review, run checks, report |
| Codebase Guardian | Sonnet | Cross-module structural analysis |
