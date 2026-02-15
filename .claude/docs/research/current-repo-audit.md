# Current Repo Audit: claude-workflow-skill

> Audit date: 2026-02-14
> Purpose: Document every file's role, plugin mapping, template variables, and cross-file dependencies to inform the plugin restructure.

---

## 1. Repository Overview

**Package name**: `create-claude-workflow`
**Version**: 1.0.0
**Architecture**: npm scaffolder that copies template files into a target project's `.claude/` directory, with `{{VARIABLE}}` substitution at scaffold time.
**Single dependency**: `@inquirer/prompts` (interactive CLI prompts)
**Entry point**: `npx create-claude-workflow init`

---

## 2. File Inventory by Directory

### Root Files

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `package.json` | npm package metadata, defines `bin`, `files`, `engines` | Becomes the plugin's `package.json` | None | None |
| `README.md` | User-facing documentation, install guide, command table | Becomes plugin README | None | References all commands/agents |
| `SPEC-v1-trim.md` | Internal spec for v1 focus/trim decisions (COMPLETED) | Internal doc, do not ship | None | References lib/ and template/ files |
| `LICENSE` | MIT license | Keep as-is | None | None |
| `.gitignore` | Standard ignores (node_modules, dist, .tgz, .env) | Keep as-is | None | None |

### bin/

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `bin/index.js` | CLI entry point. Parses `init` command, calls `scaffolder.init()` | **Scaffolder code** -- needs rethinking for plugin model. Plugins don't scaffold; they register. This may become a thin wrapper or be removed. | None | `lib/scaffolder.js` |

### lib/ (Scaffolder Code)

All files in `lib/` are scaffolding infrastructure. In a plugin model, these either get replaced by plugin registration logic, or become a separate "installer" tool.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `lib/scaffolder.js` | Main init flow: detect -> prompt -> install templates -> merge CLAUDE.md -> configure hooks -> print summary | **Scaffolder only** -- plugin model replaces this with declarative registration. May retain for `npx create-claude-workflow init` compat. | None (passes vars to templates.js) | `lib/detect.js`, `lib/prompts.js`, `lib/templates.js`, `lib/merge-claude-md.js`, `lib/merge-file.js` |
| `lib/templates.js` | Template loading, `{{VAR}}` substitution, recursive file listing, path mapping (templates/ -> .claude/) | **Scaffolder only** -- plugin model may not need file copying at all. Template var substitution is the key problem. | Processes all `{{VAR}}` patterns | `fs`, `path` |
| `lib/detect.js` | Detects CLAUDE.md variants, .claude/ directory contents, previous install markers, existing agents, git repo | **Scaffolder only** -- plugin model auto-detects at load time | None | `fs`, `path` |
| `lib/prompts.js` | Interactive CLI: confirm install, 3 variable questions (PROJECT_RULES_FILE, ARCHITECTURE_FILE, PROGRESS_DIR) | **Scaffolder only** -- plugin model needs runtime config resolution instead | None | `@inquirer/prompts` |
| `lib/merge-claude-md.js` | Sentinel-based merge of workflow section into CLAUDE.md (`<!-- BEGIN/END: claude-workflow -->`) | **Scaffolder only** -- plugin model does not modify CLAUDE.md | None (generates content using passed vars) | `fs` |
| `lib/merge-file.js` | File write with hash-based skip, .bak backup, conflict detection | **Scaffolder only** -- generic utility | None | `fs`, `path`, `crypto` |
| `lib/merge-agent.js` | v2 placeholder: protocol injection into existing agent files (sentinel-based). NOT called by scaffolder. | **Scaffolder only** -- v2 feature, unused | Contains `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}` in generated protocol block | `fs` |

### templates/commands/ (12 files -> plugin commands/)

