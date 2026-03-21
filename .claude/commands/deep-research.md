---
description: "Conversational deep research — phased investigation with user checkpoints, produces a research report with sources and analysis"
---

# /deep-research — Conversational Deep Research

> Invoke this skill to deeply research a topic before making decisions. Works through phases with user checkpoints between each — you stay in control of the direction. Produces a research report, not a design doc. Use `/new-plan` after if you want to turn findings into an implementation plan.

---

## When to Use

- Exploring a new technology, pattern, or approach before committing to it
- Investigating how other tools/frameworks solve a problem you're facing
- Understanding the current codebase deeply before planning changes
- Comparing multiple approaches with trade-offs before choosing one
- Gathering context that will inform a future `/new-plan` or `/new-feature`
- Any question where "just try it" is too risky and you need data first

## When NOT to Use

- You already know what to build — use `/new-plan` or `/new-feature` directly
- Simple factual question — just ask directly without invoking a skill
- Bug investigation — use `/new-hotfix` which has its own analysis phase

---

## How It Works

The research runs in 4 phases. Between each phase, you present findings to the user and ask for direction before continuing. The user can redirect, narrow, expand, or terminate at any checkpoint.

```
Phase 1: Scope        → "Here's what I understand. What should I focus on?"
Phase 2: Explore      → "Here's what I found. Which threads should I pull?"
Phase 3: Analyze      → "Here's my analysis. Anything missing or wrong?"
Phase 4: Synthesize   → "Here's the report. Want me to refine anything?"
```

---

## Phase 1: Scope

### 1a. Understand the Research Question

Parse the user's request into:
- **Primary question**: What specifically needs to be answered?
- **Context**: Why does this matter? What decision does it inform?
- **Constraints**: Budget, timeline, technology, compatibility requirements
- **Known unknowns**: What does the user already suspect but needs confirmed?

### 1b. Define Research Scope

Identify the research dimensions:
- **Internal** (codebase): What existing code, patterns, or architecture is relevant?
- **External** (web): What documentation, blog posts, papers, or community knowledge is needed?
- **Comparative**: Are there multiple approaches/tools to compare?

### 1c. Checkpoint: Present Scope to User

Present your understanding and ask for direction:

```markdown
## Research Scope

**Primary question**: <restate in your own words>
**Decision it informs**: <what will the user do with this research>

### Research Dimensions

| Dimension | What I'll Investigate |
|-----------|----------------------|
| Internal | <codebase areas to explore> |
| External | <web topics to research> |
| Comparative | <approaches/tools to compare, if any> |

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

### 2b. External Research (Web)

If the scope includes external research:
- Use `WebSearch` for broad topic discovery
- Use `WebFetch` for deep reading of specific articles/docs
- Use Playwright browser tools for interactive research (docs that require navigation, GitHub issues, forum threads)
- Collect sources with URLs for citation

### 2c. Comparative Research

If the scope includes comparison:
- Build a comparison matrix
- Research each option with equal depth (don't bias toward the first one found)
- Note community adoption, maintenance status, and known issues

### 2d. Checkpoint: Present Findings to User

Present raw findings organized by dimension:

```markdown
## Phase 2 Findings

### Internal (Codebase)
<what I found in the codebase — specific files, patterns, constraints>

### External (Web Research)
<key findings from web research with source links>

### Comparative (if applicable)
| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| ... | ... | ... | ... |

### Emerging Themes
- <theme 1>
- <theme 2>

### Open Questions
- <question that needs deeper investigation>
- <question that needs user input>

