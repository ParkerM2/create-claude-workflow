---
name: deep-research
description: "Conversational deep research — phased investigation with user checkpoints, iterative cross-referencing, and multi-layered validation. Produces a research report with sources and analysis."
---

# /deep-research — Conversational Deep Research

> Deeply research a topic before making decisions. Works through phases with user checkpoints between each — you control the direction. Each layer of research is cross-referenced against the goal, prior findings, and codebase reality before presenting. Produces a research report, not a design doc. Use `/new-plan` after to turn findings into an implementation plan.

---

## When to Use

- Exploring a new technology, pattern, or approach before committing to it
- Investigating how other tools/frameworks solve a problem you're facing
- Understanding the current codebase deeply before planning changes
- Comparing multiple approaches with trade-offs before choosing one
- Gathering context that will inform a future `/new-plan` or `/agent-team`
- Any question where "just try it" is too risky and you need data first

## When NOT to Use

- You already know what to build — use `/new-plan` or `/agent-team` directly
- Simple factual question — just ask directly without invoking a skill

---

## Core Principle: Research Before Presenting

Never present raw findings directly. Every piece of information goes through a validation layer before the user sees it:

```
Raw finding → Cross-reference against goal → Validate against prior research → Check against codebase → Assess confidence → THEN present
```

If you can't validate a finding, say so explicitly with the reason. Don't present unvalidated information as fact.

---

## How It Works

```
Phase 1: Scope           → Define question, dimensions, success criteria
     ↓ checkpoint
Phase 2: Explore          → Broad research across all dimensions
     ↓ internal validation (DO NOT present raw findings)
Phase 2.5: First Pass     → Cross-reference, filter, assess confidence
     ↓ checkpoint (present validated findings only)
Phase 3: Analyze          → Deep dive on user-selected threads (ITERATIVE)
     ↓ validate each round against goal + prior context
     ↓ checkpoint per round (user can loop or advance)
Phase 4: Synthesize       → Final validation pass, compile report
     ↓ checkpoint (user can refine)
```

---

## Phase 1: Scope

### 1a. Understand the Research Question

Parse the user's request. If the request is vague, use AskUserQuestion to clarify BEFORE defining scope.

Extract:
- **Primary question**: What specifically needs to be answered?
- **Context**: Why does this matter? What decision does it inform?
- **Success criteria**: How will the user know the research is "done enough"? What would a useful answer look like?
- **Constraints**: Budget, timeline, technology, compatibility requirements
- **Known unknowns**: What does the user already suspect but needs confirmed?
- **Anti-goals**: What is explicitly NOT being researched? (prevents scope creep)

### 1b. Define Research Dimensions

Identify what needs to be investigated:
- **Internal** (codebase): What existing code, patterns, or architecture is relevant?
- **External** (web): What documentation, blog posts, papers, or community knowledge is needed?
- **Comparative**: Are there multiple approaches/tools to compare?
- **Historical**: Has this been attempted before? What changed? What failed?

### 1c. Build Research Plan

For each dimension, list specific research actions:

```markdown
### Research Plan

| # | Action | Dimension | Tool | Expected Output |
|---|--------|-----------|------|-----------------|
| 1 | Search for X patterns in codebase | Internal | Grep/Glob | List of existing implementations |
| 2 | Read official docs for Y | External | WebFetch | Feature capabilities and limitations |
| 3 | Compare Z vs W adoption | External | WebSearch | Community sentiment, benchmarks |
| 4 | Check if current architecture supports Y | Internal | Read | Compatibility assessment |
```

### 1d. Checkpoint: Present Scope to User

