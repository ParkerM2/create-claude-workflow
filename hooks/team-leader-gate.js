#!/usr/bin/env node
'use strict';

// PreToolUse hook: Team Leader behavioral enforcement.
// Blocks: merges without QA, premature shutdowns, worktree polling, agent kills,
//         worktree creation outside setup/wave phase.
// Registered for: Bash, SendMessage, TaskStop
// Respects guards.teamLeaderGate setting.
// Fail-open: any internal error = allow.

const { getGuardsConfig, getWorkflowState, getActiveFeature, getWorkflowConfig, getRepoRoot } = require('./config.js');
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Check if team leader gate is enabled
    const guards = getGuardsConfig();
    if (!guards.teamLeaderGate) {
      process.exit(0);
    }

    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};

    switch (toolName) {
      case 'Bash':
        checkMergeGate(toolInput.command || '');
        checkWorktreePollingGate(toolInput.command || '');
        checkWorktreeCreationGate(toolInput.command || '');
        break;
      case 'SendMessage':
        checkShutdownGate(toolInput);
        break;
      case 'TaskStop':
        checkTaskStopGate();
        break;
      default:
        // Unknown tool — allow
        break;
    }

    // All gates passed
    process.exit(0);
  } catch {
    // Fail open — any internal error = allow
    process.exit(0);
  }
});

// ---------------------------------------------------------------------------
// Helper: write a block decision and exit
// ---------------------------------------------------------------------------

