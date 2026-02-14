# Feature: Global Skill Refactor

---
status: IN_PROGRESS
team: global-skill-refactor
base_branch: master
feature_branch: feature/global-skill-refactor
design_doc: docs/plans/global-skill-refactor.md
started: 2026-02-14 12:00
last_updated: 2026-02-14 12:00
updated_by: team-lead
workflow_mode: standard
---

---

## Summary

Complete the plugin restructure by removing the old npm scaffolder infrastructure
(templates/, lib/, bin/, package.json, .npmignore) that has been replaced by the
Claude Code plugin system. The plugin-restructure branch has already been merged —
this feature handles cleanup, documentation updates, and cross-reference validation.

---

## Branch Status

| Branch | Task | Agent | Status | Merged to Feature? |
|--------|------|-------|--------|---------------------|
| work/global-skill-refactor/cleanup-scaffolder | #1 | cleanup-engineer | PENDING | NO |
| work/global-skill-refactor/update-docs | #2 | docs-engineer | PENDING | NO |
| work/global-skill-refactor/cross-ref-audit | #3 | audit-engineer | PENDING | NO |

---

## Agent Registry

| Agent Name | Role | Workbranch | Task ID | Status | QA Round | Notes |
|------------|------|------------|---------|--------|----------|-------|
| cleanup-engineer | scaffolder removal | work/global-skill-refactor/cleanup-scaffolder | #1 | PENDING | 0/2 | Wave 1 |
| docs-engineer | documentation update | work/global-skill-refactor/update-docs | #2 | PENDING | 0/2 | Wave 1 |
| audit-engineer | cross-reference audit | work/global-skill-refactor/cross-ref-audit | #3 | PENDING | 0/2 | Wave 2 |

---

## Task Progress

### Task #1: Remove old scaffolder infrastructure [PENDING]
- **Agent**: cleanup-engineer
- **Workbranch**: work/global-skill-refactor/cleanup-scaffolder
- **Files to Remove**: templates/, lib/, bin/, package.json, .npmignore, SPEC-v1-trim.md
- **QA Status**: NOT STARTED
- **Merged**: NO

### Task #2: Update project documentation [PENDING]
- **Agent**: docs-engineer
- **Workbranch**: work/global-skill-refactor/update-docs
- **Files to Modify**: README.md, CHANGELOG.md, docs/internal/DEVELOPMENT-LOG.md
- **QA Status**: NOT STARTED
- **Merged**: NO

### Task #3: Cross-reference audit & fix [PENDING]
- **Agent**: audit-engineer
- **Workbranch**: work/global-skill-refactor/cross-ref-audit
- **Files to Audit**: commands/*.md, agents/*.md, prompts/**/*.md, hooks/*.js, skills/**/*.md
- **Blocked By**: Task #1, Task #2
- **QA Status**: NOT STARTED
- **Merged**: NO

---

## Dependency Graph

```
#1 Cleanup ──┐
             ├──▶ #3 Cross-ref Audit ──▶ Guardian
#2 Docs ─────┘
```

---

## Merge Log

| Order | Branch | Merged At | Conflicts? | Resolution |
|-------|--------|-----------|------------|------------|
| 0 | feature/plugin-restructure (base merge) | 2026-02-14 | README.md | Took plugin-restructure version |

---

## QA Results

(none yet)

---

## Blockers

| Blocker | Affected Task | Reported By | Status | Resolution |
|---------|---------------|-------------|--------|------------|
| None | | | | |

---

## Integration Checklist

- [ ] All tasks COMPLETE with QA PASS
- [ ] All workbranches merged to feature branch (in order)
- [ ] All workbranches deleted after merge
- [ ] Codebase Guardian check PASS
- [ ] Progress file status set to COMPLETE
- [ ] Final commit on feature branch

---

## Recovery Notes

If this feature is resumed by a new session:

1. Read this file for current state
2. Run `git branch --list "work/global-skill-refactor/*"` to check active workbranches
3. Run `git status` to check uncommitted work
4. Resume from the first non-COMPLETE task
5. Update "Last Updated" and "Updated By" fields
