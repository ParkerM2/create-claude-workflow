# Customization Guide & Future Ideas

> **Status: PARTIALLY IMPLEMENTED**
> - Part 1 (Docs): Shipped as `docs/CREATING-AGENTS.md` and `docs/CUSTOMIZING-THE-WORKFLOW.md`
> - Part 2 (Ideas): Items marked below. See `docs/internal/DEVELOPMENT-LOG.md` for current tracking.

> Working document — review before implementing. Split into two parts:
> Part 1: Documentation to ship (customization guides for users)
> Part 2: Ideas for new features/commands (discuss before building)

---

## Part 1: Documentation to Ship

These are guides users need when they install the plugin and want to tailor it.

---

### 1A. Customizing the Workflow

**Target file**: `prompts/guides/CUSTOMIZING-THE-WORKFLOW.md`

#### Topics to cover:

**Adjusting the phased workflow**
- How to add/remove phases from the agent spawn templates
- How to adjust the Error Recovery Protocol limits (e.g., 3 attempts instead of 2)
- How to change QA round limits (currently max 3)
- How to make QA rounds more/less strict

**Adjusting the branching model**
- How to change branch naming conventions (`work/` → `task/`, etc.)
- How to switch to worktrees instead of branches (for advanced users)
- How to add branch protection rules that complement the workflow
- How to integrate with trunk-based development (short-lived feature branches)

**Adjusting progress tracking**
- How to change the progress file location (`{{PROGRESS_DIR}}`)
- How to add custom fields to the progress file template
- How to integrate progress files with external tracking (Jira, Linear, GitHub Projects)

**Adjusting the merge protocol**
- How to switch from `--no-ff` to squash merges
- How to add CI checks as a merge gate (wait for GitHub Actions before merge)
- How to require user approval before each merge (instead of auto-merge on QA pass)

**Runtime configuration reference**
- Full list of configuration keys in `.claude/workflow.json`
- How the session-start hook injects configuration at runtime
- Examples of common configurations (monorepo, multi-package, etc.)

---

### 1B. Creating & Updating Agents

**Target file**: `prompts/guides/CREATING-AGENTS.md`

#### Topics to cover:

**Agent anatomy — what makes a good agent definition**
```
# <Agent Name>

> One-line description of what this agent does

## Identity
Who you are, what you do, what you DON'T do

## Initialization Protocol
Files to read before starting (project rules, architecture, etc.)

## Mandatory Planning Gate
Phase 0: Load rules
Phase 1: Write plan (cite specific rules)
Phase 2: Execute
Phase 3: Self-review

## Scope — Files You Own
ONLY create/modify: <glob patterns>
NEVER modify: <glob patterns>

## Error Recovery Protocol
What to do when things go wrong

## Quality Gates
Checks the agent runs before marking work complete

## Rules — Non-Negotiable
Hard constraints that cannot be overridden
```

**Creating a new specialist agent — step by step**
1. Identify the need (what files/domain does no existing agent cover?)
2. Define the scope (exact file patterns this agent owns)
3. Define the anti-scope (files it must NEVER touch)
4. Write the initialization protocol (which project docs to read)
5. Add the planning gate (copy from existing agent, adjust rules section)
6. Add domain-specific quality gates
7. Add domain-specific rules
8. Test: spawn the agent on a sample task, verify it follows the workflow
9. Add to `AGENT-SPAWN-TEMPLATES.md` if it needs a custom spawn template