These are slash command definitions. Each becomes a `.claude/commands/*.md` in the target project. In the plugin model, these become `commands/*.md` in the plugin package.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `implement-feature.md` | **Core command**. Full orchestration: branch, plan, spawn agents in waves, QA, Guardian, PR. 289 lines. | `commands/implement-feature.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: all agents, all prompts, playbook, spawn templates, QA checklist, progress template, workflow modes |
| `discover-agents.md` | Codebase analyzer: indexes project, detects stack, recommends agents, generates agent definitions. 302 lines. | `commands/discover-agents.md` | None (generates agent files with `{{SCOPED_PATHS}}`, `{{EXCLUDED_PATHS}}`, `{{SKILL_LIST}}`, `{{MCP_LIST}}` dynamically) | Reads: .claude/agents/, .claude/commands/, .claude/settings.json |
| `create-feature-plan.md` | Deep technical planning: codebase analysis, architecture design, task decomposition. 545 lines. | `commands/create-feature-plan.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: playbook, context budget guide, QA auto-fill rules |
| `resume-feature.md` | Crash recovery: scans progress files, shows status, resumes from last checkpoint. 207 lines. | `commands/resume-feature.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: progress dir, spawn templates, QA checklist, progress template, workflow modes |
| `claude-new.md` | Unified creation entry: feature/phase/task/plan/agent/idea. Routes to sub-flows. 406 lines. | `commands/claude-new.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: progress dir, .claude/agents/, IDEAS-BACKLOG-TEMPLATE.md |
| `status.md` | Quick progress summary: progress bar, task list, branch status, blockers. 152 lines. | `commands/status.md` | `{{PROGRESS_DIR}}` | Reads: progress dir |
| `hotfix.md` | Streamlined single-agent urgent fix. 201 lines. | `commands/hotfix.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: playbook, spawn templates, workflow modes |
| `refactor.md` | Safe restructuring with mandatory baseline, wave execution, before/after comparison. 333 lines. | `commands/refactor.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: playbook, spawn templates, pre-flight checks, workflow modes |
| `review-pr.md` | QA + Guardian on a pull request, posts combined results as PR comment. 223 lines. | `commands/review-pr.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}` | Reads: spawn templates, QA checklist |
| `generate-tests.md` | Test generation: identifies targets, spawns test-engineer, QA verifies. 242 lines. | `commands/generate-tests.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}` | Reads: spawn templates, QA checklist |
| `scaffold-agent.md` | Interactive Q&A to create a new agent definition. 274 lines. | `commands/scaffold-agent.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}` | Reads: .claude/agents/, CREATING-AGENTS.md |
| `audit-agents.md` | Scans agent definitions, checks scopes vs project structure, flags issues. 214 lines. | `commands/audit-agents.md` | None | Reads: .claude/agents/ |

### templates/agents/ (3 files -> plugin agents/)

