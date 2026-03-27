================================================================
STOP -- THIS FILE IS THE WORKFLOW STATE MACHINE (FSM v2)
Do NOT proceed past any phase without verifying conditions.
After context compaction, re-read this file and the state file at:
  .claude/progress/<feature>/workflow-state.json
================================================================

## State Schema

```json
{
  "feature": "<name>",
  "mode": "strict|standard|fast",
  "startedAt": "<ISO>",
  "phase": "plan|setup|wave|guardian|done",
  "setupComplete": true|false,
  "guardianPassed": true|false,
  "currentWave": 2,
  "totalWaves": 0,
  "waves": { "1": "complete", "2": "active" }
}
```

## State Transitions

All transitions are event-driven via `/claude-workflow:track`.

| Current Phase | Event / Checkpoint | Next Phase | Key State Changes |
|---|---|---|---|
| (none) | `session.start` | plan | Initialize all fields |
| plan | `plan.created` | setup | -- |
| setup | `checkpoint "setup-complete"` | wave | `setupComplete=true`, wave 1 active |
| wave | `checkpoint "wave-N-complete"` | wave | Wave N=complete, next wave active |
| wave | `checkpoint "all-waves-complete"` | guardian | -- |
| guardian | `checkpoint "guardian-passed"` | guardian | `guardianPassed=true` |
| any | `session.end` | done | -- |

## Phase Entry Conditions

**plan**: Session started. Read project rules, architecture, and PHASE-GATE-PROTOCOL.md.

**setup**: Written decomposition plan produced. Each task has agent role, file scope, acceptance criteria, QA checklist. Wave plan finalized.

**wave**: Feature branch created, team created, all tasks created with dependencies, `session.start` event emitted. `setupComplete` is true. Agents may now be spawned.

**guardian**: All waves complete. No open workbranches. Feature branch contains all merged work. Guardian agent may now be spawned.

**done**: Guardian passed, agents shut down, team deleted, `session.end` emitted.

## Hook Enforcement Summary

| Hook | Event Matchers | What It Enforces |
|------|---------------|-----------------|
| **workflow-enforcer.js** | Task | Phase gates (setupComplete, guardian phase), prompt content validation, agent classification hardening |
| **init-gate.js** | Bash, Edit, Write, Read, Glob, Grep, TeamCreate, TeamDelete, EnterWorktree | State file tamper protection, worktree read isolation, sequence gates, app code write block |
| **safety-guard.js** | Bash | Destructive command blocking, branch protection, merge-without-QA gate |
| **compact-reinject.js** | SessionStart (compact) | Re-injects this protocol and current state after context compaction |

## Checkpoints the Team Leader Must Emit

| When | Command |
|------|---------|
| Plan finalized | `/claude-workflow:track plan.created "<summary>"` |
| Branch + team + tasks ready | `/claude-workflow:track checkpoint "setup-complete"` |
| Each wave merged | `/claude-workflow:track checkpoint "wave-N-complete"` |
| All waves done | `/claude-workflow:track checkpoint "all-waves-complete"` |
| Guardian passes | `/claude-workflow:track checkpoint "guardian-passed"` |
| Feature complete | `/claude-workflow:track session.end "Feature complete"` |
