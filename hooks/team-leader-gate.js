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
  // Broader detection: any git command containing merge
  if (!/\bgit\b.*\bmerge\b/i.test(command)) return;

  // Check if it references a work/ branch anywhere
  const config = getWorkflowConfig();
  const workPrefix = (config.branching && config.branching.workPrefix) || 'work';
  const escapedPrefix = workPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp('\\b' + escapedPrefix + '\\/').test(command)) return;

  // It's a merge of a work branch — enforce QA gate
  const feature = getActiveFeature();
  if (!feature) {
    // FAIL-CLOSED: can't determine feature
    block('Merge gate: Cannot determine active feature. Ensure you are on a feature branch.');
    return;
  }

  const progressDir = (config.progressDir) || '.claude/progress';
  const featureDir = path.join(getRepoRoot(), progressDir, feature);
  const events = readEventsForFeature(featureDir);

  // FAIL-CLOSED on empty events (was fail-open before)
  if (events.length === 0) {
    block('Merge gate: No events recorded. QA must pass before merging.');
    return;
  }

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
  block('Merge gate: No unmerged QA-passed task. Wait for qa.passed event before merging.');
}

// ---------------------------------------------------------------------------
// Gate B: Shutdown Gate — block shutdown_request before Guardian passes
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
