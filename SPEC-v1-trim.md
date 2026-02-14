# Spec: v1 Focus Trim

> **Status: COMPLETED** — All 8 file changes implemented and verified. See `docs/internal/DEVELOPMENT-LOG.md` for details.

> Cut the fat, sharpen the core. Ship a tool that does multi-agent orchestration extremely well and is naturally extensible — not a platform that tries to do everything.

---

## Guiding Principles

1. **One command is the product**: `/implement-feature` is what people adopt. Everything else supports it or extends it.
2. **60-second setup**: `npx create-claude-workflow init` should ask 3 questions, not 5+.
3. **Show, don't enumerate**: Lead with a demo walkthrough, not a feature list.
4. **Essential reads, not required reads**: Agents should read 4 files to start working, not 9.
5. **Extension points, not extensions**: Ship the hooks for customization, not every possible customization.

---

## Change 1: README Restructure

**Goal**: A new user reads the README and thinks "I want this" within 30 seconds, then gets productive in 60 seconds.

### Current Problems
- Opens with a flowchart before explaining what the tool does
- 13-row feature table is overwhelming
- 12 commands listed equally — no hierarchy
- Architecture section shows internal scaffolder structure (users don't care)
- "Why This Exists" is at the bottom — should be the hook

### New README Structure

```
# create-claude-workflow

One-line pitch.

## 3-Step Quick Start
  1. npx create-claude-workflow init
  2. /discover-agents
  3. /implement-feature "your feature"

## What Happens When You Run /implement-feature
  (walkthrough with branching diagram — KEEP existing mermaid charts)
  - Team Leader reads your rules, decomposes the feature
  - Agents work on isolated branches, plan before coding
  - Each agent gets its own QA reviewer
  - Codebase Guardian runs final structural check
  - Clean PR, no conflicts

## Why This Exists (move UP from bottom)
  (KEEP existing table — it's good, just move it higher)

## Core Commands
  | /implement-feature | ... |
  | /discover-agents   | ... |
  | /resume-feature    | ... |

## Extended Commands
  > These ship with the workflow and are available when you need them.
  > They cost nothing until invoked (zero context).
  | /claude-new        | ... |
  | /create-feature-plan | ... |
  | /hotfix            | ... |
  | /refactor          | ... |
  | /generate-tests    | ... |
  | /review-pr         | ... |
  | /scaffold-agent    | ... |
  | /audit-agents      | ... |
  | /status            | ... |

## What Gets Installed
  (KEEP existing tree — but trim the Architecture section below it)

## Setup
  (KEEP quick start + manual install)
  (REMOVE or simplify Interactive Prompts section — it's stale)

## Template Variables
  (KEEP as-is)

## Customization
  Short paragraph pointing to docs/CUSTOMIZING-THE-WORKFLOW.md
  and docs/CREATING-AGENTS.md — don't repeat their content here.

## Roadmap
  (KEEP as-is)
```

### Specific Edits

| Section | Action |
|---------|--------|
| Opening paragraph | Rewrite to one punchy line + 3-step quick start |
| How It Works | KEEP mermaid charts, move below quick start |
| Features table (13 rows) | **Replace** with short prose paragraph (3-4 sentences) |
| Commands table | **Split** into Core (3) and Extended (9) |
| /discover-agents Flow diagram | KEEP but move to Extended section or collapse |
| Skills.sh Integration table | **Remove** from README — it's a detail, put in CREATING-AGENTS.md |
| What Gets Installed | KEEP directory tree |
| Architecture section | **Remove** internal scaffolder structure — users don't need to see `lib/detect.js` |
| Interactive Prompts section | **Replace** with current actual prompts (3 questions) |
| Why This Exists | **Move up** — this is the hook |
| Documentation section | KEEP |
| Context Cost table | KEEP |

**Net effect**: README goes from "feature catalog" to "product page."

---

## Change 2: Scaffolder Simplification

**Goal**: `npx create-claude-workflow init` asks 3 questions and finishes in under 10 seconds.

### Current Complexity

The scaffolder has 5 prompt steps:
1. Display detection summary
2. Confirm installation
3. Variable customization (3 inputs)
4. Per-agent compatibility handling (N prompts for N agents)
5. Conflict resolution for existing files

Steps 4 and 5 are solving edge cases that < 5% of v1 users will encounter.

### Simplified Flow

```
Step 1: Detection (silent — no prompt, just internal state)
  - Find CLAUDE.md (any variant)
  - Check for .claude/ directory
  - Check for previous install

Step 2: Show summary + confirm (1 prompt)
  "Installing Claude workflow into /path/to/project. Continue? (Y/n)"
  If previous install detected:
  "Previous install detected. Existing files will be backed up as .bak. Continue? (Y/n)"

Step 3: Three variable questions (3 prompts)
  - Project rules file (default: CLAUDE.md)
  - Architecture file (default: docs/ARCHITECTURE.md)
  - Progress directory (default: docs/progress)

Step 4: Install (no prompts)
  - Copy all templates with variable substitution
  - If file exists and content differs: backup as .bak, overwrite
  - If file exists and content identical: skip silently
  - Merge workflow section into CLAUDE.md (sentinel-based)
  - Create progress directory

Step 5: Summary
  "Created X files, updated Y files, skipped Z files."
  "Next: run /discover-agents to generate agents for your stack."
```

### Files to Change

| File | Change |
|------|--------|
| `lib/prompts.js` | Remove Step 4 (per-agent compatibility) and Step 5 (conflict resolution). Reduce to confirm + 3 inputs. |
| `lib/scaffolder.js` | Remove agent protocol injection loop. Simplify to: copy templates, merge CLAUDE.md, create dirs, print summary. Always backup+overwrite on conflict (no "ask per file"). |
| `lib/detect.js` | Keep detection, but **remove `classifyAgents()`** function — agent classification is v2. Keep `detectClaudeMd()`, `detectClaudeDir()`, `detectPreviousInstall()`. Simplify `existingAgents` to just list names (no classification). |
| `lib/merge-agent.js` | **Do not delete** — keep the file, but don't call it from scaffolder. It becomes a library for future use. Mark it as v2 in a comment. |
| `lib/merge-claude-md.js` | Keep as-is — sentinel merge is solid and handles re-runs correctly. |
| `lib/merge-file.js` | Keep as-is — the hash-based skip + backup logic is good. Change default: `force: true` when previous install detected (no prompt). |

### What Gets Cut

- Per-agent protocol injection prompts (0 prompts instead of N)
- Per-file conflict resolution choice (auto-backup instead of ask)
- Agent compatibility classification display

### What Stays

- CLAUDE.md detection and sentinel merge (important for re-runs)
- Previous install detection (important for backup behavior)
- Variable customization (important for project-specific paths)
- File hash comparison (important for skip-if-identical)

---

## Change 3: Team Leader Init Protocol Trim

**Goal**: Team Leader reads 4 essential files before starting, not 9. Reference files are read on-demand.

### Current Protocol (9 files)

```
1. {{PROJECT_RULES_FILE}}          — essential (project-specific rules)
2. {{ARCHITECTURE_FILE}}           — essential (project structure)
3. README.md (playbook)            — essential (630 lines — the operating manual)
4. AGENT-SPAWN-TEMPLATES.md        — essential (how to spawn agents)
5. QA-CHECKLIST-TEMPLATE.md        — reference (copy into task, don't memorize)
6. PROGRESS-FILE-TEMPLATE.md       — reference (copy when needed)
7. WORKFLOW-MODES.md               — reference (check once for mode, done)
8. QA-CHECKLIST-AUTO-FILL-RULES.md — reference (lookup table)
9. CONTEXT-BUDGET-GUIDE.md         — reference (estimation formula)
```

### New Protocol (4 essential + 5 reference)

In `templates/agents/team-leader.md`, change the Initialization Protocol:

```markdown
## Initialization Protocol

Before starting ANY task, read these files IN ORDER:

### Essential Reads (MUST read before any action)
1. `{{PROJECT_RULES_FILE}}` — Project rules and conventions
2. `{{ARCHITECTURE_FILE}}` — System architecture
3. `.claude/prompts/implementing-features/README.md` — **THE PLAYBOOK**
4. `.claude/prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` — How to spawn agents

### Reference Reads (read on-demand when needed)
5. `.claude/prompts/implementing-features/WORKFLOW-MODES.md` — Check once to resolve active mode
6. `.claude/prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md` — Copy relevant sections per task
7. `.claude/prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md` — Lookup table for QA sections
8. `.claude/prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md` — Copy when creating progress file
9. `.claude/prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md` — Check before spawning large tasks
```

**Why this matters**: Files 5-9 are templates and lookup tables. The Team Leader copies from them at specific moments — it doesn't need to internalize them upfront. Reading 4 files instead of 9 saves ~1,500-2,500 tokens of Phase 0 context, leaving more room for actual work.

### Playbook Trim (README.md in prompts/)

The 630-line playbook is the most important file in the project. It should stay comprehensive, but some sections can be tightened:

| Section | Current | Action |
|---------|---------|--------|
| Lifecycle Overview | ~60 lines | KEEP — this is the mental model |
| Branching Strategy | ~40 lines | KEEP |
| Progress Tracking | ~50 lines | KEEP |
| Task Decomposition | ~70 lines | KEEP |
| Agent Teams Setup | ~40 lines | KEEP |
| Agent Init Protocol | ~30 lines | TRIM — match the 4+5 split from team-leader.md |
| QA Verification | ~80 lines | KEEP |
| Merge Protocol | ~50 lines | KEEP |
| Codebase Guardian | ~30 lines | KEEP |
| Crash Recovery | ~40 lines | KEEP |
| Workflow Modes | ~50 lines | **TRIM** — reduce to a summary table + pointer to WORKFLOW-MODES.md |
| Wave Fence Protocol | ~40 lines | **TRIM** — reduce to 1 paragraph + pointer to WAVE-FENCE-PROTOCOL.md |
| Pre-Flight Checks | ~30 lines | **TRIM** — reduce to 1 paragraph + pointer to PRE-FLIGHT-CHECKS.md |
| Context Budget | ~40 lines | **TRIM** — reduce to quick formula + pointer to CONTEXT-BUDGET-GUIDE.md |

**Target**: ~480-520 lines (down from 630). The trimmed sections become "see X file for details" pointers rather than inline repetitions.

---

## Change 4: Spawn Template Cleanup

**Goal**: The spawn template in AGENT-SPAWN-TEMPLATES.md should be the single canonical definition of the phased workflow. Other files reference it, not repeat it.

### Current Repetition

The 4-phase workflow (Load Rules → Plan → Execute → Self-Review) is fully defined in:
1. AGENT-SPAWN-TEMPLATES.md (canonical — 3 full templates)
2. team-leader.md (phases described in Mandatory Planning Gate)
3. qa-reviewer.md (phases described in Mandatory Planning Gate)
4. codebase-guardian.md (phases described in Mandatory Planning Gate)
5. README.md playbook (phases summarized)
6. CUSTOMIZING-THE-WORKFLOW.md (phases explained for customization)

This repetition is **intentional** for agent definitions (each agent reads its own file, not all files). No change there. But the playbook and customization guide don't need to repeat the full phase definitions — they can reference the spawn templates.

### Action

- **AGENT-SPAWN-TEMPLATES.md**: No changes — it's the canonical source.
- **Agent definitions (3 files)**: No changes — they need self-contained phase descriptions.
- **README.md playbook**: In the "Agent Initialization Protocol" section, replace inline phase definitions with: "Each agent follows the phased workflow defined in `AGENT-SPAWN-TEMPLATES.md`. See that file for the full template."
- **CUSTOMIZING-THE-WORKFLOW.md**: In the "Adjusting the Phased Workflow" section, reference AGENT-SPAWN-TEMPLATES.md instead of re-explaining phases.

**Net effect**: Two fewer places to update when the phased workflow changes.

---

## Change 5: Remove PLAN.md and CUSTOMIZATION-AND-IDEAS.md from Distribution

**Goal**: Ship the product, not the planning documents.

### PLAN.md (327 lines)

This is a distribution strategy document for maintainers. It overlaps with README.md and is not useful to end users.

**Action**: Move to `docs/internal/` or add to `.npmignore`. It should not be in the project root where users see it. Do NOT delete — it's useful context for contributors.

### CUSTOMIZATION-AND-IDEAS.md (313 lines)

Part 1 (documentation topics) has been implemented as `docs/CREATING-AGENTS.md` and `docs/CUSTOMIZING-THE-WORKFLOW.md`. Part 2 (feature ideas) is internal planning.

**Action**: Same as PLAN.md — move to `docs/internal/` and add to `.npmignore`.

---

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `README.md` | **Rewrite** | New structure: pitch → demo → core commands → extended commands |
| `lib/prompts.js` | **Simplify** | 5 steps → 2 steps (confirm + 3 variables) |
| `lib/scaffolder.js` | **Simplify** | Remove agent injection loop, auto-backup on conflict |
| `lib/detect.js` | **Simplify** | Remove `classifyAgents()`, keep core detection |
| `templates/agents/team-leader.md` | **Edit** | Split init protocol into Essential (4) + Reference (5) |
| `templates/prompts/.../README.md` | **Trim** | 630 → ~500 lines, replace inline repetition with pointers |
| `PLAN.md` | **Move** | → `docs/internal/PLAN.md` + `.npmignore` |
| `CUSTOMIZATION-AND-IDEAS.md` | **Move** | → `docs/internal/CUSTOMIZATION-AND-IDEAS.md` + `.npmignore` |

**Files NOT changed**: All 12 commands, all 3 agent definitions (except team-leader init protocol), all prompt templates, all lib files except noted above, both docs guides.

**Total changes**: 8 files touched. No files deleted. No features removed. Just resharpened.

---

## What Success Looks Like

After these changes:

1. **New user reads README** → understands the value in 30 seconds, sets up in 60 seconds
2. **`npx create-claude-workflow init`** → 4 prompts (confirm + 3 variables), done in 10 seconds
3. **Team Leader agent** → reads 4 files (~2,000 lines) instead of 9 (~3,500 lines), starts faster
4. **All 12 commands still work** → nothing removed, just reorganized
5. **Extension points are clear** → "Core Commands" vs "Extended Commands" signals where to add value
6. **Internal planning docs** → out of user's sight, still available for contributors

The product identity becomes: **"The best way to run multi-agent development with Claude Code."** Not "a workflow framework with 13 features and 12 commands."
