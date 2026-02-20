# Reference Index

> Minimal trigger table for workflow reference files. Agents load full content only when needed. The Team Leader pre-digests relevant rules into spawn prompts — most agents never need to read these files directly.

---

## Who Reads What

| File | Team Leader | Coding Agent | QA Agent | Guardian |
|------|:-----------:|:------------:|:--------:|:--------:|
| `the project rules file` | Phase 0 | Phase 0 | Phase 0 | Phase 0 |
| `the architecture file` | Phase 0 | *pre-digested* | *pre-digested* | Phase 0 |
| `README.md` (playbook) | Phase 1 | *pre-digested* | — | — |
| `AGENT-SPAWN-TEMPLATES.md` | Phase 2 | — | — | — |
| `QA-CHECKLIST-TEMPLATE.md` | Step 4 | — | Phase 0 | — |
| `QA-CHECKLIST-AUTO-FILL-RULES.md` | Step 4 | — | — | — |
| `CONTEXT-BUDGET-GUIDE.md` | Step 5 | — | — | — |
| `WORKFLOW-MODES.md` | Phase 1 | — | — | — |
| `PROGRESS-FILE-TEMPLATE.md` | Phase 4 | — | — | — |
| `WAVE-FENCE-PROTOCOL.md` | Phase 6e | — | — | — |
| Agent definition (`agents/*.md`) | — | Phase 0 | Phase 0 | Phase 0 |

*"pre-digested"* = relevant rules are extracted by Team Leader and included in the spawn prompt. The agent does not need to read the full file.

---

## File Summaries (for quick reference)

| File | Purpose | Size |
|------|---------|------|
| `README.md` | Full implementation playbook: phases, progress format, wave execution | ~300 lines |
| `AGENT-SPAWN-TEMPLATES.md` | Copy-paste spawn templates for coding, QA, and guardian agents | ~650 lines |
| `QA-CHECKLIST-TEMPLATE.md` | Checklist sections for QA review (code quality, architecture, etc.) | ~100 lines |
| `QA-CHECKLIST-AUTO-FILL-RULES.md` | Rules for pre-selecting QA sections by agent role | ~80 lines |
| `CONTEXT-BUDGET-GUIDE.md` | Token estimation formula, size limits, splitting protocol | ~155 lines |
| `WORKFLOW-MODES.md` | Strict/Standard/Fast mode definitions | ~170 lines |
| `PROGRESS-FILE-TEMPLATE.md` | Template for progress markdown files | ~50 lines |
| `WAVE-FENCE-PROTOCOL.md` | Inter-wave verification protocol | ~40 lines |
| `REFERENCE-INDEX.md` | This file | ~50 lines |

---

## Model Routing Summary

| Agent Role | Model | Rationale |
|-----------|-------|-----------|
| Team Leader | Opus (user's model) | Complex decomposition, multi-wave reasoning |
| Coding Agent | Sonnet | Focused file-scope work with clear instructions |
| QA Reviewer | Haiku | Read-only review, run checks, report |
| Codebase Guardian | Sonnet | Cross-module structural analysis |