Agent definitions. Each becomes a `.claude/agents/*.md` in the target project.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `team-leader.md` | Orchestrator agent. Decomposes features, manages branches, spawns agents in waves, merges work. Does NOT write code. 236 lines. | `agents/team-leader.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: playbook, spawn templates, QA checklist, QA auto-fill, progress template, context budget, workflow modes |
| `qa-reviewer.md` | Per-task quality gate. Reviews code, runs checks, updates docs on PASS. 262 lines. | `agents/qa-reviewer.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: QA checklist, performance log template |
| `codebase-guardian.md` | Final structural integrity check. 7 checks on merged feature branch. 207 lines. | `agents/codebase-guardian.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Reads: progress file for the feature |

### templates/hooks/ (4 files -> plugin hooks/)

Claude Code hooks (PreToolUse/PostToolUse). These are JavaScript files that read stdin JSON and output decisions.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `branch-guard.js` | PreToolUse/Bash: blocks git commit/push on protected branches (main, master, feature/*). Allows on work/*, hotfix/*, refactor/*. 56 lines. | `hooks/branch-guard.js` | None | `child_process` (execSync for `git branch --show-current`) |
| `destructive-guard.js` | PreToolUse/Bash: blocks force-push, hard reset, rm -rf, git clean -fd, git branch -D. 42 lines. | `hooks/destructive-guard.js` | None | None (pure regex matching) |
| `config-guard.js` | PreToolUse/Edit+Write: blocks agents from modifying .claude/ workflow files during execution. 44 lines. | `hooks/config-guard.js` | None | None (pure regex matching) |
| `activity-logger.js` | PostToolUse/Edit+Write: logs all file edits to `{{PROGRESS_DIR}}/.edit-log`. Non-blocking. 36 lines. | `hooks/activity-logger.js` | **`{{PROGRESS_DIR}}`** -- CRITICAL: this is a JS file that uses the template var as a string literal. In the scaffolder model, it gets replaced at scaffold time. In the plugin model, this needs runtime resolution. | `fs`, `path` |

### templates/prompts/implementing-features/ (11 files -> plugin prompts/ or inline)

Reference documents read by agents at runtime. These are the "playbook" and supporting templates.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `README.md` | **THE PLAYBOOK**. Master reference for Team Leader: lifecycle, branching, progress tracking, task decomposition, agent protocol, QA workflow, merge protocol, Guardian, crash recovery, workflow modes, wave fence, pre-flight, context budget. 618 lines. | `prompts/implementing-features/README.md` or consider inlining critical sections | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | References all other prompt files |
| `AGENT-SPAWN-TEMPLATES.md` | Copy-paste templates for spawning coding agents, QA agents, and Guardian. Embeds the mandatory phased workflow. 638 lines. | `prompts/implementing-features/AGENT-SPAWN-TEMPLATES.md` | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | Referenced by: team-leader, implement-feature, hotfix, refactor, resume-feature, generate-tests, review-pr |
| `QA-CHECKLIST-TEMPLATE.md` | Per-task QA checklist with auto-fill markers by role. 222 lines. | `prompts/implementing-features/QA-CHECKLIST-TEMPLATE.md` | `{{ARCHITECTURE_FILE}}` | Referenced by: qa-reviewer, implement-feature, review-pr, generate-tests, create-feature-plan |
| `PROGRESS-FILE-TEMPLATE.md` | Template for crash-recovery progress files. 131 lines. | `prompts/implementing-features/PROGRESS-FILE-TEMPLATE.md` | `{{PROGRESS_DIR}}` | Referenced by: team-leader, implement-feature, resume-feature |
| `WORKFLOW-MODES.md` | Three modes (strict/standard/fast) with behavior matrix. 172 lines. | `prompts/implementing-features/WORKFLOW-MODES.md` | `{{PROJECT_RULES_FILE}}` | Referenced by: team-leader, implement-feature, hotfix, refactor, resume-feature |
| `WAVE-FENCE-PROTOCOL.md` | Inter-wave synchronization: verify build/lint/test between waves. 160 lines. | `prompts/implementing-features/WAVE-FENCE-PROTOCOL.md` | None | Referenced by: playbook README, implement-feature |
| `PRE-FLIGHT-CHECKS.md` | Pre-agent baseline verification. Strict mode only. 141 lines. | `prompts/implementing-features/PRE-FLIGHT-CHECKS.md` | None | Referenced by: playbook README, implement-feature, refactor |
| `CONTEXT-BUDGET-GUIDE.md` | Context estimation formula, size limits, splitting protocol. 155 lines. | `prompts/implementing-features/CONTEXT-BUDGET-GUIDE.md` | None | Referenced by: team-leader, playbook README, create-feature-plan |
| `QA-CHECKLIST-AUTO-FILL-RULES.md` | Maps agent roles to QA checklist sections. Lookup table. 108 lines. | `prompts/implementing-features/QA-CHECKLIST-AUTO-FILL-RULES.md` | None | Referenced by: team-leader, implement-feature, create-feature-plan |
| `AGENT-PERFORMANCE-LOG-TEMPLATE.md` | QA performance tracking template. Strict mode only. 165 lines. | `prompts/implementing-features/AGENT-PERFORMANCE-LOG-TEMPLATE.md` | `{{PROGRESS_DIR}}` | Referenced by: team-leader, qa-reviewer |
| `IDEAS-BACKLOG-TEMPLATE.md` | Ideas backlog for `/claude-new idea`. 28 lines. | `prompts/implementing-features/IDEAS-BACKLOG-TEMPLATE.md` | None | Referenced by: claude-new |

### templates/docs/ (2 files -> plugin .claude/docs/customize-quick-start/)

User-facing documentation installed to the project's `.claude/docs/customize-quick-start/` directory.

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `CREATING-AGENTS.md` | Guide: agent anatomy, creation, scoping, naming, skills integration, testing. 419 lines. | Could become a skill (e.g., `/creating-agents` help skill) or stay as docs | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}` | Referenced by: scaffold-agent, audit-agents |
| `CUSTOMIZING-THE-WORKFLOW.md` | Guide: adjusting phases, branching, progress, merge, QA, modes, template vars. 309 lines. | Could become a skill or stay as docs | `{{PROJECT_RULES_FILE}}`, `{{ARCHITECTURE_FILE}}`, `{{PROGRESS_DIR}}` | References: all prompt files, all agent files, implement-feature |

### docs/ (Internal planning docs)

