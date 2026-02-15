# Baseline Token Report — claude-workflow-skill templates

**Date**: 2026-02-13
**Method**: Character heuristic (chars / 3.5), ~80% accurate for English/Markdown
**Format**: Pure Markdown (pre-refactor baseline)
**Purpose**: Measure before prompt format optimization so we can quantify improvement

---

## Per-File Breakdown

### Agents (3 files, ~7,286 tokens)

| File | Lines | Chars | ~Tokens |
|------|-------|-------|---------|
| team-leader.md | 203 | 9,099 | 2,600 |
| qa-reviewer.md | 242 | 8,755 | 2,502 |
| codebase-guardian.md | 187 | 7,643 | 2,184 |

### Commands (11 files, ~27,113 tokens)

| File | Lines | Chars | ~Tokens |
|------|-------|-------|---------|
| create-feature-plan.md | 546 | 17,778 | 5,080 |
| discover-agents.md | 302 | 13,463 | 3,847 |
| refactor.md | 326 | 10,352 | 2,958 |
| implement-feature.md | 282 | 9,601 | 2,744 |
| scaffold-agent.md | 274 | 7,918 | 2,263 |
| generate-tests.md | 242 | 7,818 | 2,234 |
| audit-agents.md | 214 | 7,090 | 2,026 |
| review-pr.md | 223 | 5,553 | 1,587 |
| resume-feature.md | 207 | 5,305 | 1,516 |
| hotfix.md | 195 | 5,069 | 1,449 |
| status.md | 152 | 4,929 | 1,409 |

### Prompts (10 files, ~24,123 tokens)

| File | Lines | Chars | ~Tokens |
|------|-------|-------|---------|
| README.md (playbook) | 631 | 26,546 | 7,585 |
| AGENT-SPAWN-TEMPLATES.md | 536 | 19,458 | 5,560 |
| QA-CHECKLIST-TEMPLATE.md | 164 | 5,983 | 1,710 |
| WORKFLOW-MODES.md | 160 | 5,415 | 1,548 |
| CONTEXT-BUDGET-GUIDE.md | 151 | 5,164 | 1,476 |
| WAVE-FENCE-PROTOCOL.md | 160 | 5,153 | 1,473 |
| QA-CHECKLIST-AUTO-FILL-RULES.md | 108 | 4,749 | 1,357 |
| PROGRESS-FILE-TEMPLATE.md | 128 | 4,051 | 1,158 |
| AGENT-PERFORMANCE-LOG-TEMPLATE.md | 139 | 4,007 | 1,145 |
| PRE-FLIGHT-CHECKS.md | 141 | 3,887 | 1,111 |

### Docs (2 files, ~7,097 tokens)

| File | Lines | Chars | ~Tokens |
|------|-------|-------|---------|
| CREATING-AGENTS.md | 419 | 13,879 | 3,966 |
| CUSTOMIZING-THE-WORKFLOW.md | 309 | 10,956 | 3,131 |

---

## Totals

| Category | Files | Lines | Chars | ~Tokens |
|----------|-------|-------|-------|---------|
| Agents | 3 | 632 | 25,497 | 7,286 |
| Commands | 11 | 3,165 | 94,876 | 27,113 |
| Prompts | 10 | 2,318 | 84,413 | 24,123 |
| Docs | 2 | 728 | 24,835 | 7,097 |
| **TOTAL** | **26** | **6,641** | **229,621** | **~65,619** |

---

## Context Load Scenarios

These simulate real-world usage — what actually gets loaded into context during each workflow step.

| Scenario | What's Loaded | ~Tokens | % of 200k |
|----------|--------------|---------|-----------|
| Coding agent spawn | team-leader + playbook + spawn templates + QA checklist | 17,455 | 8.7% |
| /implement-feature Phase 1 | command + playbook + all mandatory reads | 23,138 | 11.6% |
| Single coding agent | playbook + QA checklist (excl. project files) | 9,295 | 4.6% |
| QA reviewer spawn | agent def + checklist + perf log | 5,357 | 2.7% |
| Guardian spawn | agent def + playbook | 9,769 | 4.9% |
| /create-feature-plan | command + playbook + budget + auto-fill | 15,498 | 7.7% |
| ALL templates at once | theoretical max | 65,619 | 32.8% |

---

## Key Observations

1. **We're in the optimal zone.** Even the heaviest scenario (/implement-feature Phase 1 at 11.6%) is well within the 0-30% optimal quality range.

2. **The playbook (README.md) is the biggest single file** at ~7,585 tokens. It's loaded by nearly every scenario. This is the highest-impact optimization target.

3. **AGENT-SPAWN-TEMPLATES.md is #2** at ~5,560 tokens. Also loaded frequently.

4. **create-feature-plan.md is the largest command** at ~5,080 tokens, but it's only loaded once per invocation.

5. **Token cost is NOT the primary optimization target.** At 8-12% context usage for most scenarios, we have plenty of headroom. The real optimization opportunity is **comprehension quality** — restructuring content so Claude parses it more accurately, not so it uses fewer tokens.

---

## Optimization Target

The refactor should focus on:
- **Accuracy improvement** (XML structural tags for task definitions, agent scopes, rules)
- **Not token reduction** (we're already well under budget)
- **Measuring**: After refactor, re-run this report and compare both token counts AND subjective comprehension quality

---

## Reference

| Threshold | Tokens | Quality |
|-----------|--------|---------|
| Optimal | 0–60,000 (0-30%) | Peak quality |
| Good | 60,000–100,000 (30-50%) | Good quality |
| Degradation | 100,000+ (50%+) | Quality drops |
| Context limit | 200,000 | Maximum |
