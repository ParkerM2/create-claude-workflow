#!/usr/bin/env node
'use strict';

// PreToolUse hook: Proof-of-Work Gate (v3)
// The SINGLE enforcement gate that replaces workflow-gate.js, team-leader-gate.js,
// and enforcement-gate.js. Validates PROOF ARTIFACTS before allowing state transitions.
//
// Proof comes from proof-ledger.jsonl (written by PostToolUse hook — unforgeable)
// and from team inbox files (written by agents via SendMessage — unforgeable).
//
// Registered for: Bash, Edit, Write, Read, Glob, Grep, SendMessage, TaskStop,
//                 TeamCreate, TeamDelete, EnterWorktree, Agent/Task
//
// Respects guards.proofGate setting (single toggle replaces 3 separate guards).
//
// KEY DESIGN: Every block includes a RECOVERY action telling Claude what to do next.
// No permanent deadlocks — every stuck state has an escape path.

const fs = require('fs');
const path = require('path');
const {
  getGuardsConfig,
  getActiveFeature,
  getWorkflowState,
  getWorkflowConfig,
  getRepoRoot,
  getBranchingConfig,
  isWorkBranch,
  isProtectedBranch
} = require('./config.js');

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function allow() {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow'
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function passThrough() {
  // No opinion — let Claude Code's default permission system handle it
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Proof ledger reader
// ---------------------------------------------------------------------------

function readProofLedger(feature) {
  try {
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const ledgerPath = path.join(getRepoRoot(), progressDir, feature, 'proof-ledger.jsonl');

    if (!fs.existsSync(ledgerPath)) return [];

    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Check if a QA agent was spawned for a specific task.
 * Looks for agent.spawned entries where agent name matches qa-task-<N> pattern.
 */
function hasQaAgentSpawned(ledger, taskIdentifier) {
  return ledger.some(e =>
    e.type === 'agent.spawned' &&
    e.agent &&
    /^qa[-_]?task[-_]?/i.test(e.agent) &&
    (taskIdentifier ? e.agent.includes(taskIdentifier) : true)
  );
}

/**
 * Check if a Guardian agent was spawned.
 */
function hasGuardianSpawned(ledger) {
  return ledger.some(e =>
    e.type === 'agent.spawned' &&
    e.agent &&
    /guardian/i.test(e.agent)
  );
}

/**
 * Check team inbox for a QA PASS message for a specific task.
 * QA agents send their verdicts via SendMessage — these land in the team leader's inbox.
 * We check the team directories for inbox files containing QA PASS messages.
 */
function hasQaPassInInbox(feature, taskIdentifier) {
  try {
    // Check events.jsonl for qa.passed events (emitted by /track after QA agent messages)
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const eventsPath = path.join(getRepoRoot(), progressDir, feature, 'events.jsonl');

    if (!fs.existsSync(eventsPath)) return false;

    const raw = fs.readFileSync(eventsPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        if (evt.type === 'qa.passed' && evt.data) {
          const taskRef = String(evt.data.task || evt.data.branch || '');
          if (!taskIdentifier || taskRef.includes(taskIdentifier)) {
            return true;
          }
        }
      } catch { /* skip */ }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a Guardian PASS exists in events.
 */
function hasGuardianPassInEvents(feature) {
  try {
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const eventsPath = path.join(getRepoRoot(), progressDir, feature, 'events.jsonl');

    if (!fs.existsSync(eventsPath)) return false;

    const raw = fs.readFileSync(eventsPath, 'utf8');
    return raw.includes('"guardian-passed"');
  } catch {
    return false;
  }
}

/**
 * Extract task identifier from a branch name.
 * work/feature-name/task-1 → "task-1" or "1"
 */
function extractTaskFromBranch(branch) {
  const parts = branch.split('/');
  if (parts.length >= 3) {
    return parts.slice(2).join('/');
  }
  return branch;
}

// ---------------------------------------------------------------------------
// Gate checks
// ---------------------------------------------------------------------------

/**
 * STATE FILE PROTECTION (fail-CLOSED — always active, ignores guard toggle)
 * Blocks direct writes to events.jsonl, workflow-state.json, proof-ledger.jsonl
 */
function checkStateFileProtection(toolName, toolInput) {
  if (toolName === 'Edit' || toolName === 'Write') {
    const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
    if (/events\.jsonl$/i.test(filePath) ||
        /workflow-state\.json$/i.test(filePath) ||
        /proof-ledger\.jsonl$/i.test(filePath)) {
      deny('State file protection: Direct modification of tracking files is blocked. Use /claude-workflow:track to emit events.');
    }
  }

  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    const patterns = [
      /[>|].*?events\.jsonl/,
      /[>|].*?workflow-state\.json/,
      /[>|].*?proof-ledger\.jsonl/,
      /\b(cp|mv|rm)\b.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl)/,
      /\bsed\s+-i.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl)/,
      /\btee\b.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl)/,
    ];
    for (const p of patterns) {
      if (p.test(command)) {
        deny('State file protection: Writing to tracking files via Bash is blocked. Use /claude-workflow:track.');
      }
    }
  }
}

/**
 * APP CODE WRITE BLOCK — Team Leader cannot write app code during active workflow.
 * Coding agents on work branches are allowed.
 * Progress/tracking files are explicitly ALLOWED (with permissionDecision: allow).
 */
function checkAppCodeWriteBlock(toolInput, feature) {
  const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
  if (!filePath) return;

  const state = getWorkflowState(feature);
  if (!state || !state.phase || state.phase === 'done') return;

  // Check if on a work branch (coding agent context) — always allow
  try {
    const { execSync } = require('child_process');
    const branch = execSync('git branch --show-current', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    const branchConfig = getBranchingConfig();
    if (isWorkBranch(branch, branchConfig)) {
      allow(); // Coding agent — explicitly allow, skip permission prompt
      return;
    }
  } catch { /* branch detection failed — continue */ }

  const config = getWorkflowConfig();
  const progressDir = (config.progressDir || '.claude/progress').replace(/\\/g, '/');

  // Progress files and tracking files — explicitly ALLOW (fixes permission prompt bug)
  if (filePath.includes(progressDir) ||
      filePath.includes('.claude/tracking') ||
      filePath.includes('.claude/workflow.json')) {
    allow(); // Explicitly allow — suppresses permission prompt
    return;
  }

  // Everything else is app code — block team leader from writing it
  deny('Team Leader cannot write application code during active workflow. Spawn a coding agent for this task. Recovery: Use the Agent tool to spawn a coder-task-N agent.');
}

/**
 * MERGE GATE — requires QA proof before allowing git merge on work branches.
 */
function checkMergeGate(command, feature) {
  if (!/\bgit\b.*\bmerge\b/i.test(command)) return;

  const config = getWorkflowConfig();
  const workPrefix = (config.branching && config.branching.workPrefix) || 'work';

  // Extract work branch being merged
  const branchRegex = new RegExp('\\b(' + workPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/[^\\s]+)');
  const branchMatch = command.match(branchRegex);
  if (!branchMatch) return; // Not merging a work branch

  const mergingBranch = branchMatch[1];
  const taskSlug = extractTaskFromBranch(mergingBranch);

  // Read proof ledger
  const ledger = readProofLedger(feature);

  // Check 1: A QA agent must have been spawned for this task
  const taskNum = taskSlug.match(/(\d+)/);
  const taskId = taskNum ? taskNum[1] : taskSlug;

  if (!hasQaAgentSpawned(ledger, taskId)) {
    deny(`Merge blocked: No QA agent was spawned for task ${taskId}. Recovery: Spawn a QA agent with name "qa-task-${taskId}" to review branch "${mergingBranch}".`);
  }

  // Check 2: qa.passed event must exist for this task (emitted after QA agent sends PASS)
  if (!hasQaPassInInbox(feature, taskId) && !hasQaPassInInbox(feature, mergingBranch)) {
    deny(`Merge blocked: No qa.passed event for task ${taskId} / branch "${mergingBranch}". Recovery: Wait for the QA agent to send QA PASS, then emit /claude-workflow:track qa.passed.`);
  }
}

/**
 * TRACK COMMAND GATE — validates preconditions for /track event emissions.
 * Prevents the team leader from emitting qa.passed, guardian-passed without proof.
 */
function checkTrackGate(command, feature) {
  // Match /track or /claude-workflow:track commands
  if (!/\btrack\b/i.test(command)) return;

  const ledger = readProofLedger(feature);

  // Block qa.passed without QA agent proof
  if (/\bqa\.passed\b/i.test(command)) {
    // Extract task number from command
    const taskMatch = command.match(/--task\s+(\S+)/);
    const taskId = taskMatch ? taskMatch[1] : null;

    if (!hasQaAgentSpawned(ledger, taskId)) {
      deny(`Cannot emit qa.passed: No QA agent was spawned${taskId ? ' for task ' + taskId : ''}. Recovery: Spawn a QA agent first, wait for it to review the code and send PASS.`);
    }
  }

  // Block guardian-passed without Guardian agent proof
  if (/guardian[-_]?passed/i.test(command)) {
    if (!hasGuardianSpawned(ledger)) {
      deny('Cannot emit guardian-passed: No Guardian agent was spawned. Recovery: Spawn a Guardian agent to perform structural integrity checks.');
    }
  }
}

/**
 * SHUTDOWN GATE — blocks premature agent shutdowns.
 */
function checkShutdownGate(toolInput, feature) {
  const msg = toolInput.message;
  if (!msg || typeof msg !== 'object' || msg.type !== 'shutdown_request') return;

  const state = getWorkflowState(feature);
  if (!state) return;

  // Always allow if guardian has passed
  if (state.guardianPassed) return;

  // Allow shutting down task-specific agents after their task is merged
  const recipient = toolInput.to || '';
  const taskAgentMatch = recipient.match(/^(?:coder|qa)[-_]?task[-_]?(\d+)$/);
  if (taskAgentMatch) {
    const taskNum = taskAgentMatch[1];
    // Check if this task has been merged (via events or proof ledger)
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const eventsPath = path.join(getRepoRoot(), progressDir, feature, 'events.jsonl');

    try {
      if (fs.existsSync(eventsPath)) {
        const raw = fs.readFileSync(eventsPath, 'utf8');
        if (raw.includes(`"task":"${taskNum}"`) && raw.includes('"branch.merged"')) {
          return; // Task merged — allow shutdown
        }
        // Also check by task-N pattern
        if (raw.includes(`"task-${taskNum}"`) && raw.includes('"branch.merged"')) {
          return;
        }
      }
    } catch { /* continue to block */ }
  }

  deny('Shutdown blocked: Cannot shut down agents before their task is merged or Guardian passes. Recovery: Complete the QA cycle, merge the task branch, then shut down.');
}

/**
 * WORKTREE POLLING BLOCK — prevents team leader from reading agent worktrees.
 */
function checkWorktreePolling(toolName, toolInput) {
  const config = getWorkflowConfig();
  const worktreeDir = ((config.branching && config.branching.worktreeDir) || '.worktrees').replace(/\\/g, '/');

  let pathsToCheck = [];

  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    // Allow worktree management commands
    if (/\bgit\s+worktree\s+(add|remove|list|prune)\b/.test(command)) return;
    if (/\brebase\b/.test(command)) return;
    // Allow git log, diff, status on worktrees (needed for merge prep)
    if (/\bgit\s+(log|diff|status|show)\b/.test(command)) return;

    if (command.includes(worktreeDir + '/') || command.includes(worktreeDir + '\\')) {
      deny('Worktree polling blocked: Do not inspect agent worktrees. Wait for agents to message you. Recovery: Check your inbox for messages from coding/QA agents.');
    }
    return;
  }

  // Read/Glob/Grep on worktree paths
  pathsToCheck = [
    (toolInput.file_path || '').replace(/\\/g, '/'),
    (toolInput.path || '').replace(/\\/g, '/'),
    (toolInput.pattern || '').replace(/\\/g, '/'),
  ];

  for (const p of pathsToCheck) {
    if (p && p.includes(worktreeDir + '/')) {
      deny('Worktree polling blocked: Do not read files in agent worktrees. Wait for agents to message you.');
    }
  }
}

/**
 * TEAM LIFECYCLE GATES
 */
function checkTeamCreateGate(feature) {
  const state = getWorkflowState(feature);
  if (!state || !state.phase) return;

  if (state.phase !== 'plan' && state.phase !== 'setup') {
    deny('TeamCreate blocked: Only allowed during plan/setup phase. Current phase: ' + state.phase + '. Recovery: If you need a new team, end the current session first.');
  }
}

function checkTeamDeleteGate(feature) {
  const state = getWorkflowState(feature);
  if (!state) return;

  if (!state.guardianPassed && state.phase !== 'done') {
    deny('TeamDelete blocked: Guardian must pass first. Recovery: Spawn and run the Codebase Guardian, then delete the team.');
  }
}

function checkEnterWorktreeGate(feature) {
  const state = getWorkflowState(feature);
  if (!state || !state.phase || state.phase === 'done') return;

  deny('EnterWorktree blocked: Team Leader must not enter worktrees directly. Recovery: Use "git worktree add" via Bash to create worktrees for agents.');
}

/**
 * TASKSTOP GATE — blocks TaskStop before Guardian passes
 */
function checkTaskStopGate(feature) {
  const state = getWorkflowState(feature);
  if (!state) return;
  if (state.guardianPassed) return;

  deny('TaskStop blocked: Cannot stop background agents before Guardian passes. Recovery: Let agents complete their work.');
}

// ---------------------------------------------------------------------------
// Main: read stdin, dispatch
// ---------------------------------------------------------------------------

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    passThrough();
    return;
  }

  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};

  // State file protection — ALWAYS active (fail-CLOSED), ignores guard toggle
  checkStateFileProtection(toolName, toolInput);

  // Check if proof gate is enabled
  const guards = getGuardsConfig();
  if (guards.proofGate === false) {
    passThrough();
    return;
  }

  // Get active feature — if none, not in a workflow
  const feature = getActiveFeature();
  if (!feature) {
    passThrough();
    return;
  }

  try {
    switch (toolName) {
      case 'Edit':
      case 'Write':
        checkAppCodeWriteBlock(toolInput, feature);
        break;

      case 'Bash':
        checkMergeGate(toolInput.command || '', feature);
        checkTrackGate(toolInput.command || '', feature);
        checkWorktreePolling(toolName, toolInput);
        break;

      case 'Read':
      case 'Glob':
      case 'Grep':
        checkWorktreePolling(toolName, toolInput);
        break;

      case 'SendMessage':
        checkShutdownGate(toolInput, feature);
        break;

      case 'TaskStop':
        checkTaskStopGate(feature);
        break;

      case 'TeamCreate':
        checkTeamCreateGate(feature);
        break;

      case 'TeamDelete':
        checkTeamDeleteGate(feature);
        break;

      case 'EnterWorktree':
        checkEnterWorktreeGate(feature);
        break;

      default:
        break;
    }
  } catch {
    // Fail-open for non-critical errors (state file protection already ran above)
    passThrough();
    return;
  }

  passThrough();
});
