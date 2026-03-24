#!/usr/bin/env node
'use strict';

// PreToolUse hook: Consolidated enforcement gate.
// Closes V1 (state file tampering), V3 (worktree read access),
// V6 (TeamCreate/TeamDelete/EnterWorktree sequence gates),
// and V7 (app code writes during active workflow).
// Registered for: Bash, Edit, Write, Read, Glob, Grep, TeamCreate, TeamDelete, EnterWorktree
// Respects guards.enforcementGate setting.
// Fail-CLOSED for state file operations; fail-OPEN for all other errors.

const { getGuardsConfig, getActiveFeature, getWorkflowState, getWorkflowConfig, getBranchingConfig, isWorkBranch } = require('./config.js');

// ---------------------------------------------------------------------------
// Helper: block with reason
// ---------------------------------------------------------------------------

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Stdin handler
// ---------------------------------------------------------------------------

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    // Cannot parse input — fail-open
    process.exit(0);
  }

  // Check if enforcement gate is enabled
  const guards = getGuardsConfig();
  if (!guards.enforcementGate) {
    process.exit(0);
  }

  const toolName = data.tool_name || '';
  const toolInput = data.tool_input || {};

  // ---------------------------------------------------------------------------
  // V1: State file write protection — BEFORE try/catch (fail-CLOSED, always)
  // These blocks cannot be swallowed by catch.
  // ---------------------------------------------------------------------------

  if (toolName === 'Edit' || toolName === 'Write') {
    const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
    if (/events\.jsonl$/i.test(filePath) || /workflow-state\.json$/i.test(filePath)) {
      block('Enforcement gate: Direct modification of state files is blocked. Use /claude-workflow:track to emit events.');
    }
  }

  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    const STATE_WRITE_PATTERNS = [
      /[>|].*?events\.jsonl/,
      /[>|].*?workflow-state\.json/,
      /\b(cp|mv|rm)\b.*?events\.jsonl/,
      /\b(cp|mv|rm)\b.*?workflow-state\.json/,
      /\bsed\s+-i.*?events\.jsonl/,
      /\bsed\s+-i.*?workflow-state\.json/,
      /\btee\b.*?events\.jsonl/,
      /\btee\b.*?workflow-state\.json/,
    ];
    for (const pattern of STATE_WRITE_PATTERNS) {
      if (pattern.test(command)) {
        block('Enforcement gate: Writing to state files via Bash is blocked. Use /claude-workflow:track.');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Remaining dispatch — wrapped in try/catch (fail-open for non-critical errors)
  // ---------------------------------------------------------------------------

  try {
    switch (toolName) {
      case 'Edit':
      case 'Write':
        checkV7AppCodeWriteBlock(toolInput);
        break;

      case 'Read':
      case 'Glob':
      case 'Grep':
        checkV3WorktreeReadBlock(toolInput);
        break;

      case 'TeamCreate':
        checkV6TeamCreateGate();
        break;

      case 'TeamDelete':
        checkV6TeamDeleteGate();
        break;

      case 'EnterWorktree':
        checkV6EnterWorktreeGate();
        break;

      default:
        // Unknown tool — allow
        break;
    }
  } catch {
    // Fail-open for non-critical errors
    process.exit(0);
  }

  // All checks passed — allow
  process.exit(0);
});

// ---------------------------------------------------------------------------
// V7: Block Edit/Write to non-progress files during active workflow
// ---------------------------------------------------------------------------

function checkV7AppCodeWriteBlock(toolInput) {
  const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
  if (!filePath) return;

  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state || !state.phase || state.phase === 'done') return;

  // Coding agents work on work/ branches — allow their writes
  try {
    const { execSync } = require('child_process');
    const branch = execSync('git branch --show-current', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    const branchConfig = getBranchingConfig();
    if (isWorkBranch(branch, branchConfig)) return; // coding agent context — allow
  } catch { /* branch detection failed — continue with block check */ }

  const config = getWorkflowConfig();
  const progressDir = (config.progressDir || '.claude/progress').replace(/\\/g, '/');

  if (!filePath.includes(progressDir) && !filePath.includes('.claude/tracking')) {
    block('Enforcement gate: Team Leader cannot write files during active workflow. Assign work to coding agents.');
  }
}

// ---------------------------------------------------------------------------
// V3: Block Read/Glob/Grep on worktree paths
// ---------------------------------------------------------------------------

function checkV3WorktreeReadBlock(toolInput) {
  const config = getWorkflowConfig();
  const worktreeDir = ((config.branching && config.branching.worktreeDir) || '.worktrees').replace(/\\/g, '/');

  const checkPaths = [
    (toolInput.file_path || '').replace(/\\/g, '/'),
    (toolInput.path || '').replace(/\\/g, '/'),
    (toolInput.pattern || '').replace(/\\/g, '/'),
  ];

  for (const p of checkPaths) {
    if (p && p.includes(worktreeDir + '/')) {
      block('Enforcement gate: Reading worktree files is blocked. Wait for agents to message you.');
    }
  }
}

// ---------------------------------------------------------------------------
// V6: TeamCreate — only allowed during plan/setup phase
// ---------------------------------------------------------------------------

function checkV6TeamCreateGate() {
  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state || !state.phase) return;

  if (state.phase !== 'plan' && state.phase !== 'setup') {
    block('Enforcement gate: TeamCreate only allowed during plan/setup phase. Current phase: ' + state.phase);
  }
}

// ---------------------------------------------------------------------------
// V6: TeamDelete — require guardianPassed or done
// ---------------------------------------------------------------------------

function checkV6TeamDeleteGate() {
  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state) return;

  if (!state.guardianPassed && state.phase !== 'done') {
    block('Enforcement gate: TeamDelete blocked until Guardian passes.');
  }
}

// ---------------------------------------------------------------------------
// V6: EnterWorktree — always block during active workflow
// ---------------------------------------------------------------------------

function checkV6EnterWorktreeGate() {
  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state || !state.phase || state.phase === 'done') return;

  block('Enforcement gate: Team Leader must not enter worktrees directly. Use git worktree add.');
}