```markdown
## Research Scope

**Primary question**: <restate in your own words>
**Decision it informs**: <what will the user do with this research>
**Success criteria**: <what "done enough" looks like>
**Anti-goals**: <what we are NOT researching>

### Research Dimensions

| Dimension | What I'll Investigate |
|-----------|----------------------|
| Internal | <codebase areas to explore> |
| External | <web topics to research> |
| Comparative | <approaches/tools to compare, if any> |
| Historical | <prior attempts, evolution of the space> |

### Research Plan

| # | Action | Tool | Why |
|---|--------|------|-----|
| 1 | ... | ... | ... |

### Estimated Effort
- Internal exploration: <low/medium/high>
- Web research: <low/medium/high>
- Total phases remaining: 3

**Does this scope look right? Should I narrow, expand, or redirect?**
```

Wait for user response. Adjust scope based on feedback before proceeding.

---

## Phase 2: Explore

### 2a. Internal Exploration (Codebase)

If the scope includes internal research:
- Use `Glob`, `Grep`, `Read` to find relevant code
- Map the current architecture in the relevant area
- Identify existing patterns, conventions, and constraints
- Note any technical debt or limitations
- Record exact file paths and line numbers for every finding

### 2b. External Research (Web)

If the scope includes external research:
- Use `WebSearch` for broad topic discovery — run multiple varied queries, not just one
- Use `WebFetch` for deep reading of specific articles/docs
- Use Playwright browser tools for interactive research (docs that require navigation, GitHub issues, forum threads)
- For each source, record: URL, date, author/org credibility, key claims
- Seek out OPPOSING viewpoints — don't just collect sources that agree with the first thing found

### 2c. Comparative Research

