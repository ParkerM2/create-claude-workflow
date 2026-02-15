---
description: "Audit workflow configuration for performance bottlenecks — file sizes, hook overhead, context budget, progress file growth"
---

# /audit-performance — Diagnose Workflow Performance Bottlenecks

> Invoke this skill to scan the workflow plugin configuration and identify performance bottlenecks — large Phase 0 reads, hook accumulation, progress file bloat, context budget risks, and oversized prompt assets.

---

## When to Use

- Your agent spawns feel slow or context-heavy
- You've added new prompts, guides, or agents and want to check overhead
- Progress files are growing large after many features
- You want to verify workflow health before a big feature run
- Periodically, to keep the workflow lean

---

## Phase 1: Collect Data

Gather file sizes and counts across the workflow plugin. Use the plugin root for all paths.

### 1a. Workflow Config

```bash
# Check for workflow config
cat .claude/workflow.json 2>/dev/null || echo "MISSING"
```

Record whether `.claude/workflow.json` exists and is valid JSON.

### 1b. Measure File Assets

List and measure all files in these directories:

```bash
# Phase 0 reads (prompts loaded at agent spawn)
ls -la prompts/implementing-features/*.md 2>/dev/null
# Guides (now in .claude/docs/customize-quick-start/)
ls -la .claude/docs/customize-quick-start/*.md 2>/dev/null

# Agent definitions
ls -la agents/*.md 2>/dev/null

# Command definitions
ls -la commands/*.md 2>/dev/null

# Hook files
ls -la hooks/*.js hooks/*.json 2>/dev/null

# Skills
find skills/ -name "*.md" -exec ls -la {} \; 2>/dev/null
```

For each file, record: **name**, **size in bytes**, **line count**.

### 1c. Count Hooks

Read `hooks/hooks.json` (or `.claude/hooks.json`) and count hooks per event type:
- `PreToolUse` hooks (these add latency to every tool call)
- `PostToolUse` hooks (async, lower impact)
- `SessionStart` hooks

### 1d. Measure Progress Data

```bash
# List feature progress directories and JSONL sizes
ls -la <progressDir>/*/events.jsonl 2>/dev/null
wc -l <progressDir>/*/events.jsonl 2>/dev/null
```

Record the largest `events.jsonl` file by line count (each line = one event).

### 1e. Check QA Automation

Check if `QA-CHECKLIST-AUTO-FILL-RULES.md` exists in the prompts directory:

```bash
ls prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md 2>/dev/null
```

---

## Phase 2: Run Checks (10 Categories)

For each category, compute the metric, compare against thresholds, and assign a severity.

### Check 1: Phase 0 Asset Sizes

Measure each file that agents read during Phase 0 initialization.

| Severity | Threshold |
|----------|-----------|
| RED | > 20 KB |
| YELLOW | 15–20 KB |
| GREEN | < 15 KB |

Files to check: project rules file, architecture file, README.md (playbook), agent-specific `.md`, `AGENT-SPAWN-TEMPLATES.md`, QA checklist template.

### Check 2: Phase 0 Read Count

Count how many mandatory file reads each agent type performs during initialization.

| Severity | Threshold |
|----------|-----------|
| RED | > 5 reads |
| YELLOW | 4–5 reads |
| GREEN | <= 3 reads |

### Check 3: Total Context Budget

Estimate the token overhead per agent spawn by summing Phase 0 file sizes and applying: **tokens ≈ file_size_bytes / 4**

| Severity | Threshold |
|----------|-----------|
| RED | > 12,000 tokens |
| YELLOW | 10,000–12,000 tokens |
| GREEN | < 10,000 tokens |

### Check 4: Hook Overhead

Count PreToolUse hooks (these fire synchronously before every tool call and add latency).

| Severity | Threshold |
|----------|-----------|
| RED | > 3 PreToolUse hooks |
| YELLOW | 3 PreToolUse hooks |
| GREEN | <= 2 PreToolUse hooks |

Estimate latency: ~100–200ms per hook invocation. Report cumulative estimate.

### Check 5: JSONL Event Log Growth

Measure the largest `events.jsonl` file by line count.

| Severity | Threshold |
|----------|-----------|
| RED | > 300 JSONL lines |
| YELLOW | 150–300 JSONL lines |
| GREEN | < 150 JSONL lines |

### Check 6: Agent Definition Sizes

Measure each file in `agents/*.md`.

| Severity | Threshold |
|----------|-----------|
| RED | > 15 KB |
| YELLOW | 10–15 KB |
| GREEN | < 10 KB |

### Check 7: Command Sizes

Measure each file in `commands/*.md` (loaded into context when the user invokes the command).

| Severity | Threshold |
|----------|-----------|
| RED | > 20 KB |
| YELLOW | 15–20 KB |
| GREEN | < 15 KB |

### Check 8: Spawn Template Size

Measure `AGENT-SPAWN-TEMPLATES.md` (read by Team Leader for every agent spawn).

| Severity | Threshold |
|----------|-----------|
| RED | > 25 KB |
| YELLOW | 20–25 KB |
| GREEN | < 20 KB |

### Check 9: QA Checklist Automation

Check whether `QA-CHECKLIST-AUTO-FILL-RULES.md` exists.

