---
description: "Scan all agent definitions, validate scopes against project structure, flag issues"
---

# /audit-agents — Review Agent Definitions Against Codebase

> Invoke this skill to scan agent definitions, compare their scopes against the current project structure, and identify stale paths, overlapping scopes, and uncovered directories.

---

## When to Use

- After restructuring your project (renamed/moved directories)
- After adding new modules or domains to your codebase
- When agents are failing due to scope issues
- Periodically, to ensure agent definitions stay current

---

## Phase 1: Scan Agent Definitions

Read every file in `.claude/agents/`:

```bash
ls .claude/agents/
```

For each agent file, extract:
- **Role name** (from the `# Title` heading)
- **Scope patterns** (from the `Scope — Files You Own` section, `ONLY` lines)
- **Exclusion patterns** (from the `NEVER modify` lines)
- **Initialization files** (from the `Initialization Protocol` section)
- **Rules count** (from the `Rules — Non-Negotiable` section)

Build an agent registry table:

```
Agent Registry:
| Agent | Scope Patterns | Exclusions | Rules |
|-------|---------------|------------|-------|
| team-leader | (orchestration only) | all application code | 8 |
| qa-reviewer | (read-only) | all application code | 7 |
| codebase-guardian | (read-only) | — | 7 |
| component-engineer | src/components/**, src/pages/** | src/services/** | 5 |
| service-engineer | src/services/** | src/components/** | 4 |
```

---

## Phase 2: Index Current Project Structure

Scan the project to build a file/directory map:

```bash
# Get all source directories (adjust patterns to project)
find src/ -type d 2>/dev/null
find app/ -type d 2>/dev/null
find lib/ -type d 2>/dev/null
find packages/ -type d 2>/dev/null

# Get all source files by type
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
       -o -name "*.py" -o -name "*.go" -o -name "*.rs" 2>/dev/null | head -200
```

Build a directory tree of the project's source code.

---

## Phase 3: Analyze

Run three analyses:

### 3a. Stale Path Detection

For each agent's scope patterns, check if matching files/directories exist:

```
Stale Path Check:
  component-engineer scope: src/components/**
    → src/components/ EXISTS ✓ (42 files)

  service-engineer scope: src/services/**
    → src/services/ EXISTS ✓ (15 files)

  api-engineer scope: src/routes/**
    → src/routes/ NOT FOUND ✗ (directory does not exist)
    → Possibly renamed to: src/api/ (found similar directory)
```

Flag agents with scope patterns that match no files.

### 3b. Scope Overlap Detection

Compare every pair of agents for file pattern overlaps:

```
Scope Overlap Check:
  component-engineer (src/components/**) vs service-engineer (src/services/**):
    → NO OVERLAP ✓

  component-engineer (src/components/**) vs hook-engineer (src/hooks/**, src/components/**/use*.ts):
    → OVERLAP DETECTED: src/components/**/use*.ts
    → Files affected: src/components/auth/useAuth.ts, src/components/settings/useSettings.ts
```

For each overlap, list the specific files that would be claimed by both agents.

### 3c. Uncovered Directory Detection

Compare the project's source directories against all agent scopes:

```
Coverage Check:
  src/components/    → component-engineer ✓
  src/services/      → service-engineer ✓
  src/hooks/         → hook-engineer ✓
  src/utils/         → UNCOVERED ⚠
  src/workers/       → UNCOVERED ⚠
  src/middleware/     → UNCOVERED ⚠
  prisma/            → UNCOVERED ⚠
```

List directories with source files that no agent claims ownership of.

---

## Phase 4: Report

Present the full audit report:

```
═══════════════════════════════════════════════════════════
  AGENT AUDIT REPORT
═══════════════════════════════════════════════════════════

  Agents scanned:      <count>
  Project directories: <count>
  Source files:        <count>

  ─── Agent Health ───────────────────────────────────────

  | Agent | Scope Status | Issues |
  |-------|-------------|--------|
  | team-leader | OK ✓ | — |
  | qa-reviewer | OK ✓ | — |
  | component-engineer | OK ✓ | — |
  | service-engineer | OK ✓ | — |
  | api-engineer | STALE ✗ | src/routes/ not found |
  | hook-engineer | OVERLAP ⚠ | overlaps with component-engineer |

  ─── Scope Overlaps ────────────────────────────────────

  | Agent A | Agent B | Overlapping Pattern | Files |
  |---------|---------|--------------------:|-------|
  | component-engineer | hook-engineer | src/components/**/use*.ts | 3 files |

  ─── Uncovered Directories ─────────────────────────────

  | Directory | File Count | Suggested Agent |
  |-----------|-----------|-----------------|
  | src/utils/ | 8 files | (general — assign to nearest agent) |
  | src/workers/ | 5 files | worker-engineer (new) |
  | src/middleware/ | 3 files | api-engineer (expand scope) |
  | prisma/ | 4 files | database-engineer (new) |

═══════════════════════════════════════════════════════════
```

---

## Phase 5: Suggest Fixes

For each issue found, suggest a specific fix:

### Stale Paths

```
FIX: api-engineer has stale scope "src/routes/**"
  The directory src/routes/ no longer exists.
  Likely renamed to: src/api/

  Action: Update .claude/agents/api-engineer.md
    Change: ONLY create/modify files matching: src/routes/**
    To:     ONLY create/modify files matching: src/api/**
```

### Scope Overlaps

```
FIX: component-engineer and hook-engineer overlap on src/components/**/use*.ts
  Both agents claim ownership of hook files inside component directories.

  Option A: Assign to hook-engineer (hooks are its primary domain)
    → Add to component-engineer exclusions: src/components/**/use*.ts
  Option B: Assign to component-engineer (component co-located hooks)
    → Add to hook-engineer exclusions: src/components/**/use*.ts
```

### Uncovered Directories

```
FIX: src/workers/ has no agent coverage (5 source files)

  Option A: Create a new agent
    → Run /scaffold-agent to create worker-engineer
  Option B: Expand an existing agent's scope
    → Add src/workers/** to service-engineer's scope
```

Reference the agent creation guide:

```
For guidance on creating or updating agents, see:
  prompts/guides/CREATING-AGENTS.md
  Or run /scaffold-agent to create a new agent interactively
```
