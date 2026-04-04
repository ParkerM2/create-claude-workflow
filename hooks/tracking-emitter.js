#!/usr/bin/env node
'use strict';

// Hook-based agent event emitter — System B progress tracking.
// Handles: TeammateIdle, TaskCompleted, PreToolUse (Task tool),
//          PostToolUse (tool.use + proof.* events), Stop
//
// Reads JSON payload from stdin, dispatches by hook_event_name.
// Exits silently (exit 0) always — never blocks the user's workflow.
//
// Context resolution:
//   1. Reads <repoRoot>/.claude/.current-context.json
//   2. If absent/unreadable: exit 0 silently
//   3. Routes events to <repoRoot>/progress/<ticket|runSlug>/events.jsonl
//
// Event schema (one JSON line per event):
//   { v, ts, ticket, run, phase, seq, milestone, agent, event, data }

const fs = require('fs');
const path = require('path');
const { getRepoRoot } = require('./config.js');

// ---------------------------------------------------------------------------
// Milestone event set
// ---------------------------------------------------------------------------

const MILESTONE_EVENTS = new Set([
  'run.started',
  'agent.spawned',
  'qa.passed',
  'qa.failed',
  'branch.merged',
  'wave.complete',
  'guardian.passed',
  'run.complete',
  'run.failed',
  'permission.required'
]);

// ---------------------------------------------------------------------------
// Context resolution
// ---------------------------------------------------------------------------

/**
 * Read .claude/.current-context.json from repo root.
 * Returns parsed object or null if absent/unreadable.
 * Shape: { ticket: string|null, phase: string, runSlug: string|null }
 */
function readCurrentContext() {
  try {
    const contextPath = path.join(getRepoRoot(), '.claude', '.current-context.json');
    const raw = fs.readFileSync(contextPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve the events.jsonl path for a given context.
 * Uses ticket if set, otherwise runSlug as the folder name.
 * Returns null if neither is available.
 */
function resolveEventsPath(ctx) {
  const folder = ctx.ticket || ctx.runSlug || null;
  if (!folder) return null;
  return path.join(getRepoRoot(), 'progress', folder, 'events.jsonl');
}

// ---------------------------------------------------------------------------
// Sequence counter
// ---------------------------------------------------------------------------

/**
 * Read the last seq from events.jsonl and return next seq.
 * Returns 1 if file is absent or empty.
 */
function nextSeq(eventsPath) {
  try {
    if (!fs.existsSync(eventsPath)) return 1;
    const raw = fs.readFileSync(eventsPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) return 1;
    const last = JSON.parse(lines[lines.length - 1]);
    return (typeof last.seq === 'number' ? last.seq : 0) + 1;
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Event appender
// ---------------------------------------------------------------------------

/**
 * Append a single event to events.jsonl.
 * Creates the parent directory if needed.
 * All errors caught silently.
 */
function appendEvent(eventsPath, ctx, eventFields) {
  try {
    const dir = path.dirname(eventsPath);
    fs.mkdirSync(dir, { recursive: true });

    const seq = nextSeq(eventsPath);
    const isMilestone = MILESTONE_EVENTS.has(eventFields.event);

    const record = {
      v: 1,
      ts: new Date().toISOString(),
      ticket: ctx.ticket || null,
      run: ctx.runSlug || null,
      phase: ctx.phase || null,
      seq,
      milestone: isMilestone,
      agent: eventFields.agent || null,
      event: eventFields.event,
      data: eventFields.data || {}
    };

    fs.appendFileSync(eventsPath, JSON.stringify(record) + '\n');
  } catch {
    // Best-effort — never crash
  }
}

// ---------------------------------------------------------------------------
// Hook dispatchers
// ---------------------------------------------------------------------------

function handleTeammateIdle(payload, ctx, eventsPath) {
  appendEvent(eventsPath, ctx, {
    event: 'agent.idle',
    agent: payload.teammate_name || 'unknown',
    data: { team: payload.team_name || null }
  });
}

function handleTaskCompleted(payload, ctx, eventsPath) {
  appendEvent(eventsPath, ctx, {
    event: 'task.validated',
    agent: payload.teammate_name || null,
    data: {
      taskId: payload.task_id || null,
      subject: payload.task_subject || payload.subject || null
    }
  });
}

function handlePreToolUse(payload, ctx, eventsPath) {
  const toolName = payload.tool_name || payload.tool || '';

  if (toolName === 'Task') {
    const toolInput = payload.tool_input || {};
    // Tracking event: agent.spawned (milestone)
    appendEvent(eventsPath, ctx, {
      event: 'agent.spawned',
      agent: toolInput.name || 'unknown',
      data: { team: toolInput.team_name || null }
    });

    // Proof event: proof.agent_spawned (non-milestone)
    appendEvent(eventsPath, ctx, {
      event: 'proof.agent_spawned',
      agent: toolInput.name || 'unknown',
      data: {
        name: toolInput.name || null,
        description: toolInput.description || null,
        team: toolInput.team_name || null
      }
    });
  }
}

function handlePostToolUse(payload, ctx, eventsPath) {
  const toolName = payload.tool_name || payload.tool || 'unknown';
  const agentName = payload.agent_name || payload.teammate_name || null;

  // tool.use event for all PostToolUse
  appendEvent(eventsPath, ctx, {
    event: 'tool.use',
    agent: agentName,
    data: { tool: toolName, success: true }
  });

  // Proof events for Edit/Write tools
  if (toolName === 'Edit' || toolName === 'Write') {
    const toolInput = payload.tool_input || {};
    appendEvent(eventsPath, ctx, {
      event: 'proof.file_written',
      agent: agentName,
      data: {
        file: toolInput.file_path || null,
        tool: toolName
      }
    });
  }
}

function handleStop(payload, ctx, eventsPath) {
  appendEvent(eventsPath, ctx, {
    event: 'agent.turn.completed',
    agent: payload.agent_name || null,
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

    try {
      if (raw.trim()) {
        payload = JSON.parse(raw);
      }
    } catch {
      // Malformed JSON — exit silently
      process.exit(0);
    }

    // Resolve context — exit silently if none
    const ctx = readCurrentContext();
    if (!ctx) {
      process.exit(0);
    }

    const eventsPath = resolveEventsPath(ctx);
    if (!eventsPath) {
      process.exit(0);
    }

    const hookEventName = payload.hook_event_name || '';

    try {
      switch (hookEventName) {
        case 'TeammateIdle':
          handleTeammateIdle(payload, ctx, eventsPath);
          break;
        case 'TaskCompleted':
          handleTaskCompleted(payload, ctx, eventsPath);
          break;
        case 'PreToolUse':
          handlePreToolUse(payload, ctx, eventsPath);
          break;
        case 'PostToolUse':
          handlePostToolUse(payload, ctx, eventsPath);
          break;
        case 'Stop':
          handleStop(payload, ctx, eventsPath);
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
