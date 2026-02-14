# Progress File Template

> Copy this to `the progress directory/<feature-name>-progress.md` when starting a new feature. This file is the **crash-recovery artifact** — when a session terminates unexpectedly, the next session reads this to resume.

---

```markdown
# Feature: <Feature Name>

---
status: PLANNING | IN_PROGRESS | QA_REVIEW | INTEGRATING | COMPLETE
team: <team-name>
base_branch: main
feature_branch: feature/<feature-name>
design_doc: <path or "N/A">
started: <YYYY-MM-DD HH:MM>
last_updated: <YYYY-MM-DD HH:MM>
updated_by: <agent name or "team-lead">
workflow_mode: strict | standard | fast
---

---

## Branch Status

| Branch | Task | Agent | Status | Merged to Feature? |
|--------|------|-------|--------|---------------------|
| work/<feature>/schema-design | #1 | schema-designer | COMPLETE | YES |
| work/<feature>/api-service | #2 | service-eng | IN_PROGRESS | NO |
| work/<feature>/ui-components | #3 | component-eng | PENDING | NO |

---

## Agent Registry

| Agent Name | Role | Workbranch | Task ID | Status | QA Round | Notes |
|------------|------|------------|---------|--------|----------|-------|
| | | | | PENDING / IN_PROGRESS / QA / COMPLETE / FAILED | 0/3 | |

---

## Task Progress

### Task #1: <task name> [STATUS]
- **Agent**: <agent-name>
- **Workbranch**: work/<feature>/<task-slug>
- **Files Created**: <list>
- **Files Modified**: <list>
- **Steps**:
  - Step 1: <description> ✅ | 🔄 | ⬜
  - Step 2: <description> ✅ | 🔄 | ⬜
- **QA Status**: NOT STARTED | IN_REVIEW | PASS | FAIL (round X/3)
- **QA Doc Updates**: <list of docs updated by QA, or "pending">
- **Merged**: YES / NO
- **Merge Commit**: <short hash or "pending">

### Task #2: <task name> [STATUS]
- **Blocked By**: Task #1
- ...

---

## Dependency Graph

```
#1 Schema ──▶ #2 Service ──▶ #3 Handlers ──▶ #5 Hooks ──▶ #6 Components
                                                   ▲
#4 Store ─────────────────────────────────────────┘
                                                                    │
                                                                    ▼
                                                         #7 Guardian Check
```

---

## Merge Log

| Order | Branch | Merged At | Conflicts? | Resolution |
|-------|--------|-----------|------------|------------|
| 1 | work/<feature>/schema-design | <ISO timestamp> | None | — |
| 2 | work/<feature>/api-service | | | |

---

## QA Results

### Task #1 — Round 1
- **Reviewer**: <qa-agent-name>
- **Automated**: lint ✅/❌ | typecheck ✅/❌ | test ✅/❌ | build ✅/❌
- **Code Review**: <summary>
- **Doc Updates**: <files updated by QA>
- **Verdict**: APPROVED / REJECTED
- **Issues**: <count and brief list if rejected>

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
- [ ] Automated checks pass on merged feature branch (lint, typecheck, test, build)
- [ ] Codebase Guardian check PASS
- [ ] Progress file status set to COMPLETE
- [ ] Design doc status updated (if applicable)
- [ ] Final commit on feature branch
- [ ] PR created (if requested)

---

## Recovery Notes

If this feature is resumed by a new session:

1. Read this file for current state
2. Run `git branch --list "work/<feature>/*"` to check active workbranches
3. Run `git status` to check uncommitted work
4. Check `~/.claude/teams/<team-name>/config.json` for team state (if using teams)
5. Use `TaskList` to get current task status (if using teams)
6. Resume from the first non-COMPLETE task
7. Update "Last Updated" and "Updated By" fields
```