| File | Purpose | Plugin Mapping | Template Vars | Dependencies |
|------|---------|----------------|---------------|--------------|
| `.claude/docs/BASELINE-TOKEN-REPORT.md` | Token measurement report | Internal only, do not ship | None | None |
| `.claude/docs/internal/PLAN.md` | Distribution strategy document | Internal only, do not ship | None | None |
| `.claude/docs/internal/DEVELOPMENT-LOG.md` | Dev log of changes | Internal only, do not ship | None | None |
| `.claude/docs/internal/CUSTOMIZATION-AND-IDEAS.md` | Feature ideas and customization notes | Internal only, do not ship | None | None |
| `.claude/docs/plans/global-skill-refactor.md` | Plugin restructure plan | Internal only, do not ship | None | None |
| `.claude/docs/plans/2026-02-14-tmux-research.md` | Tmux research | Internal only, do not ship | None | None |
| `.claude/docs/plans/2026-02-14-tracker-design.md` | Tracker design | Internal only, do not ship | None | None |

---

## 3. Template Variable Analysis

### Variables Used

| Variable | Default Value | Set By | Used In (count) |
|----------|--------------|--------|-----------------|
| `{{PROJECT_RULES_FILE}}` | `CLAUDE.md` | `lib/prompts.js` interactive prompt | 28+ files (all commands, all agents, playbook, spawn templates, workflow modes, docs) |
| `{{ARCHITECTURE_FILE}}` | `docs/ARCHITECTURE.md` | `lib/prompts.js` interactive prompt | 25+ files (all commands, all agents, playbook, spawn templates, QA checklist, docs) |
| `{{PROGRESS_DIR}}` | `.claude/progress` | `lib/prompts.js` interactive prompt | 20+ files (commands, agents, playbook, progress template, performance log, activity-logger.js, docs) |
| `{{AGENT_ROLE}}` | Dynamic per agent | `discover-agents.md` at generation time | Generated agent files only |
| `{{AGENT_FILE_SCOPE}}` | Dynamic per agent | `discover-agents.md` at generation time | Generated agent files only |
| `{{AGENT_EXCLUDED_FILES}}` | Dynamic per agent | `discover-agents.md` at generation time | Generated agent files only |
| `{{SCOPED_PATHS}}` | Dynamic | `discover-agents.md` | Agent template in discover-agents |
| `{{EXCLUDED_PATHS}}` | Dynamic | `discover-agents.md` | Agent template in discover-agents |
| `{{SKILL_LIST}}` | Dynamic | `discover-agents.md` | Agent template in discover-agents |
| `{{MCP_LIST}}` | Dynamic | `discover-agents.md` | Agent template in discover-agents |
| `{{PROJECT_NAME}}` | Directory name | Not currently prompted | Referenced in docs but not actually used in templates |

### The Template Variable Problem

**Current model (scaffolder)**: Variables are replaced at scaffold time by `lib/templates.js:substituteVariables()`. The regex `\{\{(\w+)\}\}` finds all `{{VAR}}` patterns and replaces them with values from the config object. This produces static `.md` files with concrete paths.

**Plugin model problem**: Plugins serve files directly; there is no scaffold-time replacement. The variables need to be resolved at runtime. Options:

1. **Resolve at plugin load time**: Plugin reads project config and replaces vars before serving files to Claude. Requires a config file or detection logic.
2. **Use relative/conventional paths**: Replace `{{PROJECT_RULES_FILE}}` with `CLAUDE.md` (hardcoded default), `{{ARCHITECTURE_FILE}}` with `docs/ARCHITECTURE.md`, etc. Users who need different paths customize after install.
3. **Use plugin settings**: Claude's plugin system may support settings that get injected into template files.
4. **Keep scaffolder as install step**: `npx create-claude-workflow init` still runs, but produces a lightweight `.claude/workflow-config.json` that the plugin reads at runtime.

**Critical case -- `activity-logger.js`**: This hook file uses `{{PROGRESS_DIR}}` as a JavaScript string literal (`const logDir = '{{PROGRESS_DIR}}'`). In the scaffolder model, this becomes `const logDir = '.claude/progress'`. In the plugin model, this JS file needs a different approach:
- Read from a config file at runtime
- Use an environment variable
- Hardcode `.claude/progress` as default with config override

---

## 4. Cross-File Dependency Map

### Command Dependencies

