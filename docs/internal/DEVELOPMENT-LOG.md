# Development Log

> Central tracking document for the create-claude-workflow project.
> Updated after each development session.

---

## Current State: v1.0.0 (pre-publish)

**Identity**: The best way to run multi-agent development with Claude Code.

**Core product**: `/implement-feature` — one command that decomposes features into tasks, spawns agents in waves on isolated branches, QA-reviews each, and merges cleanly.

**Distribution**: `npx create-claude-workflow init` — scaffolds the skill pack into any project.

---

## File Inventory (28 template files + 8 scaffolder files)

| Category | Count | Key Files |
|----------|-------|-----------|
| Commands | 12 | implement-feature, discover-agents, resume-feature, claude-new, + 8 extended |
| Agents | 3 | team-leader, qa-reviewer, codebase-guardian |
| Prompts | 11 | README (playbook), AGENT-SPAWN-TEMPLATES, QA-CHECKLIST, + 8 supporting |
| Docs | 2 | CREATING-AGENTS, CUSTOMIZING-THE-WORKFLOW |
| Scaffolder | 8 | package.json, bin/index.js, lib/*.js (7 modules) |

---

## Milestone History

### Session 1 — Foundation (PR #11, branch: feature/skill-pack-expansion-v2)

**Built:**
- 11 command templates (implement-feature, discover-agents, create-feature-plan, resume-feature, status, hotfix, review-pr, generate-tests, refactor, scaffold-agent, audit-agents)
- 3 agent definitions (team-leader, qa-reviewer, codebase-guardian)
- 10 prompt/template files (playbook README, spawn templates, QA checklist, progress file, workflow modes, wave fence, pre-flight, context budget, auto-fill rules, performance log)
- 2 user-facing docs (CREATING-AGENTS, CUSTOMIZING-THE-WORKFLOW)
- Baseline token report (all scenarios under 12% of 200k context)

### Session 2 — /claude-new + XML Refactor + Scaffolder

**Built:**
- `/claude-new` unified creation command (6 sub-flows: feature, phase, task, plan, agent, idea)
- IDEAS-BACKLOG-TEMPLATE for `/claude-new idea`
- Hybrid XML+Markdown format refactor across 9 files (13 semantic tag types)
- YAML frontmatter on 3 template files
- Full scaffolder: package.json, bin/index.js, 7 lib modules

**XML tag vocabulary established:**
| Tag | Used In |
|-----|---------|
| `<agent-identity>`, `<agent-scope>`, `<planning-gate>`, `<error-recovery>`, `<rules>` | 3 agent files |
| `<spawn-parameters>`, `<workflow-phases>`, `<phase>`, `<task-context>` | AGENT-SPAWN-TEMPLATES |
| `<checklist-section roles="...">` | QA-CHECKLIST-TEMPLATE |
| `<qa-entry>` | PERFORMANCE-LOG-TEMPLATE |
| `<mode name="...">` | WORKFLOW-MODES |
| `<estimation-formula>` | CONTEXT-BUDGET-GUIDE |

### Session 2 (continued) — v1 Focus Trim

**Audit finding**: The project was spreading thin — 13 features listed equally, scaffolder over-engineered for edge cases, 9-file init protocol.

**Decisions made:**
1. `/implement-feature` is the product. Everything else supports or extends it.
2. README should be a product page, not a feature catalog.
3. Scaffolder should ask 3 questions, not 5+.
4. Team Leader reads 4 essential files, 5 on-demand.
5. Internal planning docs out of user's sight.

**Changes:**
- README rewritten as product page (308 → 258 lines)
- Scaffolder simplified: removed agent protocol injection, per-file conflict prompts, agent classification
  - `lib/prompts.js`: 112 → 69 lines
  - `lib/scaffolder.js`: 123 → 101 lines
  - `lib/detect.js`: 123 → 95 lines
  - `lib/merge-agent.js`: marked as v2 library, not called in v1
- Team Leader init protocol: 9 flat → 4 essential + 5 reference
- Playbook trimmed: 631 → 594 lines (sections 11-14 → pointers to dedicated files)
- PLAN.md and CUSTOMIZATION-AND-IDEAS.md moved to docs/internal/
- .npmignore created

---

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Hybrid XML+Markdown format | +23% accuracy on structured tasks per research; tags are additive, max 2 nesting levels | Session 2 |
| 2 | Sentinel-delimited merging (`<!-- BEGIN/END -->`) | Re-running init replaces section rather than duplicating; works for CLAUDE.md and agent files | Session 2 |
| 3 | Single npm dependency (`@inquirer/prompts`) | All file ops use Node built-ins; scaffolder doesn't need heavy frameworks | Session 2 |
| 4 | Agent protocol injection deferred to v2 | < 5% of v1 users have existing agents; simplify init flow | Session 2 |
| 5 | Agent classification deferred to v2 | WORKFLOW_COMPATIBLE/PARTIAL/STANDALONE scoring is premature; just list names for now | Session 2 |
| 6 | Commands split into Core (3) + Extended (9) | Signals hierarchy; core is the product, extended is available when needed | Session 2 |
| 7 | Template variables use `{{VARIABLE}}` pattern | Simple, grep-able, no build step; 5 canonical variables | Session 1 |
| 8 | All templates are user-owned `.md` | No runtime dependency; users can customize anything post-install | Session 1 |

---

## What's Next (Not Yet Started)

### Pre-Publish Checklist

- [ ] Re-run baseline token report (numbers changed after XML refactor + trim)
- [ ] Smoke test: `node bin/index.js init` in a temp directory
- [ ] Merge test: init in a directory with existing CLAUDE.md + agents
- [ ] Verify all `{{VARIABLE}}` references use canonical names
- [ ] Verify all cross-file path references resolve
- [ ] npm publish as `create-claude-workflow`
- [ ] GitHub release

### v2 Ideas (Deferred)

- Agent protocol injection during init (per-agent opt-in)
- Agent compatibility classification (WORKFLOW_COMPATIBLE / PARTIAL / STANDALONE)
- Preset packs (`--preset=electron`, `--preset=react`)
- Community agent marketplace
- Progress dashboard (web UI)
- VS Code extension

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/internal/PLAN.md` | Original distribution vision | Superseded by this log |
| `docs/internal/CUSTOMIZATION-AND-IDEAS.md` | Feature ideas backlog | Part 1 implemented, Part 2 partially implemented |
| `SPEC-v1-trim.md` | v1 focus trim specification | Completed |
| `docs/BASELINE-TOKEN-REPORT.md` | Template token measurements | Outdated (pre-XML-refactor) |
