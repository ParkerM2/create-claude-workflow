# Development Log

> Central tracking document for the claude-workflow plugin project.
> Updated after each development session.

---

## Current State: v2.0.0 (plugin system)

**Identity**: The best way to run multi-agent development with Claude Code.

**Core product**: `/implement-feature` — one command that decomposes features into tasks, spawns agents in waves on isolated branches, QA-reviews each, and merges cleanly.

**Distribution**: Claude Code plugin system — install via `/plugin install` from the marketplace or add as a local plugin.

---

## File Inventory (plugin assets)

| Category | Count | Key Files |
|----------|-------|-----------|
| Commands | 12 | implement-feature, discover-agents, resume-feature, claude-new, + 8 extended |
| Agents | 3 | team-leader, qa-reviewer, codebase-guardian |
| Prompts | 11 | README (playbook), AGENT-SPAWN-TEMPLATES, QA-CHECKLIST, + 8 supporting |
| Docs | 2 | CREATING-AGENTS, CUSTOMIZING-THE-WORKFLOW |
| Hooks | 6 | hooks.json, session-start, branch-guard, destructive-guard, config-guard, activity-logger |
| Skills | 2 | workflow-setup, using-workflow |
| Plugin | 1 | .claude-plugin/plugin.json |

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

### Session 3 — Plugin Restructure (v2.0.0)

**Motivation**: Claude Code introduced a native plugin system, making the npm scaffolder unnecessary. Plugins install directly via `/plugin install` and load commands, agents, prompts, hooks, and skills without file scaffolding.

**Built:**
- Plugin manifest (`.claude-plugin/plugin.json`)
- Hook system: `hooks.json` + 5 hook scripts (session-start, branch-guard, destructive-guard, config-guard, activity-logger)
- Skills: `workflow-setup` (project configuration), `using-workflow` (usage guide)
- Marketplace structure for plugin distribution
- Runtime configuration injection via session-start hook (replaces template variable baking)

**Removed:**
- npm scaffolder: `package.json`, `bin/index.js`, `lib/*.js` (7 modules)
- `templates/` directory (commands, agents, prompts moved to plugin root)
- Template variable system (`{{VAR}}` baking at install time)
- Per-project file scaffolding

**Migration:**
- All 12 commands moved from `templates/commands/` to `commands/`
- All 3 agents moved from `templates/agents/` to `agents/`
- All 11 prompts moved from `templates/prompts/` to `prompts/`
- All 2 guides moved from `templates/docs/` to `prompts/guides/`
- Template variables replaced with runtime config via `.claude/workflow.json`

---

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Hybrid XML+Markdown format | +23% accuracy on structured tasks per research; tags are additive, max 2 nesting levels | Session 2 |
| 2 | Sentinel-delimited merging (`<!-- BEGIN/END -->`) | Re-running init replaces section rather than duplicating; works for CLAUDE.md and agent files | Session 2 |
| 3 | ~~Single npm dependency (`@inquirer/prompts`)~~ | ~~Scaffolder-specific; removed in v2.0.0 plugin migration~~ | Session 2 |
| 4 | ~~Agent protocol injection deferred~~ | ~~Scaffolder-specific; removed in v2.0.0 plugin migration~~ | Session 2 |
| 5 | ~~Agent classification deferred~~ | ~~Scaffolder-specific; removed in v2.0.0 plugin migration~~ | Session 2 |
| 6 | Commands split into Core (3) + Extended (9) | Signals hierarchy; core is the product, extended is available when needed | Session 2 |
| 7 | ~~Template variables use `{{VARIABLE}}` pattern~~ | ~~Replaced in v2.0.0 with runtime config via session-start hook~~ | Session 1 |
| 8 | All plugin assets are `.md` files | No runtime dependency; users can fork and customize anything | Session 1 |

---

## What's Next

### Pre-Publish Checklist

- [ ] Verify all cross-file path references resolve
- [ ] Smoke test: install plugin in a fresh project via `/plugin add`
- [ ] Test `/workflow-setup` configuration flow
- [ ] Test `/implement-feature` end-to-end
- [ ] Publish to marketplace
- [ ] GitHub release

### Future Ideas

- Preset agent packs (e.g., react-fullstack, python-api)
- Community agent marketplace
- Progress dashboard (web UI)
- VS Code extension
- GitHub Actions integration for CI-based Guardian checks

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/internal/CUSTOMIZATION-AND-IDEAS.md` | Feature ideas backlog | Part 1 implemented, Part 2 mostly shipped |
| `CHANGELOG.md` | Release history | Current (v2.0.0) |
