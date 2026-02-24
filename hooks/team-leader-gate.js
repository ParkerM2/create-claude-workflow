#!/usr/bin/env node
'use strict';

// PreToolUse hook: Team Leader behavioral enforcement.
// Blocks: merges without QA, premature shutdowns, worktree polling, agent kills.
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
// Gate A: Merge Gate — block `git merge` on work/ branches without QA pass
// ---------------------------------------------------------------------------

function checkMergeGate(command) {
  // Only trigger on git merge targeting a work/ branch
  const mergeMatch = command.match(/git\s+merge\b.*\b(work\/\S+)/);
  if (!mergeMatch) return;

  const feature = getActiveFeature();
  if (!feature) return;

  const config = getWorkflowConfig();
  const progressDir = config.progressDir || '.claude/progress';
  const featureDir = path.join(getRepoRoot(), progressDir, feature);
  const events = readEventsForFeature(featureDir);
  if (events.length === 0) return;

  // Count unique tasks with qa.passed events
  const qaPassed = new Set();
  let mergedCount = 0;

  for (const evt of events) {
    if (evt.type === 'qa.passed' && evt.data && evt.data.task) {
      qaPassed.add(String(evt.data.task));
    }
    if (evt.type === 'branch.merged') {
      mergedCount++;
    }
  }

  // If there are more QA passes than merges, at least one task is ready
  if (qaPassed.size > mergedCount) return;

  // Block — no unmerged QA-passed task
  const result = {
    decision: 'block',
    reason: 'Merge gate: No unmerged QA-passed task. Wait for qa.passed event before merging.'
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate B: Shutdown Gate — block shutdown_request before Gate 8
// ---------------------------------------------------------------------------

function checkShutdownGate(toolInput) {
  if (toolInput.type !== 'shutdown_request') return;

  const feature = getActiveFeature();
  if (!feature) return;

  const state = getWorkflowState(feature);
  if (!state) return;

  if (state.guardianPassed) return;

  const result = {
    decision: 'block',
    reason: 'Shutdown gate: Cannot shut down agents before Guardian passes. Let agents complete their full workflow.'
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate C: Worktree Polling Gate — block read-only git in worktree dirs
// ---------------------------------------------------------------------------

const READ_ONLY_GIT_SUBCOMMANDS = /\b(log|status|show|diff|rev-parse|rev-list|shortlog)\b/;

function checkWorktreePollingGate(command) {
  const config = getWorkflowConfig();
  const worktreeDir = (config.branching && config.branching.worktreeDir) || '.worktrees';

  // Escape special regex characters in worktreeDir
  const escaped = worktreeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match git -C <worktreeDir>/... or git --git-dir <worktreeDir>/...
  const targetPattern = new RegExp(
    'git\\s+(?:-C|--git-dir)\\s+["\']?' + escaped + '[/\\\\]'
  );

  if (!targetPattern.test(command)) return;

  // Check if the subcommand is read-only
  // Extract the git subcommand (first non-flag argument after git [-C path])
  const subcommandMatch = command.match(
    /git\s+(?:-C|--git-dir)\s+\S+\s+(\w[\w-]*)/
  );
  if (!subcommandMatch) return;

  const subcommand = subcommandMatch[1];
  if (!READ_ONLY_GIT_SUBCOMMANDS.test(subcommand)) return;

  const result = {
    decision: 'block',
    reason: 'Worktree polling gate: Do not inspect agent worktrees. Use TaskOutput with the saved task_id to check agent status.'
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Gate D: TaskStop Gate — block TaskStop before Gate 8
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
