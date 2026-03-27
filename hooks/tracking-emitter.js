#!/usr/bin/env node
'use strict';

// Hook-based agent event emitter for unified tracking.
// Handles: TeammateIdle, TaskCompleted, PreToolUse (Task tool), PostToolUse, Stop
// Reads JSON payload from stdin, dispatches by hook_event_name.
// Exits silently (exit 0) if no active tracking context is found.
//
// The stdin payload field for event type is "hook_event_name" (snake_case).
// Source: https://code.claude.com/docs/en/hooks — "Input" section,
// common fields table: hook_event_name is "Name of the event that fired".

const fs = require('fs');
const path = require('path');
const { getActiveFeature, getRepoRoot } = require('./config.js');
const { updateManifest, emitTrackingEvent, emitAgentEvent, listTrackedFeatures, getManifest } = require('./tracking.js');

// ---------------------------------------------------------------------------
// Feature resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the active feature ID.
 * 1. Try getActiveFeature() from config (branch-based + progress-dir scan)
 * 2. Scan .claude/tracking/ for most recent in-progress feature
 * 3. Return null if nothing found
 */
function resolveFeatureId() {
  // Try primary detection (branch + progress dir)
  const fromConfig = getActiveFeature();
  if (fromConfig) return fromConfig;

  // Fallback: scan .claude/tracking/ for most recent in-progress feature
  try {
    const trackingDir = path.join(getRepoRoot(), '.claude', 'tracking');
    if (!fs.existsSync(trackingDir)) return null;

    const features = listTrackedFeatures();
    if (features.length === 0) return null;

    // Find features with status !== 'done', sorted by manifest created desc
    let best = null;
    let bestTime = null;

    for (const featureId of features) {
      const manifest = getManifest(featureId);
      if (!manifest) continue;
      if (manifest.status === 'done') continue;

      const created = manifest.created ? new Date(manifest.created).getTime() : 0;
      if (bestTime === null || created > bestTime) {
        bestTime = created;
        best = featureId;
      }
    }

    return best;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook dispatchers
// ---------------------------------------------------------------------------

function handleTeammateIdle(payload, featureId) {
  const teammate_name = payload.teammate_name || payload.agent_name || 'unknown';
  const team_name = payload.team_name || payload.team || null;

  updateManifest(featureId, {
    agents: {
      [teammate_name]: { status: 'idle' }
    }
  });

  emitAgentEvent(featureId, teammate_name, {
    type: 'agent.idle',
    data: { team: team_name }
  });
}

function handleTaskCompleted(payload, featureId) {
  const task_id = payload.task_id || null;
  const task_subject = payload.task_subject || payload.subject || null;
  const teammate_name = payload.teammate_name || payload.agent_name || null;
  const team_name = payload.team_name || payload.team || null;

  emitTrackingEvent(featureId, {
    type: 'task.completed',
    data: {
      taskId: task_id,
      subject: task_subject,
      teammate: teammate_name,
      team: team_name
    }
  });
}

function handlePreToolUse(payload, featureId) {
  const tool_name = payload.tool_name || payload.tool || '';
  if (tool_name !== 'Task') return;

  const tool_input = payload.tool_input || {};
  const name = tool_input.name || tool_input.agent_name || 'unknown';
  const team_name = tool_input.team_name || tool_input.team || null;

  updateManifest(featureId, {
    agents: {
      [name]: {
        status: 'running',
        started: new Date().toISOString()
      }
    }
  });

  emitTrackingEvent(featureId, {
    type: 'agent.spawned',
    data: { name, team: team_name }
  });
}

function handlePostToolUse(payload, featureId) {
  const tool_name = payload.tool_name || payload.tool || 'unknown';
  // Best-effort: get agent name from payload if available
  const agentName = payload.agent_name || payload.teammate_name || 'unknown';

  emitAgentEvent(featureId, agentName, {
    type: 'agent.result',
    data: { tool: tool_name }
  });
}

function handleStop(payload, featureId) {
  const agentName = payload.agent_name || payload.teammate_name || 'unknown';

  emitAgentEvent(featureId, agentName, {
    type: 'agent.turn.completed',
    data: {}
  });
}

// ---------------------------------------------------------------------------
// Main — read stdin, dispatch
// ---------------------------------------------------------------------------

function main() {
  let raw = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });

  process.stdin.on('end', () => {
    let payload = {};

    // Parse JSON payload from stdin
    try {
      if (raw.trim()) {
        payload = JSON.parse(raw);
      }
    } catch {
      // Malformed JSON — exit silently
      process.exit(0);
    }

    // Claude Code passes "hook_event_name" (snake_case) in the stdin JSON payload.
    // See: https://code.claude.com/docs/en/hooks — common input fields table.
    const hook_event_name = payload.hook_event_name || '';

    // Resolve active feature
    const featureId = resolveFeatureId();
    if (!featureId) {
      // No active tracking context — no-op
      process.exit(0);
    }

    // Dispatch by hook_event_name
    try {
      switch (hook_event_name) {
        case 'TeammateIdle':
          handleTeammateIdle(payload, featureId);
          break;
        case 'TaskCompleted':
          handleTaskCompleted(payload, featureId);
          break;
        case 'PreToolUse':
          handlePreToolUse(payload, featureId);
          break;
        case 'PostToolUse':
          handlePostToolUse(payload, featureId);
          break;
        case 'Stop':
          handleStop(payload, featureId);
          break;
        default:
          // Unknown hook type — no-op
          break;
      }
    } catch {
      // Never block the user's workflow
    }

    process.exit(0);
  });

  process.stdin.on('error', () => {
    process.exit(0);
  });
}

main();
