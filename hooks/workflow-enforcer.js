#!/usr/bin/env node
'use strict';

// PreToolUse hook: Consolidated Workflow Enforcer
// Replaces: proof-gate.js, config-guard.js, enforcement-gate.js,
//           team-leader-gate.js, workflow-gate.js
//
// Design principle: Check sentinel FIRST. If absent, skip all enforcement (exit 0).
// Every deny includes a RECOVERY action to prevent deadlocks.
//
// Registered for: Bash, Edit, Write, TaskStop, TeamDelete

const fs = require('fs');
const path = require('path');

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

// ---------------------------------------------------------------------------
// Sentinel helper — imported from config.js (single source of truth)
// ---------------------------------------------------------------------------

const { readSentinel } = require('./config.js');

// ---------------------------------------------------------------------------
// Exempt path check
// ---------------------------------------------------------------------------

function isExemptPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');

  // Always exempt: research, docs, progress (except tracking files), root .md files
  if (normalized.includes('research/')) return true;
  if (normalized.includes('.claude/docs/')) return true;
  if (normalized.includes('docs/')) return true;

  // Progress files are exempt EXCEPT tracking files
  if (normalized.includes('.claude/progress/') || normalized.includes('.claude/tracking/')) {
    if (/events\.jsonl$/i.test(normalized)) return false;
    if (/workflow-state\.json$/i.test(normalized)) return false;
    if (/proof-ledger\.jsonl$/i.test(normalized)) return false;
    return true;
  }

  // Root .md files
  if (/^[^/]*\.md$/i.test(normalized) || /\/[^/]*\.md$/i.test(normalized)) {
    // Only root-level .md files
    const parts = normalized.split('/');
    if (parts.length <= 2 && parts[parts.length - 1].endsWith('.md')) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Layer 0: Always Active (regardless of sentinel)
// ---------------------------------------------------------------------------

/**
 * State File Protection — blocks direct writes to tracking files.
 * Always active. Sentinel-independent.
 */
function checkStateFileProtection(toolName, toolInput) {
  if (toolName === 'Edit' || toolName === 'Write') {
    const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
    if (/events\.jsonl$/i.test(filePath) ||
        /workflow-state\.json$/i.test(filePath) ||
        /proof-ledger\.jsonl$/i.test(filePath) ||
        /\.workflow-active$/i.test(filePath)) {
      deny('State file protection: Direct modification of tracking files is blocked. Use /claude-workflow:track to emit events. Recovery: Use the /claude-workflow:track command instead.');
    }
  }

  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    const patterns = [
      />>?\s*\S*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl|\.workflow-active)/,
      /\b(cp|mv|rm)\b.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl|\.workflow-active)/,
      /\bsed\s+-i.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl|\.workflow-active)/,
      /\btee\b.*?(events\.jsonl|workflow-state\.json|proof-ledger\.jsonl|\.workflow-active)/,
    ];
    for (const p of patterns) {
      if (p.test(command)) {
        deny('State file protection: Writing to tracking files via Bash is blocked. Recovery: Use /claude-workflow:track.');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 1: Workflow-Active Only (sentinel present)
// ---------------------------------------------------------------------------

/**
 * Merge Gate — requires qa.passed before git merge on work branches.
 */
function checkMergeGate(command, sentinel) {
  if (!/\bgit\b.*\bmerge\b/i.test(command)) return;

  const workPrefix = 'work';
  const branchRegex = new RegExp('\\b(' + workPrefix + '\\/[^\\s]+)');
  const branchMatch = command.match(branchRegex);
  if (!branchMatch) return; // Not merging a work branch

  // Check for qa.passed event for this branch
  const mergingBranch = branchMatch[1];
  const ticket = sentinel.ticket;
  if (!ticket) return;

  try {
    const { getWorkflowConfig, getRepoRoot } = require('./config.js');
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const eventsPath = path.join(getRepoRoot(), progressDir, sentinel.feature, 'events.jsonl');

    if (!fs.existsSync(eventsPath)) {
      deny(`Merge blocked: No events file found. QA must pass before merging "${mergingBranch}". Recovery: Spawn QA agent for this branch.`);
      return;
    }

    const raw = fs.readFileSync(eventsPath, 'utf8');
    const hasQaPass = raw.split('\n').some(line => {
      try {
        const evt = JSON.parse(line);
        return evt.type === 'qa.passed' &&
               (String(evt.data?.branch || '').includes(mergingBranch) ||
                String(evt.data?.task || '').includes(mergingBranch));
      } catch { return false; }
    });

    if (!hasQaPass) {
      deny(`Merge blocked: No qa.passed event for "${mergingBranch}". Recovery: Wait for QA agent to send PASS, then emit /claude-workflow:track qa.passed.`);
    }
  } catch {
    // Fail open — allow merge if we can't check
  }
}

/**
 * Cherry-Pick Gate — blocks cherry-pick during wave/guardian phases.
 */
function checkCherryPickGate(command, sentinel) {
  if (!/\bgit\b.*\bcherry-pick\b/i.test(command)) return;

  try {
    const { getWorkflowState } = require('./config.js');
    const state = getWorkflowState(sentinel.feature);
    if (state && (state.phase === 'wave' || state.phase === 'guardian')) {
      deny('Cherry-pick blocked during active wave/guardian phase. Recovery: Wait for agents to complete their work.');
    }
  } catch {
    // Fail open
  }
}

/**
 * Fake Event Gate — blocks forged qa.passed emissions.
 */
function checkFakeEventGate(command, sentinel) {
  if (!/\btrack\b.*\bqa\.passed\b/i.test(command)) return;

  try {
    const { getWorkflowConfig, getRepoRoot } = require('./config.js');
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const ledgerPath = path.join(getRepoRoot(), progressDir, sentinel.feature, 'proof-ledger.jsonl');

    if (!fs.existsSync(ledgerPath)) {
      deny('Cannot emit qa.passed: No proof ledger found. Recovery: Spawn a QA agent first.');
      return;
    }

    // Extract task from command
    const taskMatch = command.match(/--task\s+(\S+)/);
    const taskId = taskMatch ? taskMatch[1] : null;

    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const hasQaSpawn = raw.split('\n').some(line => {
      try {
        const entry = JSON.parse(line);
        return entry.type === 'agent.spawned' &&
               entry.agent && /^qa[-_]?task/i.test(entry.agent) &&
               (!taskId || entry.agent.includes(taskId));
      } catch { return false; }
    });

    if (!hasQaSpawn) {
      deny(`Cannot emit qa.passed: No QA agent was spawned${taskId ? ' for task ' + taskId : ''}. Recovery: Spawn a QA agent first.`);
    }
  } catch {
    // Fail open
  }
}

/**
 * App Code Write Gate — blocks team-lead from writing app code during active workflow.
 * Coding agents on work branches are allowed.
 */
function checkAppCodeWriteGate(toolInput, sentinel) {
  const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
  if (!filePath) return;

  // Exempt paths are always allowed
  if (isExemptPath(filePath)) {
    allow();
    return;
  }

  // Check if on a work branch (coding agent) — always allow
  try {
    const { execSync } = require('child_process');
    const branch = execSync('git branch --show-current', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (branch.startsWith('work/') || /^(worktree-agent-|claude\/|agent-)/.test(branch)) {
      allow(); // Coding agent context
      return;
    }
  } catch { /* branch detection failed */ }

  // Progress/tracking/config files — explicitly allow
  if (filePath.includes('.claude/progress') ||
      filePath.includes('.claude/tracking') ||
      filePath.includes('.claude/workflow.json') ||
      filePath.includes('.claude/.workflow-active')) {
    allow();
    return;
  }

  // Team leader on feature/main branch writing app code — block
  deny('Team Leader cannot write application code during active workflow. Recovery: Spawn a coding agent for this task using the Agent tool.');
}

/**
 * Agent Kill Gate — blocks TaskStop unless task merged or Guardian passed.
 */
function checkAgentKillGate(sentinel) {
  try {
    const { getWorkflowState } = require('./config.js');
    const state = getWorkflowState(sentinel.feature);
    if (!state) return;
    if (state.guardianPassed) return; // Guardian passed — can stop anything

    // Allow stopping during done phase
    if (state.phase === 'done') return;

    // Block during active workflow
    deny('TaskStop blocked: Cannot stop agents before their work is merged or Guardian passes. Recovery: Wait for agent to complete, merge its branch, or run Guardian first.');
  } catch {
    // Fail open
  }
}

/**
 * Team Delete Gate — blocks TeamDelete unless Guardian passed.
 */
function checkTeamDeleteGate(sentinel) {
  try {
    const { getWorkflowState } = require('./config.js');
    const state = getWorkflowState(sentinel.feature);
    if (!state) return;

    if (!state.guardianPassed && state.phase !== 'done') {
      deny('TeamDelete blocked: Guardian must pass first. Recovery: Spawn the Codebase Guardian agent, then delete the team.');
    }
  } catch {
    // Fail open
  }
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
    allow();
    return;
  }

  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};

  // Layer 0: State file protection — ALWAYS active
  // State file protection fails CLOSED per research topic-3 section 7.7 — all other gates fail open
  try {
    checkStateFileProtection(toolName, toolInput);
  } catch (err) {
    deny('State file protection check failed — blocking for safety. Recovery: Check hooks/config.js and hooks/workflow-enforcer.js for errors.');
  }

  // Check sentinel — fast path: absent → allow everything
  const sentinel = readSentinel();
  if (!sentinel) {
    allow();
    return;
  }

  // Layer 1: Workflow-active enforcement
  switch (toolName) {
    case 'Bash': {
      const command = toolInput.command || '';
      checkMergeGate(command, sentinel);
      checkCherryPickGate(command, sentinel);
      checkFakeEventGate(command, sentinel);
      break;
    }
    case 'Edit':
    case 'Write':
      checkAppCodeWriteGate(toolInput, sentinel);
      break;
    case 'TaskStop':
      checkAgentKillGate(sentinel);
      break;
    case 'TeamDelete':
      checkTeamDeleteGate(sentinel);
      break;
    default:
      break;
  }

  // All gates passed
  allow();
});