If the scope includes comparison:
- Build a comparison matrix
- Research each option with EQUAL depth (don't bias toward the first one found)
- Note community adoption, maintenance status, last release date, and known issues
- Check GitHub stars/issues/PRs as health signals, not popularity contests

### 2d. Historical Research

If the scope includes historical context:
- How has this space evolved? What was the approach 1-2 years ago vs now?
- Were there failed attempts? Why did they fail?
- Is the current trend stable or in flux?

### 2e. INTERNAL VALIDATION — Do NOT Present Yet

Before presenting ANY findings to the user, run them through the validation layer:

For each finding:
1. **Goal check**: Does this finding help answer the primary question from Phase 1?
   - If NO: set aside (may be useful later, but don't lead with it)
2. **Source quality**: Is the source credible? Recent? From someone with authority on the topic?
   - Blog post from random dev vs official docs vs peer-reviewed paper
3. **Corroboration**: Do multiple independent sources agree?
   - Single source = low confidence. 3+ agreeing sources = high confidence.
4. **Codebase check**: If the finding claims something about tools/patterns, does it actually apply to THIS codebase?
   - "React supports X" is useless if the project uses Vue
5. **Recency**: Is this from 2024? 2025? 2026? Has the landscape changed since publication?

Discard or flag findings that fail validation. Do NOT present unvalidated findings as if they're confirmed.

### 2f. Checkpoint: Present Validated Findings to User

Present findings organized by dimension, with validation metadata:

```markdown
## Phase 2 Findings (Validated)

### Internal (Codebase)

**Finding**: <what I found>
- Location: <file:line>
- Relevance to question: <how this connects to the primary question>

### External (Web Research)

**Finding**: <what I found>
- Source: [title](url) (<date>, <author/org>)
- Corroboration: <agreed by N other sources / uncorroborated>
- Recency: <current / may be outdated because...>

### Comparative (if applicable)

| Criterion | Option A | Option B | Source |
|-----------|----------|----------|--------|
| ... | ... | ... | <where this data comes from> |

### Emerging Themes
- <theme 1 — supported by findings X, Y>
- <theme 2 — supported by findings Z>

### Findings Discarded (didn't serve the goal)
- <finding> — discarded because: <reason>

### Open Questions
- <question that needs deeper investigation>
- <question that needs user input>

**Which threads should I pull deeper? Any areas to skip or add?**
```

Wait for user response.

---

## Phase 3: Analyze (Iterative — may repeat)

> Phase 3 is iterative. Each round goes deeper on specific threads, cross-references against everything known so far, and presents validated analysis. Loop until the user says "ready to synthesize."

### 3a. Cross-Reference Against Goal

Before going deeper on any thread, re-read:
1. The original research question from Phase 1
2. The success criteria defined in Phase 1
3. ALL findings from Phase 2 and prior Phase 3 rounds

Ask:
- Does this thread actually help answer the question?
- Does it contradict something found earlier?
- Does it change the scope or assumptions?
- Are we closer to the success criteria or drifting?

If a thread doesn't serve the goal, note why and skip it. Don't chase interesting tangents that don't answer the question.

### 3b. Deep Dive on Selected Threads

Based on user direction:
- Go deeper on the threads the user flagged
- Spawn parallel research agents for independent subtopics (see Research Agent Spawning below)
- Cross-reference internal findings with external research
- Cross-reference external sources against each other — do multiple sources agree?
- Identify conflicts between sources — flag where sources disagree and determine which has stronger evidence
- Test assumptions against the codebase — does the claimed approach actually work here?
- Check recency — are findings still valid? Has the landscape changed?

### 3c. Multi-Layer Validation

Every finding from the deep dive goes through validation BEFORE presenting:

**Layer 1 — Goal alignment**: Does it answer the question?
**Layer 2 — Source triangulation**: Do 2+ independent sources support it?
**Layer 3 — Codebase reality**: Does it apply to THIS project's actual constraints?
**Layer 4 — Prior context consistency**: Does it agree with or contradict what we found in Phase 2 and earlier rounds?
**Layer 5 — Recency and trend**: Is this current? Is the trend moving toward or away from this?

If a finding passes all 5 layers: **high confidence**
If it passes 3-4: **medium confidence**
If it passes 1-2: **low confidence** — flag explicitly

### 3d. Risk and Trade-off Analysis

For each approach or finding:
- **Pros**: What problems does it solve?
- **Cons**: What problems does it create?
- **Risks**: What could go wrong?
- **Dependencies**: What else needs to change?
- **Effort**: How much work is involved?
- **Confidence**: high/medium/low with explanation
- **Reversibility**: How hard is it to undo this decision if it's wrong?

### 3e. Checkpoint: Present Analysis to User

```markdown
## Phase 3 Analysis (Round <N>)

### Goal Alignment Check
**Original question**: <restate from Phase 1>
**Success criteria**: <restate from Phase 1>
**Are we still on track?**: <yes/no — if drifting, explain how>
**Progress toward success criteria**: <what's answered vs what's still open>

### Key Findings

**Finding 1**: <title>
- Evidence: <what sources say, with citations>
- Confidence: <high/medium/low>
- Validation: Goal ✓/✗ | Sources ✓/✗ | Codebase ✓/✗ | Prior context ✓/✗ | Recency ✓/✗
- Cross-reference: <agrees with / contradicts finding X from Phase 2 or Round N-1>

**Finding 2**: <title>
- Evidence: <what sources say>
- Confidence: <high/medium/low>
- Validation: Goal ✓/✗ | Sources ✓/✗ | Codebase ✓/✗ | Prior context ✓/✗ | Recency ✓/✗
- Cross-reference: <agrees with / contradicts>

### Contradictions Found
- <source A says X, source B says Y — here's which has stronger evidence and why>
- <Phase 2 said X, but deeper research shows Y — here's what changed>

### Trade-off Matrix (if comparing approaches)

| Factor | Approach A | Approach B | Confidence | Source |
|--------|-----------|-----------|------------|--------|
| Complexity | ... | ... | high/med/low | <citation> |
| Performance | ... | ... | high/med/low | <citation> |
| Maintainability | ... | ... | high/med/low | <citation> |
| Reversibility | ... | ... | high/med/low | <citation> |

### What Changed Since Last Round
- <new information that confirms/contradicts/extends prior findings>

### Recommendations (preliminary)
1. <recommendation with rationale and confidence level>
2. <alternative if recommendation 1 isn't viable>

### Remaining Uncertainty
- <what I still don't know>
- <what would require prototyping to confirm>
- <what has low confidence and needs more sources>

### Iteration Options
- **Go deeper**: <specific threads that could use another round>
- **Validate further**: <findings with medium/low confidence that could be strengthened>
- **Ready to synthesize**: <if findings are solid enough to meet success criteria>

**Does this analysis look right? Want another iteration round, or ready to synthesize?**
```

Wait for user response. If "go deeper" or "check X against Y":
- Loop back to 3a
- Research the new thread
- Present updated analysis as "Round N+1"
- Include "What Changed Since Last Round" section showing delta
- Continue until user says "ready to synthesize"

---

## Phase 4: Synthesize

### 4a. Final Cross-Reference Pass

Before writing the report, do one complete validation:
1. Re-read the original research question AND success criteria from Phase 1
2. For each key finding: does it directly answer or inform the question?
3. For each recommendation: is it supported by 2+ sources AND validated against the codebase?
4. For each contradiction: is it resolved or clearly flagged with the stronger position identified?
5. For each low-confidence finding: is it marked as such with the reason?
6. Remove findings that don't serve the goal (move to appendix if potentially useful later)
7. Check: do the findings, taken together, actually meet the success criteria? If not, flag what's missing.

### 4b. Compile Research Report

Save to `.claude/progress/<topic>-research.md`.

```markdown
# Research Report: <Topic>

**Author**: /deep-research
**Date**: <YYYY-MM-DD>
**Status**: COMPLETE
**Research question**: <the primary question>
**Decision it informs**: <what the user will do with this>
**Success criteria**: <from Phase 1>
**Criteria met**: <yes/partial — list what's answered and what's still open>

---

## Executive Summary

<2-3 paragraphs: what was researched, key findings, recommended direction, overall confidence level>

## 1. Scope and Methodology

### Research Question
<full statement of what was investigated and why>

### Success Criteria
<what "done enough" looks like — restated from Phase 1>

### Methodology
- Internal: <what codebase areas were explored, tools used>
- External: <what web sources were consulted, search queries used>
- Comparative: <what was compared, if applicable>
- Validation: <how findings were cross-referenced — source triangulation, codebase testing, prior context checks>
- Iterations: <how many Phase 3 rounds, what changed between rounds>

## 2. Findings

### 2.1 <Finding Category 1>
<detailed findings with evidence and source citations>
**Confidence**: high/medium/low — <why>
**Sources**: <list with dates and credibility notes>
**Source agreement**: yes/partial/no — <note contradictions>
**Validated against codebase**: yes/no/not applicable — <result>
**Prior context**: <consistent with / evolved from Phase 2 finding>

### 2.2 <Finding Category 2>
<same structure>

### 2.3 <Finding Category 3>
<etc.>

## 3. Analysis

### Cross-Reference Summary
<How findings relate to each other. Which reinforce each other, which contradict.
 Note where external research was validated against the codebase and the result.
 Note how findings evolved across Phase 3 rounds.>

### Contradictions and Resolutions

| Contradiction | Source A says | Source B says | Resolution | Confidence |
|--------------|-------------|-------------|-----------|------------|
| <topic> | <claim> (<source, date>) | <claim> (<source, date>) | <which is more credible and why> | high/med/low |

### Trade-offs

| Factor | Approach A | Approach B | Confidence | Key Source |
|--------|-----------|-----------|------------|-----------|
| ... | ... | ... | ... | ... |

### Risks

| Risk | Likelihood | Impact | Mitigation | Confidence |
|------|-----------|--------|------------|------------|
| ... | ... | ... | ... | ... |

### Dependencies
<what else would need to change>

## 4. Recommendations

### Primary Recommendation
<what to do and why>
**Confidence**: <high/medium/low with explanation>
**Supported by**: <list the key findings that support this>
**Reversibility**: <how hard to undo if wrong>

### Alternatives
<fallback options if primary doesn't work, with their own confidence levels>

### What Would Change the Recommendation
<conditions under which a different approach would be better>

## 5. Open Questions

<things that couldn't be answered by research alone>
- <question> — would require: <prototyping / user testing / expert consultation / more time>

## 6. Success Criteria Assessment

| Criterion | Status | Evidence |
|-----------|--------|---------|
| <criterion from Phase 1> | Met/Partial/Unmet | <which findings address this> |

## 7. Sources

<numbered list of all sources consulted>

| # | Source | Date | Type | Credibility | Contribution |
|---|--------|------|------|-------------|-------------|
| 1 | [Title](URL) | YYYY-MM | docs/blog/paper/forum | high/med/low | <what it contributed> |
| 2 | [Title](URL) | YYYY-MM | ... | ... | ... |

## Appendix: Discarded Findings

<findings that were researched but didn't serve the primary question — kept here in case they're useful for related work>

- <finding> — discarded because: <reason>
```

### 4c. Final Checkpoint: Present Report to User

```markdown
## Research Complete

Report saved to: `.claude/progress/<topic>-research.md`

### Summary
<2-3 sentence summary of key findings>

### Primary Recommendation
<one sentence — confidence level>

### Success Criteria Assessment
| Criterion | Status |
|-----------|--------|
| ... | Met/Partial/Unmet |

### Next Steps
- To plan implementation: `/new-plan` (reference this research report)
- To implement directly: `/agent-team` (if the path is clear)
- To research further: ask follow-up questions in this session

**Want me to refine anything in the report?**
```

---

## Research Tools Available

| Tool | When to Use |
|------|-------------|
| `WebSearch` | Broad topic discovery — run multiple varied queries per topic |
| `WebFetch` | Deep reading of specific URLs (articles, docs, READMEs) |
| Playwright browser | Interactive web research — navigating docs, GitHub issues/PRs, forum threads |
| `Glob` | Find files by pattern in the codebase |
| `Grep` | Search for code patterns, keywords, usages |
| `Read` | Read specific files for deep understanding |
| `AskUserQuestion` | When you need user input to proceed (use at checkpoints, not mid-research) |

### Research Agent Spawning

For broad research topics with independent subtopics, spawn parallel research agents:

```
Task tool parameters:
  description: "Research <specific subtopic>"
  subagent_type: general-purpose
  model: "sonnet"
  mode: bypassPermissions
  run_in_background: true
  prompt: |
    Research this specific question: <question>

    Use WebSearch and WebFetch. For each finding:
    - Record the source URL, date, and author/org
    - Note whether multiple sources agree
    - Flag anything that seems outdated (pre-2025)

    Return a structured list of findings with source citations.
    Focus ONLY on: <specific aspect>
    Do NOT research: <anti-goals>
```

Spawn multiple agents for independent subtopics. When they return:
1. Merge their findings
2. Cross-reference overlapping areas — do the agents' findings agree?
3. Run the merged findings through the validation layer (Phase 2e or 3c)
4. THEN present to user

Never present raw agent output directly to the user.

---

## Research Quality Rules

1. **Never present unvalidated findings** — every finding goes through the validation layer before the user sees it
2. **Always cite sources** — no unsourced claims. If you can't find a source, say "based on my training data, not verified" explicitly
3. **Seek disconfirming evidence** — don't just collect sources that agree. Actively search for opposing viewpoints
4. **Flag confidence honestly** — low confidence is useful information. Don't inflate confidence to sound authoritative
5. **Track provenance** — when a finding evolves across rounds, note what changed and why
6. **Test against reality** — if research says "X works well," check if X actually works in this codebase before recommending it
7. **Separate fact from opinion** — blog post opinions ≠ documented behavior ≠ benchmarked results. Label each appropriately
8. **Check the date** — a 2024 source about a fast-moving space may be completely wrong by 2026

---

## Integration with Other Commands

| After Research | Use |
|---------------|-----|
| Ready to plan implementation | `/new-plan` — reference the research report as input |
| Ready to implement directly | `/agent-team` — for well-scoped changes |
| Want to continue researching | Stay in this session and ask follow-up questions |
