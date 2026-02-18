# Progress File Template — current.md

> This is the template for `.claude/progress/<feature>/current.md` — the human-readable summary auto-rendered from `events.jsonl`.

---

## About

The progress tracking system uses three files per feature:

| File | Purpose | Source of Truth? |
|------|---------|-----------------|
| `events.jsonl` | Append-only event log | **YES** — all state is derived from this |
| `current.md` | Active task state (rendered) | No — regenerated from JSONL |
| `history.md` | Full timeline (rendered) | No — regenerated from JSONL |

The `current.md` file is rendered after significant events: `task.completed`, `qa.passed/failed`, `branch.merged`, `session.start/end`, `checkpoint`, `blocker.reported`, `plan.created`.

---

## Template

```markdown
# <Feature Name> — Current State

> Auto-generated from events.jsonl. Do not edit manually.

## Status: <PLANNING | IN_PROGRESS | QA_REVIEW | INTEGRATING | COMPLETE>

| Field | Value |
|-------|-------|
| Feature | <feature-slug> |
| Branch | feature/<feature-name> |
| Base Branch | <main/master> |
| Started | <timestamp> |
| Last Updated | <timestamp> |
| Mode | <strict/standard/fast> |
| Session | <sid> |

## Active Wave

Wave <N> of <total> — <status>

## Tasks

| # | Task | Agent | Status | QA | Branch | Worktree |
|---|------|-------|--------|-----|--------|----------|
| 1 | <task name> | <agent> | COMPLETE | PASS (round 1) | merged | removed |
| 2 | <task name> | <agent> | IN_PROGRESS | — | <workPrefix>/<feature>/<task> | <worktreeDir>/<feature>/<task> |
| 3 | <task name> | <agent> | PENDING | — | not created | — |

## Blockers

| Blocker | Task | Agent | Reported |
|---------|------|-------|----------|
| None | | | |

## Last Checkpoint

<label> — <timestamp>

## Last 5 Events

| Time | Type | Details |
|------|------|---------|
| HH:MM | <type> | <summary> |
```

---

## Event Schema Reference

See [`EVENT-SCHEMA.md`](./EVENT-SCHEMA.md) for the full JSONL event type reference.

## Resume Protocol

See [`RESUME-PROTOCOL.md`](./RESUME-PROTOCOL.md) for crash recovery from JSONL logs.
