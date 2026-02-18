#!/usr/bin/env node
'use strict';

// Core JSONL progress tracker — event emitter, renderers, and PostToolUse hook.
// Emits structured events to <progressDir>/<feature>/events.jsonl
// Renders current.md, history.md, and index.md from event streams.
// When invoked as a PostToolUse hook (stdin), emits file.modified/file.created events.
// Non-blocking — always exits 0 when running as hook.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { getRepoRoot, getBranchingConfig, getEffectiveBranch } = require('./config.js');

// ---------------------------------------------------------------------------
// Session identity — generated once per module load
// ---------------------------------------------------------------------------
const sid = crypto.randomBytes(4).toString('hex');
let seqNum = 0;

// ---------------------------------------------------------------------------
// Event types that trigger markdown re-rendering after append
// ---------------------------------------------------------------------------
const RENDER_TRIGGERS = new Set([
  'task.completed',
  'qa.passed',
  'qa.failed',
  'branch.merged',
  'session.start',
  'session.end',
  'checkpoint',
  'blocker.reported',
  'plan.created'
]);

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/**
 * Read progressDir from .claude/workflow.json using the repo root.
 * Works correctly from both the main repo and worktree directories.
 * Falls back to '.claude/progress'.
 */
function getProgressDir() {
  try {
    const repoRoot = getRepoRoot();
    const configPath = path.join(repoRoot, '.claude', 'workflow.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.progressDir || '.claude/progress';
  } catch {
    return '.claude/progress';
  }
}

// ---------------------------------------------------------------------------
// Git branch feature detection
// ---------------------------------------------------------------------------

/**
 * Detect the current feature name from the git branch.
 * Uses configurable prefixes from .claude/workflow.json.
 *
 * Patterns matched (using configured prefixes):
 *   <workPrefix>/<feature>/<task>    -> feature
 *   <featurePrefix>/<feature>        -> feature
 *   hotfix/<name>                    -> name
 *   refactor/<name>                  -> name
 *   anything else                    -> null
 *
 * @param {string} [command] - Optional bash command for worktree-aware detection.
 *   If provided, uses getEffectiveBranch(command) to detect branch from
 *   commands that include `cd <path> &&` or `git -C <path>`.
 */
function getFeatureFromBranch(command) {
  try {
    let branch;
    if (command) {
      branch = getEffectiveBranch(command);
    } else {
      branch = execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    }

    if (!branch) return null;

    const config = getBranchingConfig();
    const workPrefix = config.workPrefix;
    const featurePrefix = config.featurePrefix;

    // <workPrefix>/<feature>/<task> — extract the second segment
    if (workPrefix && branch.startsWith(workPrefix + '/')) {
      const parts = branch.split('/');
      if (parts.length >= 3) {
        return parts[1];
      }
      return null;
    }

    // <featurePrefix>/<feature> — extract the second segment
    if (featurePrefix && branch.startsWith(featurePrefix + '/')) {
      const parts = branch.split('/');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
      return null;
    }

    // hotfix/<name> — extract the second segment
    if (branch.startsWith('hotfix/')) {
      const parts = branch.split('/');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
      return null;
    }

    // refactor/<name> — extract the second segment
    if (branch.startsWith('refactor/')) {
      const parts = branch.split('/');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lock protocol — simple exclusive file lock with stale detection
// ---------------------------------------------------------------------------

const LOCK_STALE_MS = 60000; // 60 seconds

/**
 * Attempt to acquire an exclusive lock at `lockPath`.
 * Writes this process's PID into the lock file.
 * Returns true on success, false if another live process holds it.
 */
function acquireLock(lockPath) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    // Lock file already exists — check for staleness
    try {
      const stat = fs.statSync(lockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      const lockPid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
      const pidDead = !isProcessAlive(lockPid);

      if (ageMs > LOCK_STALE_MS || pidDead) {
        // Stale lock — remove and retry once
        try {
          fs.unlinkSync(lockPath);
        } catch {
          return false;
        }
        try {
          const fd = fs.openSync(lockPath, 'wx');
          fs.writeSync(fd, String(process.pid));
          fs.closeSync(fd);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      // Cannot inspect lock — give up
    }
    return false;
  }
}

/**
 * Release the lock file at `lockPath`.
 */
function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Already removed or never existed — fine
  }
}

/**
 * Check whether a PID is still alive.
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core event emitter
// ---------------------------------------------------------------------------

/**
 * Emit a structured JSONL event.
 *
 * @param {string}  type           Event type (e.g. 'task.completed')
 * @param {object}  data           Event payload
 * @param {object}  [options]      Optional overrides
 * @param {string}  [options.feature]  Feature name (auto-detected from branch if omitted)
 * @param {string}  [options.agent]    Agent identifier
 * @param {string}  [options.pane_id]  Terminal pane identifier
 */
function emitEvent(type, data, options) {
  options = options || {};

  try {
    const feature = options.feature || getFeatureFromBranch();
    if (!feature) {
      // Cannot determine feature — silently skip
      return;
    }

    const progressDir = getProgressDir();
    const featureDir = path.join(progressDir, feature);

    // Ensure feature directory exists
    if (!fs.existsSync(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }

    const envelope = {
      v: 1,
      ts: new Date().toISOString(),
      sid: sid,
      seq: seqNum++,
      type: type,
      feature: feature,
      agent: options.agent || null,
      pane_id: options.pane_id || null,
      data: data
    };

    const eventFile = path.join(featureDir, 'events.jsonl');
    fs.appendFileSync(eventFile, JSON.stringify(envelope) + '\n');

    // Trigger markdown renders for significant events
    if (RENDER_TRIGGERS.has(type)) {
      try { renderCurrentMd(featureDir); } catch { /* best-effort */ }
      try { renderHistoryMd(featureDir); } catch { /* best-effort */ }
      try { renderIndex(progressDir); } catch { /* best-effort */ }
    }
  } catch {
    // Never crash — swallow errors
  }
}

// ---------------------------------------------------------------------------
// Event file reader helper
// ---------------------------------------------------------------------------

/**
 * Read and parse all events from a feature's events.jsonl.
 * Returns an array of parsed event objects. Malformed lines are skipped.
 */
function readEvents(featureDir) {
  const eventFile = path.join(featureDir, 'events.jsonl');
  try {
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

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/**
 * Replay events.jsonl and write current.md — a snapshot of the feature's
 * current status including active tasks, blockers, and recent events.
 */
function renderCurrentMd(featureDir) {
  const lockPath = path.join(featureDir, 'render.lock');
  if (!acquireLock(lockPath)) {
    return; // another process is rendering — skip
  }

  try {
    const events = readEvents(featureDir);
    if (events.length === 0) {
      releaseLock(lockPath);
      return;
    }

    const featureName = events[0].feature || path.basename(featureDir);

    // Derive task states from events
    const tasks = new Map(); // taskId -> { name, status, agent }
    let overallStatus = 'in-progress';
    let lastCheckpoint = null;
    const blockers = [];

    for (const evt of events) {
      const d = evt.data || {};

      switch (evt.type) {
        case 'plan.created':
          if (Array.isArray(d.tasks)) {
            for (const t of d.tasks) {
              tasks.set(t.id || t.name, {
                name: t.name || t.id,
                status: 'pending',
                agent: t.agent || null
              });
            }
          }
          break;
        case 'task.started':
          if (d.task) {
            const existing = tasks.get(d.task) || { name: d.task, agent: null };
            existing.status = 'in-progress';
            if (d.agent) existing.agent = d.agent;
            tasks.set(d.task, existing);
          }
          break;
        case 'task.completed':
          if (d.task) {
            const existing = tasks.get(d.task) || { name: d.task, agent: null };
            existing.status = 'done';
            tasks.set(d.task, existing);
          }
          break;
        case 'qa.passed':
          overallStatus = 'qa-passed';
          break;
        case 'qa.failed':
          overallStatus = 'qa-failed';
          break;
        case 'branch.merged':
          overallStatus = 'merged';
          break;
        case 'checkpoint':
          lastCheckpoint = { ts: evt.ts, message: d.message || '' };
          break;
        case 'blocker.reported':
          blockers.push({ ts: evt.ts, message: d.message || 'Unknown blocker' });
          break;
        case 'session.end':
          // Latest session ended — keep status as-is
          break;
        default:
          break;
      }
    }

    // Build markdown
    const lines = [];
    lines.push(`# ${featureName} -- Current Status`);
    lines.push('');
    lines.push(`**Status:** ${overallStatus}`);
    lines.push(`**Last updated:** ${events[events.length - 1].ts}`);
    lines.push('');

    if (lastCheckpoint) {
      lines.push(`**Last checkpoint:** ${lastCheckpoint.message} (${lastCheckpoint.ts})`);
      lines.push('');
    }

    if (blockers.length > 0) {
      lines.push('## Blockers');
      lines.push('');
      for (const b of blockers) {
        lines.push(`- **${b.ts}**: ${b.message}`);
      }
      lines.push('');
    }

    // Task table
    if (tasks.size > 0) {
      lines.push('## Tasks');
      lines.push('');
      lines.push('| Task | Status | Agent |');
      lines.push('|------|--------|-------|');
      for (const [id, t] of tasks) {
        const name = t.name || id;
        const status = t.status || 'pending';
        const agent = t.agent || '--';
        lines.push(`| ${name} | ${status} | ${agent} |`);
      }
      lines.push('');
    }

    // Last 5 events
    const recent = events.slice(-5);
    lines.push('## Recent Events');
    lines.push('');
    for (const evt of recent) {
      const summary = evt.data && evt.data.message ? ` -- ${evt.data.message}` : '';
      lines.push(`- \`${evt.ts}\` **${evt.type}**${summary}`);
    }
    lines.push('');

    const mdPath = path.join(featureDir, 'current.md');
    fs.writeFileSync(mdPath, lines.join('\n'));
  } catch {
    // best-effort
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * Replay events.jsonl and write history.md — a full timeline grouped by
 * date and session.
 */
function renderHistoryMd(featureDir) {
  const lockPath = path.join(featureDir, 'render.lock');
  if (!acquireLock(lockPath)) {
    return;
  }

  try {
    const events = readEvents(featureDir);
    if (events.length === 0) {
      releaseLock(lockPath);
      return;
    }

    const featureName = events[0].feature || path.basename(featureDir);

    // Group events by date, then by session
    const byDate = new Map(); // dateStr -> Map(sid -> [events])
    for (const evt of events) {
      const dateStr = evt.ts ? evt.ts.slice(0, 10) : 'unknown';
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, new Map());
      }
      const sessions = byDate.get(dateStr);
      const sessionKey = evt.sid || 'unknown';
      if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, []);
      }
      sessions.get(sessionKey).push(evt);
    }

    const lines = [];
    lines.push(`# ${featureName} -- History`);
    lines.push('');

    for (const [dateStr, sessions] of byDate) {
      lines.push(`## ${dateStr}`);
      lines.push('');

      for (const [sessionId, sessionEvents] of sessions) {
        lines.push(`### Session \`${sessionId}\``);
        lines.push('');

        for (const evt of sessionEvents) {
          const time = evt.ts ? evt.ts.slice(11, 19) : '??:??:??';
          const agent = evt.agent ? ` [${evt.agent}]` : '';
          const summary = evt.data && evt.data.message ? ` -- ${evt.data.message}` : '';
          lines.push(`- \`${time}\`${agent} **${evt.type}**${summary}`);
        }
        lines.push('');
      }
    }

    const mdPath = path.join(featureDir, 'history.md');
    fs.writeFileSync(mdPath, lines.join('\n'));
  } catch {
    // best-effort
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * Scan all feature directories under progressDir and write index.md —
 * a dashboard listing every feature and its current status.
 */
function renderIndex(progressDir) {
  const lockPath = path.join(progressDir, 'render.lock');
  if (!acquireLock(lockPath)) {
    return;
  }

  try {
    if (!fs.existsSync(progressDir)) {
      releaseLock(lockPath);
      return;
    }

    const entries = fs.readdirSync(progressDir, { withFileTypes: true });
    const features = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const featureDir = path.join(progressDir, entry.name);
      const eventFile = path.join(featureDir, 'events.jsonl');

      if (!fs.existsSync(eventFile)) continue;

      const events = readEvents(featureDir);
      if (events.length === 0) continue;

      // Determine status from events
      let status = 'in-progress';
      let lastTs = events[events.length - 1].ts;

      for (const evt of events) {
        if (evt.type === 'branch.merged') status = 'merged';
        else if (evt.type === 'qa.passed') status = 'qa-passed';
        else if (evt.type === 'qa.failed') status = 'qa-failed';
      }

      features.push({
        name: entry.name,
        status: status,
        lastUpdated: lastTs,
        eventCount: events.length
      });
    }

    const lines = [];
    lines.push('# Progress Index');
    lines.push('');
    lines.push('*Auto-generated dashboard of all tracked features.*');
    lines.push('');

    if (features.length === 0) {
      lines.push('No features tracked yet.');
    } else {
      lines.push('| Feature | Status | Last Updated | Events |');
      lines.push('|---------|--------|--------------|--------|');

      for (const f of features) {
        lines.push(`| [${f.name}](./${f.name}/current.md) | ${f.status} | ${f.lastUpdated} | ${f.eventCount} |`);
      }
    }
    lines.push('');

    const mdPath = path.join(progressDir, 'index.md');
    fs.writeFileSync(mdPath, lines.join('\n'));
  } catch {
    // best-effort
  } finally {
    releaseLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// PostToolUse hook mode — stdin processing (Edit/Write tools)
// ---------------------------------------------------------------------------

function runAsHook() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const toolName = data.tool_name || 'unknown';
      const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || 'unknown';

      const eventType = (toolName === 'Write') ? 'file.created' : 'file.modified';

      emitEvent(eventType, {
        tool: toolName,
        file: filePath,
        message: `${eventType}: ${filePath}`
      });
    } catch {
      // Non-blocking — always exit 0
    }
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Module exports / hook entry point
// ---------------------------------------------------------------------------

module.exports = {
  emitEvent,
  getFeatureFromBranch,
  renderCurrentMd,
  renderHistoryMd,
  renderIndex
};

// When executed directly (as a hook), run stdin processing
if (require.main === module) {
  runAsHook();
}
