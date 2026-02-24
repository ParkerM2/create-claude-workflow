#!/usr/bin/env node
'use strict';

// SessionStart hook (compact matcher): Re-injects workflow enforcement
// context after context compaction. Reads PHASE-GATE-PROTOCOL.md and
// the current workflow-state.json, injecting both as additionalContext.

const fs = require('fs');
const path = require('path');
const { getRepoRoot, getActiveFeature, getWorkflowState } = require('./config.js');

try {
  // Compute plugin root from this script's location
  const PLUGIN_ROOT = path.resolve(__dirname, '..');

  // Read the Phase Gate Protocol file
  const protocolPath = path.join(PLUGIN_ROOT, 'prompts', 'implementing-features', 'PHASE-GATE-PROTOCOL.md');
  let protocolContent = '';
  try { protocolContent = fs.readFileSync(protocolPath, 'utf8'); } catch { protocolContent = '(Phase Gate Protocol file not found)'; }

  // Detect active feature
  const feature = getActiveFeature();

  // Read workflow state if active feature exists; rebuild from events if missing
  let state = feature ? getWorkflowState(feature) : null;
  if (feature && !state) {
    try {
      const { rebuildState } = require('./tracker.js');
      state = rebuildState(feature);
    } catch { /* best-effort rebuild */ }
  }

  // Build the additionalContext string
  const contextString = [
    '<workflow-enforcement>',
    'CONTEXT WAS COMPACTED — Critical workflow rules re-injected.',
    '',
    protocolContent,
    '',
    '## Current Workflow State',
    `Feature: ${feature || 'No active feature detected'}`,
    `Phase: ${state && state.phase ? state.phase : 'unknown'}`,
    `State: ${state ? JSON.stringify(state, null, 2) : 'No workflow state file found'}`,
    '',
    'IMPORTANT: If you are in the middle of a workflow:',
    '1. Read .claude/progress/<feature>/workflow-state.json for current phase',
    '2. Continue from your current phase — do NOT restart from the beginning',
    '3. The hooks WILL block you if you try to skip phases',
    '</workflow-enforcement>'
  ].join('\n');

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: contextString
    }
  };
  process.stdout.write(JSON.stringify(output));
} catch {
  // Fail silently — never crash the hook
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: ''
    }
  };
  process.stdout.write(JSON.stringify(output));
}