function block(reason) {
  const result = { decision: 'block', reason };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate A: Merge Gate — block `git merge` on work/ branches without QA pass
// ---------------------------------------------------------------------------

function checkMergeGate(command) {
  if (!/\bgit\b.*\bmerge\b/i.test(command)) return;

  const config = getWorkflowConfig();
  const workPrefix = (config.branching && config.branching.workPrefix) || 'work';
  const escapedPrefix = workPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Extract the full work branch name from the command
  const branchMatch = command.match(new RegExp('\\b(' + escapedPrefix + '\\/[^\\s]+)'));
  if (!branchMatch) return; // not merging a work branch

  const mergingBranch = branchMatch[1];

  // Extract task slug: work/<feature>/<task> → task portion
  const parts = mergingBranch.split('/');
  const taskSlug = parts.length >= 3 ? parts.slice(2).join('/') : null;

  const feature = getActiveFeature();
  if (!feature) {
    block('Merge gate: Cannot determine active feature. Ensure you are on a feature branch.');
    return;
  }

  const progressDir = (config.progressDir) || '.claude/progress';
  const featureDir = path.join(getRepoRoot(), progressDir, feature);
  const events = readEventsForFeature(featureDir);

  if (events.length === 0) {
    block('Merge gate: No events recorded. QA must pass before merging.');
    return;
  }

  // Check if this specific task/branch has qa.passed without a subsequent branch.merged
  const taskQaPassed = new Set();
  const taskMerged = new Set();

  for (const evt of events) {
    if (evt.type === 'qa.passed' && evt.data) {
      // Track by task ID or by branch reference
      if (evt.data.task) taskQaPassed.add(String(evt.data.task));
      if (evt.data.branch) taskQaPassed.add(evt.data.branch);
    }
    if (evt.type === 'branch.merged' && evt.data) {
      if (evt.data.task) taskMerged.add(String(evt.data.task));
      if (evt.data.branch) taskMerged.add(evt.data.branch);
      // Also track by message content which often contains the branch name
      if (evt.data.message && evt.data.message.includes(mergingBranch)) {
        taskMerged.add(mergingBranch);
      }
    }
  }

  // Check if this branch or task slug has QA pass and hasn't been merged yet
  const hasQaPass = taskQaPassed.has(mergingBranch) ||
                    (taskSlug && taskQaPassed.has(taskSlug));
  const alreadyMerged = taskMerged.has(mergingBranch) ||
                        (taskSlug && taskMerged.has(taskSlug));

  if (hasQaPass && !alreadyMerged) return; // This specific branch passed QA — allow

  // Fallback: check by task number if slug-based matching didn't work
  // Extract task number from slug (e.g., "task-1" → "1")
  if (taskSlug) {
    const taskNumMatch = taskSlug.match(/(\d+)/);
    if (taskNumMatch) {
      const taskNum = taskNumMatch[1];
      if (taskQaPassed.has(taskNum) && !taskMerged.has(taskNum)) return;
    }
  }

  block('Merge gate: Branch "' + mergingBranch + '" does not have a QA pass. Wait for qa.passed event before merging.');
}

// ---------------------------------------------------------------------------
// Gate B: Shutdown Gate — block shutdown_request before Guardian passes
// ---------------------------------------------------------------------------

function checkShutdownGate(toolInput) {
  // SendMessage structured messages have type nested in .message
  const msg = toolInput.message;
  if (!msg || typeof msg !== 'object' || msg.type !== 'shutdown_request') return;

  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state) return;

  // Always allow if guardian has passed
  if (state.guardianPassed) return;

  // Allow shutting down individual coding/QA agent pairs after their task is merged.
  // The recipient name tells us — if it targets a task-specific agent (coder-task-*, qa-task-*),
  // check if that task has been merged. If so, allow the shutdown.
  const recipient = toolInput.to || '';
  const taskAgentMatch = recipient.match(/^(?:coder|qa)-task-(\d+)$/);
  if (taskAgentMatch) {
    const taskNum = taskAgentMatch[1];
    // If we're in wave phase and this task has been merged, allow shutdown of its agents
    if (state.phase === 'wave' || state.phase === 'guardian') {
      const config = getWorkflowConfig();
      const progressDir = (config.progressDir) || '.claude/progress';
      const featureDir = path.join(getRepoRoot(), progressDir, feature);
      const events = readEventsForFeature(featureDir);

      for (const evt of events) {
        if (evt.type === 'branch.merged' && evt.data) {
          // Check if this task was merged (by task number or message content)
          if (String(evt.data.task) === taskNum) return; // task merged — allow shutdown
          if (evt.data.message && evt.data.message.includes('task-' + taskNum)) return;
        }
      }
    }
  }

  const result = {
    decision: 'block',
    reason: 'Shutdown gate: Cannot shut down agents before their task is merged or Guardian passes.'
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate C: Worktree Polling Gate — block ANY Bash reference to worktreeDir
// ---------------------------------------------------------------------------

function checkWorktreePollingGate(command) {
  const config = getWorkflowConfig();
  const worktreeDir = (config.branching && config.branching.worktreeDir) || '.worktrees';
  const escaped = worktreeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match ANY reference to worktreeDir followed by a path separator
  const worktreeRef = new RegExp(escaped + '[/\\\\]');
  if (!worktreeRef.test(command)) return;

  // Allowlist: legitimate worktree management operations
  if (/\bgit\s+worktree\s+(add|remove|list|prune)\b/.test(command)) return;

  // Allowlist: rebase from worktree (needed for merge prep)
  if (/\brebase\b/.test(command)) return;

  // Block everything else referencing worktreeDir
  block('Worktree gate: Do not inspect agent worktrees. Wait for agents to message you.');
}

// ---------------------------------------------------------------------------
// Gate D: TaskStop Gate — block TaskStop before Guardian passes
// ---------------------------------------------------------------------------

function checkTaskStopGate() {
  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state) return;

  if (state.guardianPassed) return;

  const result = {
    decision: 'block',
    reason: 'TaskStop gate: Cannot stop background agents before Guardian passes. Let agents complete their work.'
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate E: Worktree Creation Gate — block git worktree add outside setup/wave
// ---------------------------------------------------------------------------

function checkWorktreeCreationGate(command) {
  if (!/\bgit\s+worktree\s+add\b/.test(command)) return;

  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state) return;

  if (state.phase !== 'wave' && state.phase !== 'setup') {
    block('Worktree gate: git worktree add only allowed during setup or wave phase. Current phase: ' + state.phase);
  }
}

// ---------------------------------------------------------------------------
// Helper: read events.jsonl for a feature directory
// ---------------------------------------------------------------------------

function readEventsForFeature(featureDir) {
  try {
    const eventFile = path.join(featureDir, 'events.jsonl');
    const raw = fs.readFileSync(eventFile, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const events = [];
    for (const line of lines) {
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
    return events;
  } catch {
    return [];
  }
}
