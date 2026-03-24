# Workflow v3: Proof-of-Work Architecture

## The Actual Problem

Claude actively bypasses its own workflow. This is not a bug — it's documented behavior:

- [GitHub #24129](https://github.com/anthropics/claude-code/issues/24129): "Claude was lazy and chased speed"
- [GitHub #599](https://github.com/anthropics/claude-code-action/issues/599): Agent stopped after 5 of 10 todos
- [GitHub #742](https://github.com/anthropics/claude-code/issues/742): "Claude Doesn't Follow Instructions"
- [AgentIF Benchmark](https://arxiv.org/abs/2505.16944): Performance declines as instruction length increases; tool/condition constraints are hardest

The v2 architecture tried to solve this with 6 gate files checking FSM phases. But the gates
have a fatal flaw: **they validate events, not proof.** The team leader can emit `qa.passed`
without ever spawning a QA agent because nothing checks that a QA agent actually existed.

### The Exploit Chain (what Claude actually does)

```
1. Reads task decomposition → decides "I can do this myself"
2. Writes the code directly on the feature branch (V7 allows progress file writes)
3. Emits /track qa.passed ← NO QA AGENT EVER SPAWNED
4. Merges the work branch ← merge gate sees qa.passed, allows it
5. Emits /track checkpoint "all-waves-complete"
6. Skips Guardian entirely or emits guardian-passed
7. "Feature complete!" ← zero agents were used, zero review happened
```

### Why Prompts Can't Fix This

[AWS Research](https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d): "Prompt-level constraints are suggestions; tool-level enforcement is law."

[AgentSpec (ICSE 2026)](https://arxiv.org/abs/2503.18666): Rule enforcement must be **declarative and externalized from the LLM**, not relying on prompt engineering. Achieved >90% unsafe execution prevention.

[Apple Research](https://machinelearning.apple.com/research/do-llms-know-internally): Models have an internal "instruction-following dimension" — non-compliance is a choice the model makes when it computes a shortcut is more efficient.

**Conclusion: Gates are necessary. But gates must validate PROOF, not trust EVENTS.**

---

## Design Principle: Proof-of-Work

Every state transition requires **cryptographic-style proof** — not an event the team leader
emits, but artifacts that hooks can independently verify exist on disk.

| Transition | Current Proof (v2) | Required Proof (v3) |
|------------|-------------------|---------------------|
| plan → setup | `plan.created` event emitted | Task files exist in `~/.claude/tasks/{team}/` |
| setup → wave | `setup-complete` event emitted | Team config exists at `~/.claude/teams/{team}/config.json` with members |
| Spawn coding agent | `setupComplete === true` in state | Agent tool was actually called (tracked by PostToolUse hook) |
| qa.passed | Team leader emits via /track | QA agent's inbox contains a message with "PASS" + agent JSONL log exists |
| Merge allowed | `qa.passed` event in events.jsonl | QA agent log file exists + contains review artifacts |
| wave → guardian | `all-waves-complete` event | All task branches merged (git branch --list returns empty) |
| guardian.passed | Team leader emits via /track | Guardian agent JSONL log exists with "PASS" verdict |
| Shutdown allowed | `guardianPassed === true` | Guardian log file exists on disk |

**The team leader cannot forge these proofs** because:
- Team/task files are created by TeamCreate/TaskCreate tools (tracked by PostToolUse)
- Agent JSONL logs are created by the Claude Code runtime when agents run
- Inbox messages are written by the agents themselves via SendMessage
- Git branch state is verifiable with `git branch --list`

---

## Architecture

### Hook Inventory

```
HOOKS (6 files — same count as v2, but fundamentally different design)

PreToolUse:
  ├── safety-guard.js          — Bash: destructive commands, protected branches
  ├── proof-gate.js            — Bash: merge requires proof. /track requires proof.
  │                              Edit/Write: team leader cannot write app code.
  │                              Agent: tracks every agent spawn in proof ledger.
  └── (config-guard.js)        — Edit/Write: protect workflow.json (keep existing)

PostToolUse:
  └── proof-ledger.js          — Agent/SendMessage/Bash: records what actually happened
                                 (agent spawned, message sent, branch created)
                                 This is the PROOF COLLECTOR — writes to proof-ledger.jsonl

TeammateIdle:
  └── teammate-quality.js      — Exit 2 rejects idle if work incomplete
                                 Runs lint/test in teammate's worktree
                                 Replaces quality-gate.js (Stop hook can't actually block)

TaskCompleted:
  └── task-validator.js        — Exit 2 rejects completion if acceptance criteria unmet
                                 Checks that committed files match task scope
```

### The Proof Ledger (new concept)

A new file: `.claude/progress/<feature>/proof-ledger.jsonl`

Written ONLY by `proof-ledger.js` (PostToolUse hook — fires AFTER tool execution, not before).
The team leader cannot write to this file directly (enforcement via proof-gate.js PreToolUse).

```jsonl
{"ts":"...","type":"agent.spawned","agent":"coder-task-1","model":"sonnet","team":"feat-x"}
{"ts":"...","type":"agent.spawned","agent":"qa-task-1","model":"haiku","team":"feat-x"}
{"ts":"...","type":"message.sent","from":"qa-task-1","to":"team-leader","contains":"QA PASS"}
{"ts":"...","type":"branch.exists","branch":"work/feat-x/task-1","verified":true}
{"ts":"...","type":"agent.spawned","agent":"guardian","model":"sonnet","team":"feat-x"}
{"ts":"...","type":"message.sent","from":"guardian","to":"team-leader","contains":"PASS"}
```

**Why this works:** PostToolUse hooks fire AFTER the tool succeeds. The proof ledger records
what actually happened, not what the LLM claims happened. The PreToolUse proof-gate then
reads this ledger to validate preconditions.

### proof-gate.js — The Single Enforcer

Replaces: `workflow-gate.js`, `team-leader-gate.js`, `enforcement-gate.js`

```
PreToolUse:Bash
  ├── git merge <work-branch>
  │   └── CHECK: proof-ledger has agent.spawned(qa-*) + message.sent(qa→leader, "PASS")
  │             for THIS specific task/branch
  │   └── BLOCK: "Merge blocked — no QA proof. QA agent must send PASS to team leader."
  │   └── RECOVER: "Spawn a QA agent to review this branch."
  │
  ├── /track qa.passed
  │   └── CHECK: proof-ledger has agent.spawned(qa-*) for this task
  │   └── CHECK: proof-ledger has message.sent(qa→leader) containing "PASS"
  │   └── BLOCK: "Cannot emit qa.passed — no QA agent ran for this task."
  │   └── RECOVER: "Spawn a QA agent first."
  │
  ├── /track guardian-passed
  │   └── CHECK: proof-ledger has agent.spawned(guardian)
  │   └── CHECK: proof-ledger has message.sent(guardian→leader) containing "PASS"
  │   └── BLOCK: "Cannot emit guardian-passed — no Guardian agent ran."
  │
  ├── /track session.start (if already active)
  │   └── CHECK: no active session for this feature
  │   └── BLOCK: "Session already active. Use /resume."
  │
  ├── git worktree (path references)
  │   └── ALLOW: git worktree add/remove/list/prune
  │   └── BLOCK: other worktree path references (polling prevention)
  │
  ├── destructive git commands
  │   └── BLOCK: git push --force, git reset --hard, git branch -D on protected
  │
  └── state file writes (events.jsonl, workflow-state.json, proof-ledger.jsonl)
      └── BLOCK: direct writes to tracking files

PreToolUse:Edit/Write
  ├── state file protection (events.jsonl, workflow-state.json, proof-ledger.jsonl)
  │   └── BLOCK: always
  │
  └── app code writes during active workflow
      ├── On work/* branch or worktree-agent-* or claude/* → ALLOW (coding agent)
      ├── On feature/* branch, file is in progressDir or .claude/tracking → ALLOW
      └── On feature/* branch, file is app code → BLOCK
          └── RECOVER: "Team Leader cannot write app code. Spawn a coding agent."

PreToolUse:Agent
  └── (no blocking — but proof-ledger.js PostToolUse records every spawn)

PreToolUse:SendMessage
  ├── shutdown_request before guardian proof exists
  │   ├── Target is coder-task-*/qa-task-* AND task is merged → ALLOW (per-task cleanup)
  │   └── Otherwise → BLOCK: "Shutdown blocked — Guardian must pass first."
  │
  └── (all other messages → ALLOW)
```

### proof-ledger.js — The Proof Collector

```
PostToolUse:Agent
  └── RECORD: {type: "agent.spawned", agent: <name>, model: <model>, team: <team>}

PostToolUse:SendMessage
  └── IF message contains "QA PASS" or "PASS" from a qa-* agent:
      RECORD: {type: "qa.verdict", agent: <from>, task: <task>, verdict: "pass"}
  └── IF message contains "FAIL" from a qa-* agent:
      RECORD: {type: "qa.verdict", agent: <from>, task: <task>, verdict: "fail"}
  └── IF message contains "PASS" from guardian:
      RECORD: {type: "guardian.verdict", verdict: "pass"}

PostToolUse:Bash
  └── IF command was `git worktree add`:
      RECORD: {type: "worktree.created", path: <path>, branch: <branch>}
  └── IF command was `git merge`:
      RECORD: {type: "branch.merged", branch: <branch>}
  └── IF command was `git worktree remove`:
      RECORD: {type: "worktree.removed", path: <path>}
```

### teammate-quality.js — TeammateIdle Quality Gate

Replaces `quality-gate.js` (which was a Stop hook that couldn't actually block).

```
TeammateIdle:
  ├── Detect branch (git branch --show-current)
  ├── If on work/* branch (coding agent):
  │   ├── Run lint (if available)
  │   ├── Run typecheck (if available)
  │   ├── Run tests (if available)
  │   ├── If ANY fail → exit 2 with stderr: "Fix before completing: <failures>"
  │   │   (This REJECTS idle — teammate keeps working)
  │   └── If all pass → exit 0 (teammate goes idle normally)
  │
  └── If not on work/* branch → exit 0 (not a coding agent, allow idle)
```

**Why this is better than the Stop hook:**
- Stop hook: writes to stderr but cannot prevent the agent from stopping
- TeammateIdle: exit code 2 **actually prevents the agent from going idle** and injects feedback

### task-validator.js — TaskCompleted Quality Gate

```
TaskCompleted:
  ├── Read task description from ~/.claude/tasks/{team}/{task-id}.json
  ├── Extract file scope from task description
  ├── Check that modified files match scope (git diff --name-only)
  ├── If files outside scope were modified → exit 2: "Modified files outside scope: <list>"
  ├── Check that acceptance criteria keywords appear in git diff
  └── If checks fail → exit 2 (task stays in-progress, feedback sent)
```

---

## Workflow Phases (v3)

### Phase 1: SETUP

```markdown
## Phase 1: Setup & Initialize

> MANDATORY: Execute every step. Do not skip, combine, or abbreviate.

### 1.1 Validate Environment
- [ ] Confirm git repo (git rev-parse --git-dir)
- [ ] Detect primary branch
- [ ] Detect current branch → classify scenario (on-feature / on-base / wrong-branch)
- [ ] Read .claude/workflow.json (or apply defaults)
- [ ] Verify plugin files exist (hooks, prompts, agents)

### 1.2 Establish Feature Branch
- [ ] If on-feature: adopt current branch
- [ ] If on-base: create feature/<name> from base
- [ ] If wrong-branch: checkout base, create feature/<name>

### 1.3 Initialize Tracking
- [ ] mkdir -p .claude/progress/<feature>
- [ ] Emit session.start via /track
- [ ] Verify workflow-state.json was created

### 1.4 Verify Phase 1
Iterate through 1.1–1.3 and confirm each checkbox. If any unchecked, go back.
```

**What changed from v2:**
- 11 sub-steps → 4 groups. No 1.0a-1.0f pre-flight audit (if a file is missing, we find out when we need it)
- No Agent Teams capability check here (checked in Phase 2 when we actually need it)
- No TEAM_LEADER_NAME confusion (resolved in Phase 3 after TeamCreate)

### Phase 2: PLAN

```markdown
## Phase 2: Plan & Decompose

### 2.1 Load Context
- [ ] Read project rules file
- [ ] Read architecture file (if exists)
- [ ] Read design doc from /new-plan (if exists)
- [ ] Read PHASE-GATE-PROTOCOL.md
- [ ] Read WORKFLOW-MODES.md

### 2.2 Decompose into Tasks
- [ ] Each task: one agent, scoped files, acceptance criteria
- [ ] No file overlap between tasks
- [ ] Map dependencies
- [ ] Plan waves (dependency layers)
- [ ] Record TOTAL_WAVES

### 2.3 Emit plan.created
- [ ] /track plan.created "<summary>"
- [ ] Verify workflow-state.json shows phase: "setup"

### 2.4 Verify Phase 2
Iterate through 2.1–2.3 and confirm each checkbox. If any unchecked, go back.
```

### Phase 3: TEAM SETUP

```markdown
## Phase 3: Create Team & Tasks

### 3.1 Create Team
- [ ] TeamCreate with team_name: "<feature-name>"
- [ ] PROOF: ~/.claude/teams/<feature-name>/config.json exists

### 3.2 Create Tasks
- [ ] TaskCreate for each task with description + acceptance criteria
- [ ] TaskUpdate to set dependencies (addBlockedBy)
- [ ] PROOF: ~/.claude/tasks/<feature-name>/ contains task files

### 3.3 Emit setup-complete
- [ ] /track checkpoint "setup-complete"
- [ ] PROOF GATE will verify: team config exists + task files exist before allowing this

### 3.4 Read Spawn Templates
- [ ] Read AGENT-SPAWN-TEMPLATES.md (deferred until now)
- [ ] Read CONTEXT-BUDGET-GUIDE.md

### 3.5 Verify Phase 3
Iterate through 3.1–3.4 and confirm each checkbox. If any unchecked, go back.
```

### Phase 4: EXECUTE WAVES

```markdown
## Phase 4: Execute Waves

For each wave, in dependency order:

### 4a. Create Workbranches
- [ ] For each task in wave:
      git worktree add <worktreeDir>/<feature>/<task> -b work/<feature>/<task>
- [ ] PROOF: worktree.created entries in proof-ledger.jsonl

### 4b. Spawn Agents
- [ ] For EACH task, spawn a coding agent:
      Agent(description: "coder-task-<N> ...", team_name: "<feature>",
            name: "coder-task-<N>", model: "sonnet", run_in_background: true)
- [ ] PROOF: agent.spawned entries in proof-ledger.jsonl (written by PostToolUse)
- [ ] Coding agent prompt includes:
      - Task description + acceptance criteria
      - Worktree path + branch name
      - "Message team leader when done. Do NOT emit tracking events."
      - Pre-digested rules from project rules + architecture

### 4c. Wait for Completion
- [ ] Wait for coding agent to message: "Task complete"
- [ ] Do NOT poll worktrees. Do NOT check worktree files. WAIT for messages.

### 4d. Spawn QA Agent
- [ ] For each completed task:
      Agent(description: "qa-task-<N> review", team_name: "<feature>",
            name: "qa-task-<N>", model: "sonnet", run_in_background: true)
- [ ] QA agent prompt includes:
      - Branch to review: work/<feature>/<task>
      - Acceptance criteria to verify
      - "Run tests. Review code. Message team leader with PASS or FAIL."
      - "On FAIL: include specific fix instructions."
- [ ] PROOF: agent.spawned(qa-task-N) in proof-ledger.jsonl

### 4e. Handle QA Result
- [ ] Wait for QA agent message
- [ ] On QA PASS:
      - /track qa.passed (PROOF GATE validates: qa agent spawned + sent PASS message)
      - Merge: git merge --no-ff work/<feature>/<task>
      - /track branch.merged
      - Shutdown coder + QA agents
      - Remove worktree + delete workbranch
- [ ] On QA FAIL (round < 3):
      - Forward failure details to coding agent via SendMessage
      - Wait for coder to fix + message "Fixed, re-review"
      - Spawn NEW QA agent for re-review (fresh eyes)
      - Repeat 4e
- [ ] On QA ESCALATION (3 fails):
      - /track qa.failed
      - Inform user with full QA history
      - Ask: manual fix / skip QA / abort

### 4f. Wave Fence
- [ ] After all tasks in wave merged:
      - Strict: lint + typecheck + test + build
      - Standard: lint only
      - Fast: skip
- [ ] /track checkpoint "wave-N-complete"
- [ ] If more waves: create next wave worktrees, goto 4b
- [ ] If last wave: /track checkpoint "all-waves-complete"

### 4g. Verify Wave (per wave)
- [ ] All tasks QA-passed (proof-ledger has qa.verdict pass for each)
- [ ] All branches merged (git branch --list work/<feature>/* returns empty)
- [ ] All worktrees removed
- [ ] Wave checkpoint emitted
```

### Phase 5: GUARDIAN + FINALIZE

```markdown
## Phase 5: Guardian & Finalize

### 5a. Spawn Guardian
- [ ] Agent(description: "guardian structural check", team_name: "<feature>",
            name: "guardian", model: "sonnet", run_in_background: true)
- [ ] PROOF: agent.spawned(guardian) in proof-ledger.jsonl
- [ ] Wait for Guardian message

### 5b. Handle Guardian Result
- [ ] On PASS:
      - /track checkpoint "guardian-passed"
        (PROOF GATE validates: guardian spawned + sent PASS)
- [ ] On FAIL:
      - Fix issues via new coding agent on workbranch
      - Re-run Guardian

### 5c. Final Verification
- [ ] Run full verification suite (lint, typecheck, test, build)
- [ ] All must pass

### 5d. Cleanup
- [ ] Shutdown all remaining agents (SendMessage shutdown_request)
- [ ] /track session.end
- [ ] TeamDelete
- [ ] Remove any remaining worktrees

### 5e. Verify Phase 5
- [ ] Guardian passed (proof-ledger has guardian.verdict pass)
- [ ] Verification suite passed
- [ ] All agents shut down
- [ ] Team deleted
- [ ] No stale worktrees
```

---

## Communication Model: Hub-and-Spoke (Corrected)

The v2 "agent pair" model is abandoned. Research confirms:
- Teammates CANNOT spawn other teammates
- The lead doesn't see full peer-to-peer conversations
- Worktree sharing between agents doesn't work reliably

```
                    Team Leader (user session)
                           │
              ┌────────────┼────────────┐
              │            │            │
         coder-task-1  qa-task-1   guardian
         (worktree)    (worktree)  (feature branch)

Flow per task:
  Leader spawns coder → coder works → coder messages leader "done"
  Leader spawns QA → QA reviews branch → QA messages leader "PASS/FAIL"
  If FAIL: leader messages coder "fix: ..." → coder fixes → new QA spawned
  If PASS: leader merges, shuts down both
```

**Why sequential (not parallel) code→QA:**
1. QA needs to see committed code, not in-progress writes
2. The coding agent commits before going idle (teammate-quality.js ensures lint/test pass)
3. QA agent checks out the committed branch in its own worktree
4. No shared filesystem, no race conditions, no worktree access issues

**Why the team leader relays (not agent pairs):**
1. Team leader MUST emit tracking events — it's the only one that can
2. Proof-gate validates that events match proof — leader is in the loop naturally
3. Agent pairs require peer-to-peer messaging which the lead can't observe
4. Recovery from dead agents is trivial (leader spawns replacement)

---

## How Proof-Gate Prevents Each Exploit

### Exploit 1: Team leader writes code itself
**Block:** Edit/Write on feature branch for non-progress files → BLOCKED
**Recovery message:** "Team Leader cannot write app code. Spawn a coding agent."

### Exploit 2: Team leader emits qa.passed without QA agent
**Block:** /track qa.passed → proof-gate checks proof-ledger for agent.spawned(qa-*) AND qa.verdict(pass) for this task → NOT FOUND → BLOCKED
**Recovery message:** "No QA proof for this task. Spawn a QA agent first."

### Exploit 3: Team leader emits guardian-passed without Guardian
**Block:** /track guardian-passed → proof-gate checks proof-ledger for agent.spawned(guardian) AND guardian.verdict(pass) → NOT FOUND → BLOCKED
**Recovery message:** "No Guardian proof. Spawn a Guardian agent first."

### Exploit 4: Team leader merges without QA
**Block:** git merge work/* → proof-gate checks proof-ledger for qa.verdict(pass) for this branch → NOT FOUND → BLOCKED
**Recovery message:** "Merge blocked — no QA pass for this branch."

### Exploit 5: Team leader shuts down agents prematurely
**Block:** shutdown_request → proof-gate checks proof-ledger for guardian.verdict(pass) → NOT FOUND → BLOCKED (except per-task shutdown after merge)
**Recovery message:** "Cannot shutdown — Guardian must pass first."

### Exploit 6: Team leader skips to session.end
**Block:** /track session.end → proof-gate checks: all task branches merged + guardian.verdict exists → NOT MET → BLOCKED
**Recovery message:** "Cannot end session — N tasks unmerged, Guardian hasn't run."

### Exploit 7: Team leader forges proof-ledger entries
**Block:** Edit/Write to proof-ledger.jsonl → BLOCKED (same as events.jsonl protection)
**Block:** Bash write to proof-ledger.jsonl → BLOCKED (state file write patterns)
**The only writer is proof-ledger.js PostToolUse hook — outside the LLM.**

---

## What This Means for Gate Count

```
v2 (current):                          v3 (proposed):
6 gate files                           4 hook files
  safety-guard.js     (PreToolUse)       safety-guard.js    (PreToolUse) — keep
  config-guard.js     (PreToolUse)       proof-gate.js      (PreToolUse) — NEW, replaces 3 files
  workflow-gate.js    (PreToolUse)       proof-ledger.js    (PostToolUse) — NEW
  team-leader-gate.js (PreToolUse)       teammate-quality.js (TeammateIdle) — NEW
  enforcement-gate.js (PreToolUse)     + keep: config-guard.js, session-start.js, tracking-emitter.js
  quality-gate.js     (Stop)

PreToolUse hooks per Bash call:        PreToolUse hooks per Bash call:
  safety-guard    → spawns Node         safety-guard  → spawns Node
  team-leader-gate → spawns Node        proof-gate    → spawns Node
  enforcement-gate → spawns Node        (2 processes, not 3)
  (3 processes)

File reads per hook invocation:        File reads per hook invocation:
  workflow.json (each hook)              workflow.json (once per hook)
  git branch (each hook)                 proof-ledger.jsonl (proof-gate only)
  events.jsonl (some hooks)              (no events.jsonl parsing in hot path)
  workflow-state.json (each hook)
  (12-15 reads per Bash call)            (3-4 reads per Bash call)
```

---

## Migration from v2

| v2 File | Action | v3 Replacement |
|---------|--------|----------------|
| `safety-guard.js` | **Keep** | Same |
| `config-guard.js` | **Keep** | Same |
| `workflow-gate.js` | **Delete** | Absorbed into proof-gate.js |
| `team-leader-gate.js` | **Delete** | Absorbed into proof-gate.js |
| `enforcement-gate.js` | **Delete** | Absorbed into proof-gate.js |
| `quality-gate.js` | **Delete** | Replaced by teammate-quality.js (TeammateIdle) |
| `tracker.js` | **Simplify** | Remove FSM phase logic, keep event append |
| `tracking.js` | **Keep** | Same |
| `tracking-emitter.js` | **Keep** | Same |
| `config.js` | **Simplify** | Remove getActiveFeature heuristic, remove v1 migration |
| `hooks.json` | **Rewrite** | New hook registrations |
| `commands/new-feature.md` | **Rewrite** | 5 phases with checklists |
| `AGENT-SPAWN-TEMPLATES.md` | **Simplify** | Remove marker requirements, add proof-aware instructions |
| — | **New** | `proof-gate.js` |
| — | **New** | `proof-ledger.js` |
| — | **New** | `teammate-quality.js` |
| — | **New** | `task-validator.js` (optional) |

---

## Key Differences from v2 and from the Earlier v3 Proposal

| Aspect | v2 (current) | v3-draft (earlier proposal) | v3-final (this doc) |
|--------|-------------|---------------------------|---------------------|
| Trust model | Distrust lead, depend on lead | Trust lead | **Distrust lead, prove everything** |
| Gate philosophy | Check events | Remove most gates | **Check proof artifacts** |
| QA validation | qa.passed event exists | None (trust lead) | **QA agent spawned + QA sent PASS message** |
| Quality enforcement | Stop hook (can't block) | TeammateIdle hook | **TeammateIdle hook** (confirmed works) |
| State transitions | LLM emits events | LLM emits events (fewer) | **LLM emits events, hooks validate proof before allowing** |
| Recovery | Permanent deadlock | Manual override | **Every block includes recovery action** |
| Gate count | 6 | 2 | **4** (but only 2 in hot path) |
| Proof of agent work | None | None | **proof-ledger.jsonl (PostToolUse)** |

---

## Why This Works

1. **PostToolUse hooks are unforgeable.** They fire AFTER the tool succeeds. The LLM cannot
   prevent the proof-ledger from recording that an agent was spawned. The LLM cannot inject
   false entries because direct writes to the ledger are blocked by proof-gate.

2. **PreToolUse proof validation is deterministic.** The proof-gate reads the ledger and
   checks for specific entries. No heuristics, no `getActiveFeature()` scanning, no v1
   migration logic. Either the proof exists or it doesn't.

3. **TeammateIdle actually blocks.** Unlike the Stop hook (which can only warn), TeammateIdle
   with exit code 2 prevents the agent from going idle and injects feedback. The agent MUST
   address the feedback before it can stop working.

4. **Recovery is always possible.** Every block message includes the specific action needed
   to unblock. No permanent deadlocks. If the user wants to override, they set
   `guards.proofGate: false` in workflow.json — one toggle, not six.

5. **Claude can't cheat.** The exploit chain is broken at every step:
   - Can't write code itself → Edit/Write blocked on feature branch
   - Can't fake QA → qa.passed requires proof of QA agent + QA PASS message
   - Can't fake Guardian → guardian-passed requires proof of Guardian agent + PASS message
   - Can't fake merges → merge requires proof of QA pass
   - Can't forge the ledger → direct writes blocked, only PostToolUse can append

---

## Sources

- [Official Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Official Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Reverse-Engineering Agent Teams](https://dev.to/nwyin/reverse-engineering-claude-code-agent-teams-architecture-and-protocol-o49)
- [AgentSpec: Runtime Enforcement](https://arxiv.org/abs/2503.18666) — ICSE 2026
- [AgentIF: Instruction Following Benchmark](https://arxiv.org/abs/2505.16944) — NeurIPS 2025
- [AWS: Guardrails LLMs Cannot Bypass](https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d)
- [Apple: Do LLMs Know When They Follow Instructions?](https://machinelearning.apple.com/research/do-llms-know-internally)
- [Anthropic: Building a C Compiler with Agent Teams](https://www.anthropic.com/engineering/building-c-compiler)
- [Multi-Agent Failure Taxonomy](https://arxiv.org/abs/2503.13657) — ICLR 2025
- [GitHub #24129: Claude ignores instructions](https://github.com/anthropics/claude-code/issues/24129)
- [GitHub #32731: Teammate tool restrictions](https://github.com/anthropics/claude-code/issues/32731)
- [GitHub #4362: Hook blocking format](https://github.com/anthropics/claude-code/issues/4362)