```
implement-feature.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> QA-CHECKLIST-TEMPLATE.md
  reads -> PROGRESS-FILE-TEMPLATE.md
  reads -> WORKFLOW-MODES.md
  reads -> PRE-FLIGHT-CHECKS.md (strict mode)
  reads -> QA-CHECKLIST-AUTO-FILL-RULES.md
  reads -> CONTEXT-BUDGET-GUIDE.md
  spawns -> team-leader agent (implicitly, through agent team setup)
  writes -> PROGRESS_DIR/<feature>-progress.md

create-feature-plan.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md
  reads -> CONTEXT-BUDGET-GUIDE.md
  reads -> QA-CHECKLIST-AUTO-FILL-RULES.md
  reads -> .claude/agents/ (lists available agents)
  writes -> PROGRESS_DIR/<feature>-design.md

discover-agents.md
  reads -> entire codebase (glob + grep analysis)
  reads -> .claude/agents/, .claude/commands/, .claude/settings.json
  writes -> .claude/agents/<role>.md (new agent files)

resume-feature.md
  reads -> PROGRESS_DIR/ (scans for progress files)
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> QA-CHECKLIST-TEMPLATE.md
  reads -> PROGRESS-FILE-TEMPLATE.md
  reads -> WORKFLOW-MODES.md

claude-new.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> PROGRESS_DIR/ (active features)
  reads -> .claude/agents/ (existing agents)
  reads -> IDEAS-BACKLOG-TEMPLATE.md
  reads -> PROGRESS-FILE-TEMPLATE.md
  writes -> PROGRESS_DIR/<feature>-progress.md (feature sub-flow)
  writes -> PROGRESS_DIR/<feature>-design.md (plan sub-flow)
  writes -> PROGRESS_DIR/ideas-backlog.md (idea sub-flow)
  delegates -> /scaffold-agent (agent sub-flow)

hotfix.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> WORKFLOW-MODES.md
  writes -> PROGRESS_DIR/<fix>-progress.md

refactor.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> PRE-FLIGHT-CHECKS.md
  reads -> WORKFLOW-MODES.md
  writes -> PROGRESS_DIR/<scope>-refactor-progress.md

review-pr.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> QA-CHECKLIST-TEMPLATE.md
  spawns -> QA reviewer, Codebase Guardian

generate-tests.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> AGENT-SPAWN-TEMPLATES.md
  reads -> QA-CHECKLIST-TEMPLATE.md
  spawns -> test-engineer agent, QA reviewer

scaffold-agent.md
  reads -> .claude/agents/ (existing agents)
  reads -> CREATING-AGENTS.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  writes -> .claude/agents/<role>.md

audit-agents.md
  reads -> .claude/agents/ (all definitions)
  reads -> project source directories

status.md
  reads -> PROGRESS_DIR/ (progress files)
```

### Agent Dependencies

```
team-leader.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> playbook README.md (essential)
  reads -> AGENT-SPAWN-TEMPLATES.md (essential)
  reads -> WORKFLOW-MODES.md (reference)
  reads -> QA-CHECKLIST-TEMPLATE.md (reference)
  reads -> QA-CHECKLIST-AUTO-FILL-RULES.md (reference)
  reads -> PROGRESS-FILE-TEMPLATE.md (reference)
  reads -> CONTEXT-BUDGET-GUIDE.md (reference)
  writes -> PROGRESS_DIR/<feature>-progress.md
  spawns -> all coding agents, QA agents, Guardian

qa-reviewer.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> QA-CHECKLIST-TEMPLATE.md
  writes -> ARCHITECTURE_FILE (doc updates on PASS)
  writes -> PROGRESS_DIR/agent-performance-log.md (strict mode)

codebase-guardian.md
  reads -> PROJECT_RULES_FILE, ARCHITECTURE_FILE
  reads -> PROGRESS_DIR/<feature>-progress.md
  may fix -> trivial structural issues on feature branch
```

### Hook Dependencies

```
branch-guard.js     -> reads git branch state (child_process)
destructive-guard.js -> pure regex on command string
config-guard.js     -> pure regex on file path
activity-logger.js  -> writes to PROGRESS_DIR/.edit-log (uses {{PROGRESS_DIR}})
```

---

## 5. File Size Summary

| Category | Files | Total Lines (approx) |
|----------|-------|---------------------|
| Commands | 12 | ~3,400 |
| Agents | 3 | ~705 |
| Prompts | 11 | ~2,540 |
| Hooks | 4 | ~178 |
| Docs (template) | 2 | ~728 |
| Lib (scaffolder) | 7 | ~370 |
| Bin | 1 | ~21 |
| Root (README, etc) | 3 | ~585 |
| **Total shipped** | **43** | **~8,527** |