| Severity | Threshold |
|----------|-----------|
| GREEN | File present |
| YELLOW | File missing |

When missing, QA rounds require manual checklist filling — slower and less consistent.

### Check 10: Workflow Config

Check whether `.claude/workflow.json` exists and contains valid JSON with the expected keys.

| Severity | Threshold |
|----------|-----------|
| GREEN | File exists and is valid |
| RED | File missing or invalid |

---

## Phase 3: Generate Report

Count severities across all checks and compute overall health:
- **RED** if any check is RED
- **YELLOW** if any check is YELLOW and none are RED
- **GREEN** if all checks are GREEN

Display the report:

```
PERFORMANCE AUDIT
═══════════════════════════════════════════════════════════
Scan Date: <ISO date>
Workflow Config: .claude/workflow.json FOUND|MISSING
Overall Health: GREEN | YELLOW | RED

─── Phase 0 Context Cost ──────────────────────────────────

Per coding agent spawn:
  1. project rules file         ~X KB   ✓|⚠|✗
  2. architecture file          ~X KB   ✓|⚠|✗
  3. agent definition           ~X KB   ✓|⚠|✗
  4. playbook (README.md)       ~X KB   ✓|⚠|✗
  Total: ~XX KB (~X,XXX tokens)         ✓|⚠|✗

─── File Asset Sizes ──────────────────────────────────────

Prompts:    ✗|⚠|✓ <filename> <lines> lines <size>KB <severity>
            ...

Agents:     ✗|⚠|✓ <filename> <lines> lines <size>KB <severity>
            ...

Commands:   ✗|⚠|✓ <filename> <lines> lines <size>KB <severity>
            ...

─── Hook Overhead ─────────────────────────────────────────

PreToolUse (Bash): X hooks ~XXXms cumulative
PreToolUse (Edit/Write): X hooks ~XXXms cumulative
PostToolUse: X hooks ~XXXms cumulative (async)
SessionStart: X hooks

─── Progress Files ────────────────────────────────────────

Features: X | Largest JSONL: <name> (XXX events) ✓|⚠|✗

─── QA Automation ─────────────────────────────────────────

QA-CHECKLIST-AUTO-FILL-RULES.md: PRESENT ✓ | MISSING ⚠

─── Summary ───────────────────────────────────────────────

RED: X | YELLOW: X | GREEN: X
```

### Severity Icons

| Severity | Icon |
|----------|------|
| GREEN | ✓ |
| YELLOW | ⚠ |
| RED | ✗ |

---

## Phase 4: Recommendations

For each RED or YELLOW check, output a specific recommendation:

```
RECOMMENDATIONS
═══════════════════════════════════════════════════════════
```

For each issue:

```
RECOMMENDATION: <short title>
  Issue:  <what is slow or oversized>
  Metric: <current value> → Target: <threshold for GREEN>
  Fix:    <specific action to take>
  Impact: <estimated savings in KB or tokens>
```

### Common Recommendations

**Large Phase 0 files:**
```
RECOMMENDATION: Reduce Phase 0 context load
  Issue:  <filename> is XX KB, adding ~X,XXX tokens per agent spawn
  Metric: XX KB → Target: < 15 KB
  Fix:    Move reference content to a separate guide file that agents
          read on-demand rather than at initialization
  Impact: ~X,XXX fewer tokens per spawn × N agents = ~XX,XXX tokens saved
```

**Too many hooks:**
```
RECOMMENDATION: Consolidate PreToolUse hooks
  Issue:  X PreToolUse hooks fire on every tool call (~XXXms cumulative)
  Metric: X hooks → Target: <= 2 hooks
  Fix:    Combine related guards into a single hook with multiple checks,
          or convert low-priority checks to PostToolUse (async)
  Impact: ~XXXms latency reduction per tool call
```

**Large progress files:**
```
RECOMMENDATION: Archive completed feature logs
  Issue:  <feature>/events.jsonl has grown to XXX events
  Metric: XXX events → Target: < 150 events
  Fix:    Archive completed features: move finished feature directories to
          a <progressDir>/archive/ subdirectory
  Impact: Faster JSONL reads during /status and /resume-feature
```

**Missing QA automation rules:**
```
RECOMMENDATION: Add QA checklist auto-fill rules
  Issue:  QA-CHECKLIST-AUTO-FILL-RULES.md not found
  Metric: MISSING → Target: PRESENT
  Fix:    Create prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md
          with patterns for auto-filling standard QA checklist items
  Impact: Faster QA rounds — reviewer auto-fills routine checks
```

**Missing workflow config:**
```
RECOMMENDATION: Initialize workflow configuration
  Issue:  .claude/workflow.json not found or invalid
  Metric: MISSING → Target: Valid JSON with projectRulesFile, architectureFile, progressDir
  Fix:    Run /workflow-setup to create the configuration interactively
  Impact: Agents can locate project files without guessing paths
```

---

## Output Rules

- Report ALL 10 categories, even if GREEN — users want the full picture
- Sort file lists within each category by size descending (largest first)
- Use exact file sizes — do not round below 1 KB
- Token estimates use the formula: `file_size_bytes / 4` (rounded to nearest 100)
- If a directory does not exist or is empty, report it as GREEN with "0 files"
- Do NOT modify any files — this is a read-only audit
