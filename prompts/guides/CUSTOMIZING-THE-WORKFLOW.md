# Customizing the Workflow

> Guide for tailoring the multi-agent orchestration workflow to your project. Everything in this skill pack is plain markdown — you own it, you can change it.

---

## Table of Contents

1. [Adjusting the Phased Workflow](#1-adjusting-the-phased-workflow)
2. [Adjusting the Branching Model](#2-adjusting-the-branching-model)
3. [Adjusting Progress Tracking](#3-adjusting-progress-tracking)
4. [Adjusting the Merge Protocol](#4-adjusting-the-merge-protocol)
5. [Adjusting QA Checks](#5-adjusting-qa-checks)
6. [Template Variable Reference](#6-template-variable-reference)
7. [Workflow Modes](#7-workflow-modes)

---

## 1. Adjusting the Phased Workflow

The agent phased workflow (Phase 0–4) is defined in `AGENT-SPAWN-TEMPLATES.md`. Every agent follows it.

### Adding or Removing Phases

Open `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` and edit the Standard Coding Agent Spawn template.

**To add a phase** (e.g., a security review before self-review):
1. Insert the phase between the existing phases
2. Mark it `[BLOCKING]` if it must complete before the next phase
3. Update the phase numbering in all three spawn templates (coding, QA, Guardian)

**To remove a phase** (e.g., skip self-review for simple tasks):
1. Delete the phase block from the template
2. Adjust the phase numbering
3. Update references in the QA and Guardian templates

> **Warning**: Removing Phase 1 (Write Plan) is not recommended. The written plan is the primary mechanism for preventing agent drift and enabling QA verification.

### Adjusting Error Recovery Limits

In `AGENT-SPAWN-TEMPLATES.md`, the Error Recovery Protocol sets:
- **Max fix attempts per error**: 2 (search for `max 2 attempts`)
- **Max QA rounds**: 3 (search for `max 3 rounds`)

To change these, update the numbers in:
- The Standard Coding Agent template (Error Recovery Protocol section)
- The QA Review Agent template (round tracking)
- `agents/qa-reviewer.md` (Rules section, item 7)
- `prompts/implementing-features/README.md` (Section 7: QA Round Limits)

### Making QA More or Less Strict

**More strict** — add requirements to the QA checklist:
- Edit `QA-CHECKLIST-TEMPLATE.md` to add permanent checks
- Add sections like "Performance", "Concurrency", "Backwards Compatibility"

**Less strict** — reduce the QA scope:
- Remove optional sections from `QA-CHECKLIST-TEMPLATE.md` (e.g., remove UI Checks for backend-only projects)
- Reduce QA rounds from 3 to 2 or 1

---

## 2. Adjusting the Branching Model

The default branching model uses `feature/` and `work/` branches. All branching logic lives in:
- `prompts/implementing-features/README.md` (Section 2)
- `agents/team-leader.md` (Branching Model section)
- `commands/implement-feature.md` (Phases 4, 6)

### Changing Branch Naming Conventions

To rename `work/` to `task/` or any other prefix:

1. Search-and-replace across all template files:
   - `work/<feature-name>/<task-slug>` → `task/<feature-name>/<task-slug>`
   - `work/<feature>` → `task/<feature>`
   - `"work/*"` → `"task/*"`
2. Update the branch hierarchy diagrams in `README.md` (playbook) and `team-leader.md`

### Switching to Worktrees

For advanced users who prefer git worktrees over branches:

1. Replace the branch creation commands in `implement-feature.md` Phase 6a:
   ```bash
   # Instead of:
   git checkout -b work/<feature>/<task-slug>
   # Use:
   git worktree add ../worktrees/<task-slug> -b work/<feature>/<task-slug>
   ```
2. Update the merge protocol to remove worktrees after merge:
   ```bash
   git worktree remove ../worktrees/<task-slug>
   git branch -d work/<feature>/<task-slug>
   ```
3. Update agent spawn templates to set the correct working directory

> **Note**: Worktrees enable true parallel execution (multiple agents writing simultaneously) but add complexity. Only use if you've experienced file conflicts with the branch model.

### Trunk-Based Development

For short-lived feature branches:

1. Set a convention that feature branches live for at most 1-2 days
2. Reduce waves to 1-2 (smaller features)
3. Consider using `/hotfix` for single-task changes instead of `/implement-feature`

---

## 3. Adjusting Progress Tracking

### Changing the Progress File Location

The progress directory variable (default: `docs/progress`) is used everywhere. To change it:

1. Run `npx create-claude-workflow init` and specify a different directory
2. Or manually update progress directory references in:
   - `commands/implement-feature.md`
   - `prompts/implementing-features/README.md`
   - `prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md`
   - `agents/team-leader.md`
   - `agents/codebase-guardian.md`

### Adding Custom Fields to the Progress File

Edit `prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md` to add sections:

```markdown
## Custom Tracking

### Sprint Context
- Sprint: <sprint name or number>
- Jira Epic: <link>
- Estimated Points: <N>

### Reviewer Notes
- <free-form notes from manual review>
```

### Integrating with External Tracking

The progress file is plain markdown — you can parse it with scripts:

```bash
# Extract status from progress file
grep "^\\*\\*Status\\*\\*:" docs/progress/*-progress.md

# Count tasks by status
grep -c "\\[COMPLETE\\]" docs/progress/*-progress.md
```

For CI integration, see the GitHub Actions workflow example in the project README.

---

## 4. Adjusting the Merge Protocol

### Switching to Squash Merges

In `prompts/implementing-features/README.md` (Section 8) and `team-leader.md`:

Replace:
```bash
git merge --no-ff work/<feature>/<task-slug> -m "Merge ..."
```

With:
```bash
git merge --squash work/<feature>/<task-slug>
git commit -m "<type>: <task summary>"
```

> **Trade-off**: Squash merges produce a cleaner history but lose individual commit granularity on the feature branch.

### Adding CI as a Merge Gate

Add a step after the rebase in the merge protocol:

```markdown
### Pre-Merge CI Check
After rebasing the workbranch, push it and wait for CI:
1. `git push -u origin work/<feature>/<task-slug>`
2. Wait for CI checks to pass
3. Only then merge to feature branch
```

### Requiring User Approval Before Merge

Add to `team-leader.md` Coordination Rules:

```markdown
9. **Always ask user before merging** — present QA results and ask for merge approval
```

And add a step in `implement-feature.md` Phase 6d:

```markdown
Before merging, present the QA report to the user and wait for approval.
```

---

## 5. Adjusting QA Checks

### Adding Permanent Project-Specific Checks

Edit `QA-CHECKLIST-TEMPLATE.md` and add checks to the appropriate section:

```markdown
## Project-Specific Checks (Permanent)

### API Standards
- [ ] All endpoints have rate limiting middleware
- [ ] All endpoints return structured error responses
- [ ] All database queries use parameterized statements

### Component Standards
- [ ] All React components have a Storybook story
- [ ] All interactive elements meet WCAG 2.1 AA
- [ ] All forms have client-side and server-side validation
```

These will be included in every task's QA checklist automatically.

### Technology-Specific QA Extensions

For stack-specific checks, create extension files:

```
prompts/implementing-features/
├── QA-CHECKLIST-TEMPLATE.md          ← base checklist (always included)
├── QA-CHECKLIST-REACT.md             ← React-specific checks (opt-in)
├── QA-CHECKLIST-PYTHON.md            ← Python-specific checks (opt-in)
└── QA-CHECKLIST-ELECTRON.md          ← Electron-specific checks (opt-in)
```

Reference the extension in the Team Leader's task assignment:
```markdown
QA Checklist: Include base + QA-CHECKLIST-REACT.md
```

### QA Checklist Auto-Fill

See [`QA-CHECKLIST-AUTO-FILL-RULES.md`](../implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md) for rules that map agent roles to QA checklist sections. This reduces boilerplate — the Team Leader only needs to add feature-specific checks.

---

## 6. Template Variable Reference

All template files use descriptive references that should be adapted to your project.

| Variable | Default | Used In | Purpose |
|----------|---------|---------|---------|
| Project name | Directory name | Progress file | Project identifier |
| Project rules file | `CLAUDE.md` | All agents, commands | Path to project rules |
| Architecture file | `docs/ARCHITECTURE.md` | All agents, commands | Path to architecture doc |
| Progress directory | `docs/progress` | Commands, playbook, agents | Progress file directory |
| Agent role | Per agent | Agent definitions | Agent's role name |
| Agent file scope | Per agent | Agent definitions | Files the agent may modify |
| Agent excluded files | Per agent | Agent definitions | Files the agent must not touch |

### Adding Custom Variables

1. Define the variable in your scaffolding config or replace manually after install
2. Common additions:
   - Test command — `npm run test` or `pytest` or `go test ./...`
   - Lint command — `npm run lint` or `ruff check` or `golangci-lint run`
   - Build command — `npm run build` or `cargo build` or `go build`
   - Default branch — `main` or `master` or `develop`

### Common Configurations

**Monorepo (Nx, Turborepo)**:
```
Progress directory = docs/progress
Architecture file = docs/ARCHITECTURE.md
Agent scopes use package-relative paths: packages/web/src/components/**
```

**Python project**:
```
Project rules file = pyproject.toml  (or a CLAUDE.md that references it)
Test command = pytest
Lint command = ruff check
```

---

## 7. Workflow Modes

The workflow supports three modes that control how much ceremony is applied. See [`WORKFLOW-MODES.md`](../implementing-features/WORKFLOW-MODES.md) for full details.

| Mode | QA Rounds | Guardian | Pre-Flight | Logging | Best For |
|------|-----------|----------|------------|---------|----------|
| `strict` | 3 | Yes | Yes | Yes | Production features, critical paths |
| `standard` | 2 | Yes (auto-fix trivial) | No | No | Normal development |
| `fast` | 1 | No | No | No | Prototyping, spikes, small changes |

Set the mode in `the project rules file`:
```markdown
## Workflow Mode
Mode: standard
```

Or per invocation when calling `/implement-feature` or `/hotfix`.

The Team Leader reads the mode and adjusts behavior accordingly. Other agents do not need to know the mode — the Team Leader handles the differences.
