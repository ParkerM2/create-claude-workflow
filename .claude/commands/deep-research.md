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

## Phase 3: Analyze

### 3a. Deep Dive on Selected Threads

Based on user direction from Phase 2 checkpoint:
- Go deeper on the threads the user flagged
- Cross-reference internal findings with external research
- Identify conflicts, trade-offs, and dependencies
- Test assumptions against the codebase (does the claimed approach actually work here?)

### 3b. Risk and Trade-off Analysis

For each approach or finding:
- **Pros**: What problems does it solve?
- **Cons**: What problems does it create?
- **Risks**: What could go wrong?
- **Dependencies**: What else needs to change?
- **Effort**: How much work is involved?

### 3c. Checkpoint: Present Analysis to User

```markdown
## Phase 3 Analysis

### Key Findings

**Finding 1**: <title>
<detailed analysis with evidence>

**Finding 2**: <title>
<detailed analysis with evidence>

### Trade-off Matrix (if comparing approaches)

| Factor | Approach A | Approach B |
|--------|-----------|-----------|
| Complexity | ... | ... |
| Performance | ... | ... |
| Maintainability | ... | ... |
| Risk | ... | ... |

### Recommendations (preliminary)
1. <recommendation with rationale>
2. <alternative if recommendation 1 isn't viable>

### Remaining Uncertainty
- <what I still don't know>
- <what would require prototyping to confirm>

**Does this analysis look right? Anything missing or wrong? Ready to synthesize?**
```

Wait for user response.

---

## Phase 4: Synthesize

### 4a. Compile Research Report

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

### 2.2 <Finding Category 2>
<detailed findings with evidence and source citations>

### 2.3 <Finding Category 3>
<etc.>

## 3. Analysis

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
