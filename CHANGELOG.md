# Changelog

## [2.0.0] — 2026-02-14

### Changed
- Migrated from npm scaffolder to Claude Code plugin system
- Commands, agents, and prompts now live at plugin root (not templates/)
- Template variables ({{VAR}}) replaced with runtime config via session-start hook
- Installation via `/plugin install` instead of `npx create-claude-workflow`

### Added
- Plugin manifest (.claude-plugin/plugin.json)
- Hook system (hooks.json + 5 hook scripts)
- Skills (using-workflow, workflow-setup)
- Marketplace structure for plugin distribution

### Removed
- npm scaffolder (lib/, bin/, templates/, package.json)
- Template variable baking at install time
- Per-project file scaffolding

## [1.0.0] - 2026-02-14

### Added
- Plugin system: installable via Claude Code marketplace
- 12 workflow commands: implement-feature, create-feature-plan, resume-feature, claude-new, status, hotfix, refactor, review-pr, generate-tests, scaffold-agent, audit-agents, discover-agents
- 3 agent definitions: team-leader, qa-reviewer, codebase-guardian
- 4 enforcement hooks: branch-guard, destructive-guard, config-guard, activity-logger
- SessionStart bootstrap hook with project configuration injection
- Workflow modes: strict, standard, fast
- Crash recovery via progress files and /resume-feature
- Per-project configuration via .claude/workflow.json

### Changed
- Migrated from npm scaffolder (`npx create-claude-workflow init`) to Claude Code plugin system
- Template variables replaced with runtime configuration injection
