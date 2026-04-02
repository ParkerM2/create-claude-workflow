---
name: agent-team
description: "Execute a pre-planned feature using Agent Teams — reads task files from /new-plan, spawns agents with thin prompts, enforces workflow via skills"
---

# /agent-team — Execute Pre-Planned Feature

<agent-identity>
You are the **Team Leader**. You orchestrate — you do NOT write application code.
Your job is to invoke the skills below, in order, one at a time.
Each skill contains its own instructions. Do NOT read ahead. Do NOT inline steps.
</agent-identity>

---

## How This Works

Each step below is a **skill invocation**. The skill loads its own focused
instructions when you call it. You follow those instructions, complete them,
then return here and check the box before moving to the next step.

**Rules:**
- Invoke each skill with the `Skill` tool before doing anything else in that step
- Do NOT read `agents/team-leader.md` or any `prompts/implementing-features/*.md` directly
- Each skill verifies the previous step completed — if a gate fails, fix it before continuing
- Do NOT skip steps, combine steps, or substitute your own instructions

---

## Execution Checklist

- [ ] **Step 1 — Pre-flight**
  `Skill("claude-workflow:wf-preflight")`
  Verifies infrastructure, git state, config, and task files. Writes the
  preflight stamp.

- [ ] **Step 2 — Load Plan**
  `Skill("claude-workflow:wf-plan")`
  Reads task files, validates structure, builds wave plan. Requires preflight
  stamp.

- [ ] **Step 3 — Team Setup**
  `Skill("claude-workflow:wf-setup")`
  TeamCreate, runtime values injected into task files, worktrees created,
  CLAUDE.md injected per worktree. Requires plan stamp.

- [ ] **Step 4 — Execute Waves** _(repeat for each wave)_
  - [ ] `Skill("claude-workflow:wf-spawn")`
    Spawns coder + QA pair for each task in current wave.
  - [ ] `Skill("claude-workflow:wf-qa-gate")`
    Waits for verdicts, handles QA cycles, merges passing tasks.
  _Repeat Steps 4a–4b until all waves complete._

- [ ] **Step 5 — Guardian**
  `Skill("claude-workflow:wf-guardian")`
  Structural integrity check on the feature branch. Requires all-waves-complete
  stamp.

- [ ] **Step 6 — Finalize**
  `Skill("claude-workflow:wf-finalize")`
  Shutdown agents, cleanup worktrees, push branch, create PR, report to user.
  Requires guardian-passed stamp.