**Updating an existing agent**
- When to update: new project conventions, new file structure, new tools
- What to change: scope paths, initialization files, quality gates, rules
- What NOT to change: the phased workflow structure (it's the enforcement mechanism)
- How to test changes: spawn the agent on a small task, verify plan output

**Scoping agents to avoid conflicts**
- Rule: no two agents should own the same file
- Use glob patterns for broad ownership (`src/services/**`)
- Use explicit exclusions for shared files (`NEVER modify: src/shared/types.ts`)
- When files must be shared: assign to one agent, others read-only
- The scope table: maintain a master list of agent → file mappings

**Agent naming conventions**
- Use role-based names: `component-engineer`, `database-engineer`
- Avoid technology-specific names: `react-component-builder` (locks you in)
- Suffix with `-engineer` for coding agents, `-reviewer` for QA-like agents
- Core agents: `team-leader`, `qa-reviewer`, `codebase-guardian` (always these names)

---

### 1C. Project-Specific QA Checks

**Target file**: section in `CUSTOMIZING-THE-WORKFLOW.md`

#### Topics to cover:

**How the QA checklist works**
- `QA-CHECKLIST-TEMPLATE.md` has generic sections (type safety, architecture, etc.)
- The "Feature-Specific Checks" section is where you add project-specific items
- The Team Leader fills this in per-task when spawning agents

**Adding permanent project-specific checks**
- Example: "All API endpoints must have rate limiting"
- Example: "All database queries must use parameterized statements"
- Example: "All React components must have a Storybook story"
- Add these to the QA checklist template so they apply to EVERY task

**Adding technology-specific sections**
- Example: Electron projects add IPC contract checks
- Example: GraphQL projects add schema validation checks
- Example: Mobile projects add platform-specific checks
- Create a `QA-CHECKLIST-EXTENSIONS/` directory with opt-in sections

---

## Part 2: Ideas for New Commands & Features

These are proposals. Mark which ones are worth building.

---

### 2A. New Commands

**`/resume-feature`** — Explicit crash recovery entry point **[SHIPPED]**
- Instead of relying on `/implement-feature` to detect crashed state
- Scans `{{PROGRESS_DIR}}/` for in-progress features
- Shows status summary, lets user pick which to resume
- Cleaner UX than hoping the auto-detection works
- *Complexity: Low (mostly reads progress files and resumes)*

**`/audit-agents`** — Review agent definitions against current codebase **[SHIPPED]**
- Scans `.claude/agents/` for existing definitions
- Compares agent file scopes against actual project structure
- Flags: agents with stale paths, agents missing new directories, overlapping scopes
- Suggests updates or new agents needed
- *Complexity: Medium (codebase analysis + agent file parsing)*

**`/status`** — Show current feature implementation progress **[SHIPPED]**
- Reads progress file for active feature
- Shows: tasks complete/in-progress/pending, QA results, merge status
- Quick at-a-glance view without reading the full progress file
- Could output a formatted summary or even a mermaid diagram
- *Complexity: Low (reads and formats one file)*

**`/hotfix`** — Streamlined workflow for urgent single-file fixes **[SHIPPED]**
- Skips team creation, wave planning, multiple agents
- Single agent → single QA → merge → PR
- Still enforces the phased workflow (plan before code)
- For: "fix this bug in auth.ts" type tasks that don't need full orchestration
- *Complexity: Low (simplified version of implement-feature)*

**`/review-pr <number>`** — Run QA + Guardian against an existing PR **[SHIPPED]**
- Checks out the PR branch
- Spawns QA to review all changed files
- Spawns Guardian for structural check
- Posts results as PR comment (via `gh pr comment`)
- For: reviewing PRs from human contributors or other tools
- *Complexity: Medium (needs PR context extraction + comment posting)*

**`/generate-tests`** — Focused test generation workflow **[SHIPPED]**
- Analyzes changed files, identifies what needs tests
- Spawns test-engineer agent with specific targets
- QA verifies test coverage and quality
- For: backfilling tests on existing code or ensuring new features have tests
- *Complexity: Medium (needs test coverage analysis)*

**`/refactor`** — Like implement-feature but for restructuring **[SHIPPED]**
- Analyzes current structure, proposes refactoring plan
- Special conflict handling: refactors touch many files, need careful scoping
- Preserves behavior (tests must pass before and after)
- For: "reorganize the services directory" or "extract shared utilities"
- *Complexity: High (refactoring is inherently complex)*

**`/scaffold-agent <role>`** — Interactive agent definition creator **[SHIPPED]**
- Asks questions about the agent's scope, responsibilities, rules
- Generates `.claude/agents/<role>.md` from answers
- Pre-fills the phased workflow sections
- For: users who want to create agents without writing markdown from scratch
- *Complexity: Low-Medium (template generation with prompts)*

---

### 2B. Workflow Enhancements

**Agent performance tracking** **[SHIPPED]** — `AGENT-PERFORMANCE-LOG-TEMPLATE.md`
- After each QA cycle, log: agent role, task complexity, QA rounds needed, issues found
- Over time: which agents fail QA most? Which rules are violated most?
- Store in `{{PROGRESS_DIR}}/agent-metrics.json` or similar
- Use to improve agent definitions (add rules for common violations)
- *Value: High. Data-driven agent improvement.*

**Configurable workflow modes** **[SHIPPED]** — `WORKFLOW-MODES.md`
- `strict` (default): full phased workflow, all gates enforced
- `standard`: phased workflow but fewer QA checks, faster iteration
- `fast`: single QA round, no Guardian, for rapid prototyping
- User sets mode in `{{PROJECT_RULES_FILE}}` or per-feature
- *Value: Medium. Reduces friction for small tasks.*

**Pre-flight checks before spawning agents** **[SHIPPED]** — `PRE-FLIGHT-CHECKS.md`
- Before spawning any agent: verify the project builds, tests pass, lint clean
- If baseline is broken: warn user, don't spawn agents on a broken codebase
- Saves agent time (agents won't waste cycles on pre-existing failures)
- *Value: High. Prevents cascading failures.*

**QA checklist auto-fill from agent scope** **[SHIPPED]** — `QA-CHECKLIST-AUTO-FILL-RULES.md`
- When Team Leader creates a task, auto-populate the QA checklist
- Based on: agent role (UI agent → add accessibility checks), file types touched
- Team Leader only needs to add feature-specific checks
- *Value: Medium. Reduces Team Leader boilerplate.*

**Agent context budget management** **[SHIPPED]** — `CONTEXT-BUDGET-GUIDE.md`
- Each agent estimates context usage before starting
- If a task is too large for one context window: split into sub-tasks automatically
- Track context consumption in progress file
- *Value: High. Prevents the "ran out of context" problem.*

**Parallel wave execution with fence** **[SHIPPED]** — `WAVE-FENCE-PROTOCOL.md`
- Currently: waves are strictly sequential
- Enhancement: within a wave, agents run in parallel but wait at a "fence" before next wave
- Team Leader doesn't need to manually track completion — fence auto-triggers next wave
- *Value: Medium. Faster execution for large features.*

---

### 2C. Integration Ideas

**GitHub Actions integration**
- Workflow file that reads progress files and posts status to PR
- Auto-label PRs based on feature status (in-progress, qa-review, ready-to-merge)
- Could trigger Guardian check as a CI step
- *Complexity: Medium*

**VS Code extension**
- Sidebar panel showing active feature progress
- Click to open progress file, agent definitions, or playbook
- Status bar showing current wave and task count
- *Complexity: High (separate project)*

**Slack/Discord notifications**
- Post to channel when: feature starts, QA fails, QA passes, feature complete
- Useful for team visibility in multi-person projects
- Could use MCP server for messaging
- *Complexity: Low-Medium (MCP integration)*

**Progress dashboard (web)**
- Simple static page that reads `{{PROGRESS_DIR}}/*.md` and renders a dashboard
- Shows all active features, their status, agent registry, QA results
- Could be a GitHub Pages site or local dev server
- *Complexity: Medium*

---

### 2D. Template Improvements

**Stack-specific QA extensions**
- `QA-CHECKLIST-REACT.md` — React-specific checks (hooks rules, accessibility, etc.)
- `QA-CHECKLIST-PYTHON.md` — Python-specific checks (type hints, docstrings, etc.)
- `QA-CHECKLIST-GO.md` — Go-specific checks (error handling, linting, etc.)
- Opt-in: Team Leader includes relevant extension in QA checklist
- *Complexity: Low (markdown templates)*

**Agent definition presets**
- `agents/presets/react-fullstack/` — component-engineer, api-engineer, test-engineer
- `agents/presets/python-api/` — service-engineer, database-engineer, test-engineer
- `agents/presets/electron/` — ipc-handler-engineer, component-engineer, desktop-engineer
- User selects preset during `/discover-agents`
- *Complexity: Low (curated agent definitions)*

**Spawn template variants**
- `AGENT-SPAWN-TEMPLATES-MINIMAL.md` — for small tasks (fewer phases)
- `AGENT-SPAWN-TEMPLATES-STRICT.md` — for critical code (extra verification)
- Team Leader selects variant based on task importance
- *Complexity: Low (template variants)*

---

## Questions to Discuss

1. Which new commands are highest priority?
2. Should customization docs be separate files or sections in the main README?
3. Should we ship stack-specific QA extensions now or wait for user feedback?
4. How detailed should the agent creation guide be? (cookbook style vs reference style)
5. Do we want the workflow modes (strict/standard/fast) or is one mode enough?
6. Should `/hotfix` exist or should `/implement-feature` be smart enough to detect small tasks?
