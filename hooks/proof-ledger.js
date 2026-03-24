#!/usr/bin/env node
'use strict';

// PostToolUse hook: Proof-of-Work Ledger
// Records what ACTUALLY HAPPENED after tool execution completes.
// This is the unforgeable proof that proof-gate.js validates.
//
// Registered for: PostToolUse (all tools via empty matcher)
//
// Records:
//   Agent tool   → { type: "agent.spawned", agent: <name>, ... }
//   SendMessage  → { type: "message.sent", from: <sender>, to: <recipient>, ... }
//                   If message contains QA verdict keywords → also records qa.verdict
//                   If message from guardian with PASS → records guardian.verdict
//   Bash         → git merge → { type: "branch.merged", branch: <name> }
//                   git worktree add → { type: "worktree.created", path: <path> }
//                   git worktree remove → { type: "worktree.removed", path: <path> }
//
// The ledger file is APPEND-ONLY. proof-gate.js blocks all direct writes to it.
// Only this PostToolUse hook can write to it — outside the LLM's control.

const fs = require('fs');
const path = require('path');
const { getActiveFeature, getRepoRoot, getWorkflowConfig } = require('./config.js');

// ---------------------------------------------------------------------------
// Ledger path resolution
// ---------------------------------------------------------------------------

function getLedgerPath(feature) {
  const config = getWorkflowConfig();
  const progressDir = config.progressDir || '.claude/progress';
  return path.join(getRepoRoot(), progressDir, feature, 'proof-ledger.jsonl');
}

// ---------------------------------------------------------------------------
// Append a proof entry (atomic)
// ---------------------------------------------------------------------------

function appendProof(feature, entry) {
  try {
    const ledgerPath = getLedgerPath(feature);
    const dir = path.dirname(ledgerPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const record = {
      ts: new Date().toISOString(),
      ...entry
    };

    fs.appendFileSync(ledgerPath, JSON.stringify(record) + '\n');
  } catch {
    // Best-effort — never crash
  }
}

// ---------------------------------------------------------------------------
// Tool-specific proof extractors
// ---------------------------------------------------------------------------

function handleAgentSpawn(data, feature) {
  const toolInput = data.tool_input || {};
  const agentName = toolInput.name || toolInput.description || 'unknown';
  const teamName = toolInput.team_name || null;
  const model = toolInput.model || null;
  const subagentType = toolInput.subagent_type || null;

  appendProof(feature, {
    type: 'agent.spawned',
    agent: agentName,
    team: teamName,
    model: model,
    subagentType: subagentType
  });
}

function handleSendMessage(data, feature) {
  const toolInput = data.tool_input || {};
  const to = toolInput.to || '';
  const message = toolInput.message || '';
  const summary = toolInput.summary || '';

  // Determine message content for verdict detection
  const messageText = typeof message === 'string'
    ? message
    : (message.type === 'shutdown_request' ? 'shutdown_request' : JSON.stringify(message));

  const lowerMsg = (messageText + ' ' + summary).toLowerCase();

  appendProof(feature, {
    type: 'message.sent',
    to: to,
    contentHint: summary || messageText.substring(0, 100)
  });

  // Detect QA verdict from QA agents messaging team leader
  const isFromQa = /^qa[-_]?task[-_]?\d+$/i.test(to) === false; // to = team leader
  const qaPassPattern = /qa\s*pass|verdict.*approved|ready\s+to\s+merge/i;
  const qaFailPattern = /qa\s*fail|verdict.*rejected|fix\s+(these|required)/i;

  // The "from" in PostToolUse context is actually the SENDER (the team leader or the agent).
  // But messages TO the team leader with QA PASS content are what we need to detect.
  // In PostToolUse, we only see messages SENT by the current session.
  // QA agents send messages that appear in the team leader's inbox — we can't intercept those here.
  //
  // REVISED APPROACH: We record all messages. proof-gate.js will validate by checking
  // the INBOX files directly for messages FROM qa-task-* agents containing PASS.
  // This PostToolUse hook records what the team leader SENDS (for shutdown tracking etc).
}

function handleBashCommand(data, feature) {
  const command = (data.tool_input && data.tool_input.command) || '';

  // git merge <branch>
  const mergeMatch = command.match(/\bgit\s+merge\s+(?:--no-ff\s+)?(\S+)/);
  if (mergeMatch) {
    appendProof(feature, {
      type: 'branch.merged',
      branch: mergeMatch[1],
      command: command.substring(0, 200)
    });
  }

  // git worktree add <path> -b <branch>
  const addMatch = command.match(/\bgit\s+worktree\s+add\s+(\S+)/);
  if (addMatch) {
    appendProof(feature, {
      type: 'worktree.created',
      path: addMatch[1]
    });
  }

  // git worktree remove <path>
  const removeMatch = command.match(/\bgit\s+worktree\s+remove\s+(\S+)/);
  if (removeMatch) {
    appendProof(feature, {
      type: 'worktree.removed',
      path: removeMatch[1]
    });
  }
}

// ---------------------------------------------------------------------------
// Main: read stdin, dispatch by tool
// ---------------------------------------------------------------------------

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';

    // Resolve active feature
    const feature = getActiveFeature();
    if (!feature) {
      process.exit(0);
    }

    switch (toolName) {
      case 'Agent':
      case 'Task':
        handleAgentSpawn(data, feature);
        break;

      case 'SendMessage':
        handleSendMessage(data, feature);
        break;

      case 'Bash':
        handleBashCommand(data, feature);
        break;

      default:
        // Other tools — no proof to record
        break;
    }
  } catch {
    // Never crash — proof collection is best-effort
  }

  process.exit(0);
});