---

## 6. Plugin Mapping Summary

### Direct mappings (file moves)

| Current Path | Plugin Path | Notes |
|-------------|-------------|-------|
| `templates/commands/*.md` (12 files) | `commands/*.md` | Direct move, resolve template vars |
| `templates/agents/*.md` (3 files) | `agents/*.md` | Direct move, resolve template vars |
| `templates/hooks/*.js` (4 files) | `hooks/*.js` | Direct move, fix `activity-logger.js` var issue |
| `templates/prompts/**/*.md` (11 files) | `prompts/**/*.md` or inline as skills | May need restructuring for plugin discovery |
| `templates/docs/*.md` (2 files) | `.claude/docs/customize-quick-start/*.md` | User-facing guides |

### Scaffolder code (needs rethinking)

| Current Path | Plugin Equivalent | Notes |
|-------------|-------------------|-------|
| `bin/index.js` | May not be needed | Plugin registration replaces scaffolding |
| `lib/scaffolder.js` | Plugin `init` or `activate` hook | Core logic: detect, prompt, install |
| `lib/templates.js` | Runtime var resolution | Key function: `substituteVariables()` |
| `lib/detect.js` | Plugin `activate` hook | Auto-detection at plugin load |
| `lib/prompts.js` | Plugin settings/config | Interactive prompts -> declarative config |
| `lib/merge-claude-md.js` | Not needed | Plugins don't modify CLAUDE.md |
| `lib/merge-file.js` | Not needed | Plugins serve files, don't copy them |
| `lib/merge-agent.js` | Not needed (v2, unused) | Was already deferred |

### Internal docs (do not ship)

| Path | Action |
|------|--------|
| `.claude/docs/BASELINE-TOKEN-REPORT.md` | Keep in repo, exclude from plugin package |
| `.claude/docs/internal/*.md` (3 files) | Keep in repo, exclude from plugin package |
| `.claude/docs/plans/*.md` (3 files) | Keep in repo, exclude from plugin package |
| `SPEC-v1-trim.md` | Keep in repo, exclude from plugin package |

---

## 7. Key Findings for Plugin Restructure

### Finding 1: Template Variables are Pervasive
The three core variables (`PROJECT_RULES_FILE`, `ARCHITECTURE_FILE`, `PROGRESS_DIR`) appear in 30+ files. Any plugin solution MUST have a strategy for runtime variable resolution. The current scaffolder's search-and-replace approach cannot be used in a plugin that serves files directly.

### Finding 2: One Hook Uses Template Vars in JavaScript
`activity-logger.js` uses `{{PROGRESS_DIR}}` as a JS string literal. This is the only non-markdown file that uses template variables. It needs special handling (config file, env var, or hardcoded default).

### Finding 3: Commands are Self-Contained
Each command `.md` file is a complete workflow definition. They reference agents and prompts by relative path (`.claude/prompts/...`, `.claude/agents/...`). In a plugin model, these paths need to resolve to the plugin's directory instead.

### Finding 4: Prompts are Reference Material, Not Skills
The 11 files in `prompts/implementing-features/` are read by agents at runtime as reference material. They are not user-invocable skills. In the plugin model, they should remain as readable files that agents can `Read` during execution.

### Finding 5: Agents Reference Project-Specific Paths
Agent definitions hardcode paths like `.claude/prompts/implementing-features/README.md`. In a plugin model, these paths need to resolve to wherever the plugin stores its files.

### Finding 6: The Scaffolder Has Value Beyond Plugin Install
The scaffolder handles: detecting CLAUDE.md variants, merging workflow sections with sentinels, creating the progress directory, configuring hook settings in `.claude/settings.json`. Some of this (especially hook registration) may still be needed as a one-time setup step even in the plugin model.

### Finding 7: docs/ Templates Have Unclear Plugin Mapping
`CREATING-AGENTS.md` and `CUSTOMIZING-THE-WORKFLOW.md` are user-facing guides installed to `.claude/docs/customize-quick-start/`. Plugins don't have a standard `docs/` output. These could become:
- Skills that output the guide content when invoked
- Files in a `.claude/docs/` plugin directory that get served as prompts
- Removed from the plugin and published separately

### Finding 8: Hook Registration Needs Settings.json
The scaffolder writes hook configuration into `.claude/settings.json`. The plugin model needs an equivalent -- either the plugin system auto-registers hooks, or there is still a setup step.