**Which threads should I pull deeper? Any areas to skip or add?**
```

Wait for user response. They may say "go deeper on X", "skip Y", "also look at Z".

---

## Phase 3: Analyze (Iterative — may repeat)

> Phase 3 is iterative. Each analysis round cross-references new findings against the original goal, prior research, and existing context. You may loop through 3a-3d multiple times as new threads emerge or the user redirects.

### 3a. Cross-Reference Against Goal

Before going deeper on any thread, re-read the original research question from Phase 1. Ask:
- Does this thread actually help answer the question?
- Does it contradict something found in Phase 2?
- Does it change the scope or assumptions?

If a thread doesn't serve the goal, note why and skip it. Don't chase interesting tangents that don't answer the question.

### 3b. Deep Dive on Selected Threads

Based on user direction from Phase 2 checkpoint:
- Go deeper on the threads the user flagged
- Cross-reference internal findings with external research
- Cross-reference external sources against each other (do multiple sources agree?)
- Identify conflicts between sources — flag where sources disagree and note which has stronger evidence
- Test assumptions against the codebase (does the claimed approach actually work here?)
- Check recency — are findings from 2024 still valid in 2026? Has the landscape changed?

### 3c. Validate Against Prior Context

Cross-reference every finding against:
1. **The original research question** — still answering the right question?
2. **Phase 2 findings** — does the deep dive confirm or contradict the initial exploration?
3. **Codebase reality** — does the external research actually apply to this project's constraints?
4. **User's stated constraints** — budget, timeline, technology preferences from Phase 1

Flag any contradictions explicitly. Don't smooth them over.

### 3d. Risk and Trade-off Analysis

For each approach or finding:
- **Pros**: What problems does it solve?
- **Cons**: What problems does it create?
- **Risks**: What could go wrong?
- **Dependencies**: What else needs to change?
- **Effort**: How much work is involved?
- **Confidence**: How confident are you in this finding? (high/medium/low — based on source quality, source agreement, and whether it was validated against the codebase)

### 3e. Checkpoint: Present Analysis to User

```markdown
## Phase 3 Analysis (Round <N>)

### Goal Alignment Check
**Original question**: <restate from Phase 1>
**Are we still on track?**: <yes/no — if no, explain the drift>

### Key Findings

**Finding 1**: <title>
- Evidence: <what sources say>
- Confidence: <high/medium/low>
- Cross-reference: <agrees with / contradicts Phase 2 finding X>
- Codebase validation: <tested against codebase? result?>

**Finding 2**: <title>
- Evidence: <what sources say>
- Confidence: <high/medium/low>
- Cross-reference: <agrees with / contradicts>
- Codebase validation: <tested? result?>

### Contradictions Found
- <source A says X, source B says Y — here's which has stronger evidence and why>

### Trade-off Matrix (if comparing approaches)

| Factor | Approach A | Approach B | Confidence |
|--------|-----------|-----------|------------|
| Complexity | ... | ... | high/med/low |
| Performance | ... | ... | high/med/low |
| Maintainability | ... | ... | high/med/low |
| Risk | ... | ... | high/med/low |

### Recommendations (preliminary)
1. <recommendation with rationale>
2. <alternative if recommendation 1 isn't viable>

### Remaining Uncertainty
- <what I still don't know>
- <what would require prototyping to confirm>

### Iteration Options
- **Go deeper**: <specific threads that could use another round>
- **Ready to synthesize**: <if findings are solid enough>

**Does this analysis look right? Want another iteration round, or ready to synthesize?**
```

Wait for user response. If the user says "go deeper on X" or "check Y against Z":
- Loop back to 3a (cross-reference against goal)
- Research the new thread
- Present updated analysis as "Round N+1"
- Continue until the user says "ready to synthesize"

---

## Phase 4: Synthesize

### 4a. Final Cross-Reference Pass

Before writing the report, do one final validation:
1. Re-read the original research question from Phase 1
2. For each key finding: does it directly answer or inform the question?
3. For each recommendation: is it supported by multiple sources?
4. For each contradicting source: is the contradiction resolved or clearly flagged?
5. Remove findings that don't serve the goal (note them in an appendix if potentially useful later)

### 4b. Compile Research Report

Produce the final research document. Save to `.claude/progress/<topic>-research.md`.

### 4b. Report Format

```markdown
# Research Report: <Topic>

