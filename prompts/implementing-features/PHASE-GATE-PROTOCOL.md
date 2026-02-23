═══════════════════════════════════════════════════════════════
STOP — THIS FILE IS THE WORKFLOW STATE MACHINE
Do NOT proceed past any gate without verifying ALL conditions.
After context compaction, re-read this file and the state file at:
  .claude/progress/<feature>/workflow-state.json
═══════════════════════════════════════════════════════════════

State keys map to: `.claude/progress/<feature>/workflow-state.json`

---

## GATE 1: Context Loaded
Prereq: none
- [ ] Project rules file read
- [ ] Architecture file read
- [ ] `prompts/implementing-features/README.md` read
- [ ] Workflow mode resolved (strict/standard/fast) and recorded
- [ ] Branching config read from `<workflow-config>` (baseBranch, featurePrefix, workPrefix, worktreeDir)
State key: `"1_context_loaded": true`
Next: `WORKFLOW-MODES.md` for mode definitions, `PRE-FLIGHT-CHECKS.md` if strict mode

## GATE 2: Plan Complete
Prereq: Gate 1
- [ ] Written decomposition plan produced (feature summary, rules cited, task list)
- [ ] Each task has: agent role, file scope, acceptance criteria, QA checklist
- [ ] Dependency map defined (which tasks block which)
- [ ] Wave plan finalized (tasks grouped by dependency layer)
- [ ] Context budget checked per task (`8,000 + files × 1,000 + 3,000`)
State key: `"2_plan_complete": true`
Next: `AGENT-SPAWN-TEMPLATES.md`, `QA-CHECKLIST-AUTO-FILL-RULES.md`, `CONTEXT-BUDGET-GUIDE.md`

## GATE 3: Branch + Team Ready
Prereq: Gate 2
- [ ] Feature branch created from configured base branch
- [ ] `TeamCreate` called with feature name
- [ ] `TaskCreate` called for ALL tasks with full descriptions and blockedBy dependencies
- [ ] Progress file initialized: `.claude/progress/<feature>/events.jsonl` exists
- [ ] `session.start` event emitted via `/track`
State key: `"3_branch_team_ready": true`
Next: `PROGRESS-FILE-TEMPLATE.md` for progress file format

## GATE 4: Wave N Spawned
Prereq: Gate 3 (Wave 1) or Gate 6 from previous wave (Wave 2+)
- [ ] Previous wave's fence check passed (skip for Wave 1)
- [ ] Worktrees created from current `<featurePrefix>/` HEAD for each task in wave
- [ ] Each agent spawned using FULL template from `AGENT-SPAWN-TEMPLATES.md` (no minimal prompts)
- [ ] Context budget verified before each spawn; oversized tasks split
- [ ] Agents spawned with `run_in_background: true`
State key: `"4_wave_N_spawned": true`
Next: `AGENT-SPAWN-TEMPLATES.md` for full spawn template, `CONTEXT-BUDGET-GUIDE.md`

## GATE 5: Wave N QA Complete
Prereq: Gate 4 (same wave)
- [ ] All coding agents in wave reported work complete and committed
- [ ] All QA agents in wave reported QA PASS (max rounds per mode: strict=3, standard=2, fast=1)
- [ ] QA doc updates committed on each workbranch
- [ ] No task stuck at QA FAIL after max rounds (escalate to user if so)
State key: `"5_wave_N_qa_complete": true`
Next: `QA-CHECKLIST-TEMPLATE.md` to review QA criteria if issues arise

## GATE 6: Wave N Merged
Prereq: Gate 5 (same wave)
- [ ] All workbranches rebased on `<featurePrefix>/` before merge
- [ ] All workbranches merged with `--no-ff` sequentially (one at a time)
- [ ] All worktrees removed and workbranches deleted
- [ ] Wave fence check passed per mode (strict=full verify, standard=lint, fast=skip)
State key: `"6_wave_N_merged": true`
Next: `WAVE-FENCE-PROTOCOL.md` for fence check procedure

## GATE 7: All Waves Complete
Prereq: Gate 6 for every wave
- [ ] Gate 4-5-6 cycle completed for every planned wave
- [ ] Wave status table shows all waves COMPLETE
- [ ] No open workbranches: `git branch --list "work/<feature>/*"` returns empty
- [ ] Feature branch contains all merged work and is stable
State key: `"7_all_waves_complete": true`
Next: `AGENT-SPAWN-TEMPLATES.md` Guardian section

## GATE 8: Guardian Passed
Prereq: Gate 7
- [ ] Codebase Guardian spawned on `<featurePrefix>/` branch
- [ ] Guardian completed all 7 structural integrity checks
- [ ] Guardian reported PASS (or trivial fixes committed and re-verified)
- [ ] Full verification run: lint, typecheck, test, build all pass
State key: `"8_guardian_passed": true`
Next: `AGENT-SPAWN-TEMPLATES.md` Visual QA section

## GATE 9: Feature Complete
Prereq: Gate 8
- [ ] Visual QA agent run (or user explicitly skipped)
- [ ] PR created with screenshots, verification checklist, and change summary
- [ ] All agents shut down via `shutdown_request`
- [ ] Team deleted via `TeamDelete`
- [ ] `session.end` event emitted via `/track session.end "Feature complete"`
State key: `"9_feature_complete": true`
Next: none — feature is done