**Author**: /deep-research
**Date**: <YYYY-MM-DD>
**Status**: COMPLETE
**Research question**: <the primary question>
**Decision it informs**: <what the user will do with this>

---

## Executive Summary

<2-3 paragraphs: what was researched, key findings, recommended direction>

## 1. Scope and Methodology

### Research Question
<full statement of what was investigated and why>

### Methodology
- Internal: <what codebase areas were explored>
- External: <what web sources were consulted>
- Comparative: <what was compared, if applicable>

## 2. Findings

### 2.1 <Finding Category 1>
<detailed findings with evidence and source citations>
**Confidence**: high/medium/low
**Sources agree**: yes/partial/no — <note any contradictions>
**Validated against codebase**: yes/no/not applicable

### 2.2 <Finding Category 2>
<detailed findings with evidence and source citations>
**Confidence**: high/medium/low
**Sources agree**: yes/partial/no
**Validated against codebase**: yes/no/not applicable

### 2.3 <Finding Category 3>
<etc.>

## 3. Analysis

### Cross-Reference Summary
<How findings relate to each other. Which reinforce each other, which contradict.
 Note where external research was validated against the codebase and the result.>

### Contradictions and Resolutions
| Contradiction | Source A says | Source B says | Resolution |
|--------------|-------------|-------------|-----------|
| <topic> | <claim> | <claim> | <which is more credible and why> |

### Trade-offs
<trade-off analysis from Phase 3>

### Risks
<identified risks with likelihood and impact>

### Dependencies
<what else would need to change>

## 4. Recommendations

### Primary Recommendation
<what to do and why>

### Alternatives
<fallback options if primary doesn't work>

### What Would Change the Recommendation
<conditions under which a different approach would be better>

## 5. Open Questions

<things that couldn't be answered by research alone — would require prototyping, user testing, or expert consultation>

## 6. Sources

<numbered list of all sources consulted with URLs>

1. [Title](URL) — <what it contributed>
2. [Title](URL) — <what it contributed>
...
```

### 4c. Final Checkpoint: Present Report to User

```markdown
## Research Complete

Report saved to: `.claude/progress/<topic>-research.md`

### Summary
<2-3 sentence summary of key findings>

### Primary Recommendation
<one sentence>

### Next Steps
- To plan implementation: `/new-plan` (reference this research report)
- To implement directly: `/new-feature` (if the path is clear)
- To research further: ask follow-up questions in this session

**Want me to refine anything in the report?**
```

---

## Research Tools Available

| Tool | When to Use |
|------|-------------|
| `WebSearch` | Broad topic discovery, finding relevant sources |
| `WebFetch` | Deep reading of specific URLs (articles, docs, READMEs) |
| Playwright browser | Interactive web research — navigating docs, reading GitHub issues/PRs, forum threads |
| `Glob` | Find files by pattern in the codebase |
| `Grep` | Search for code patterns, keywords, usages |
| `Read` | Read specific files for deep understanding |
| `AskUserQuestion` | When you need user input to proceed (use at checkpoints, not mid-research) |

### Research Agent Spawning

For broad research topics, spawn parallel research agents using the Task tool:

```
Task tool parameters:
  description: "Research <specific subtopic>"
  subagent_type: general-purpose
  model: "sonnet"
  mode: bypassPermissions
  prompt: "Research <specific question>. Use WebSearch and WebFetch.
           Return findings with source URLs. Focus on <specific aspect>."
```

Spawn multiple agents for independent subtopics, then synthesize their findings.

---

## Integration with Other Commands

| After Research | Use |
|---------------|-----|
| Ready to plan implementation | `/new-plan` — reference the research report as input |
| Ready to implement directly | `/new-feature` — for well-scoped changes |
| Need a quick fix based on findings | `/new-hotfix` |
| Need to restructure based on findings | `/new-refactor` |
| Want to continue researching | Stay in this session and ask follow-up questions |
