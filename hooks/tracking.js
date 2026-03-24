#!/usr/bin/env node
'use strict';

// Unified tracking module for .claude/tracking/ directory system.
// Manages feature manifests, per-feature and per-agent JSONL event streams,
// and a cross-feature index.json.
//
// Coexists with tracker.js — does NOT modify .claude/progress/ or tracker.js.
// All writes are atomic (.tmp + rename). Lock protocol matches tracker.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getRepoRoot, getWorkflowConfig } = require('./config.js');

// ---------------------------------------------------------------------------
// Session identity — generated once per module load
// ---------------------------------------------------------------------------

const sid = crypto.randomBytes(4).toString('hex');
let seqNum = 0;

// ---------------------------------------------------------------------------
// Lock protocol — mirrors tracker.js exactly
// ---------------------------------------------------------------------------

const LOCK_STALE_MS = 60000; // 60 seconds

function acquireLock(lockPath) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    try {
      const stat = fs.statSync(lockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      const lockPid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
      const pidDead = !isProcessAlive(lockPid);

      if (ageMs > LOCK_STALE_MS || pidDead) {
        try { fs.unlinkSync(lockPath); } catch { return false; }
        try {
          const fd = fs.openSync(lockPath, 'wx');
          fs.writeSync(fd, String(process.pid));
          fs.closeSync(fd);
          return true;
        } catch { return false; }
      }
    } catch {
      // Cannot inspect lock — give up
    }
    return false;
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch { /* already removed — fine */ }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means process exists but we lack permission — it's alive
    if (e.code === 'EPERM') return true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to the .claude/tracking/ directory.
 */
function getTrackingDir() {
  return path.join(getRepoRoot(), '.claude', 'tracking');
}

/**
 * Returns the absolute path to a feature's tracking directory.
 * @param {string} featureId
 */
function getFeatureTrackingDir(featureId) {
  return path.join(getTrackingDir(), featureId);
}

// ---------------------------------------------------------------------------
// Deep merge — replicates config.js deepMerge without importing it
// ---------------------------------------------------------------------------

/**
 * Recursively deep-merge `source` into `target`.
 * Returns a new object — does not mutate inputs.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. initTracking
// ---------------------------------------------------------------------------

/**
 * Initialize tracking for a feature.
 * Creates:
 *   .claude/tracking/<featureId>/manifest.json
 *   .claude/tracking/<featureId>/events.jsonl  (empty)
 *   .claude/tracking/<featureId>/agents/        (directory)
 *
 * If the directory already exists, the manifest is deep-merged with `metadata`
 * (existing fields are preserved). events.jsonl and agents/ are only created
 * if they do not already exist.
 *
 * @param {string} featureId  - Unique feature identifier (e.g. "PR-4545-Modal-Refactor")
 * @param {object} [metadata] - Optional fields to merge into the manifest
 */
function initTracking(featureId, metadata) {
  try {
    const featureDir = getFeatureTrackingDir(featureId);
    const agentsDir = path.join(featureDir, 'agents');

    // Ensure directories exist
    fs.mkdirSync(featureDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    const manifestPath = path.join(featureDir, 'manifest.json');
    const eventsPath = path.join(featureDir, 'events.jsonl');

    // Build default manifest
    const defaults = {
      feature: featureId,
      status: 'pending',
      created: new Date().toISOString(),
      branch: null,
      plan: null,
      agents: {}
    };

    // If manifest already exists, deep-merge; otherwise start from defaults
    let existing = {};
    try {
      existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      // No existing manifest — start fresh
    }

    const merged = deepMerge(deepMerge(defaults, existing), metadata || {});

    // Atomic write
    const tmpPath = manifestPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
    fs.renameSync(tmpPath, manifestPath);

    // Create empty events.jsonl if it doesn't exist
    if (!fs.existsSync(eventsPath)) {
      fs.writeFileSync(eventsPath, '');
    }

    // Regenerate the global index
    updateIndex();
  } catch {
    // Fail gracefully — never throw
  }
}

// ---------------------------------------------------------------------------
// 2. updateManifest
// ---------------------------------------------------------------------------

/**
 * Atomic deep-merge update to manifest.json for a feature.
 * Reads the existing manifest, deep-merges `updates` into it, and writes
 * atomically via .tmp + rename.
 *
 * @param {string} featureId - Feature identifier
 * @param {object} updates   - Partial manifest fields to merge in
 */
function updateManifest(featureId, updates) {
  try {
    const featureDir = getFeatureTrackingDir(featureId);
    const manifestPath = path.join(featureDir, 'manifest.json');
    const tmpPath = manifestPath + '.tmp';

    // Ensure directory exists (caller may not have called initTracking)
    fs.mkdirSync(featureDir, { recursive: true });

    // Read existing manifest or start with minimal defaults
    let existing = { feature: featureId, agents: {} };
    try {
      existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      // No existing manifest — use defaults
    }

    const merged = deepMerge(existing, updates);

    // Atomic write
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
    fs.renameSync(tmpPath, manifestPath);

    // Regenerate index after manifest change
    updateIndex();
  } catch {
    // Fail gracefully — never throw
  }
}

// ---------------------------------------------------------------------------
// 3. emitTrackingEvent
// ---------------------------------------------------------------------------

/**
 * Append a structured JSONL event to the feature's events.jsonl.
 *
 * @param {string} featureId       - Feature identifier
 * @param {object} event           - Event object with at minimum: { type, data }
 * @param {string} [event.type]    - Event type (e.g. 'task.started')
 * @param {object} [event.data]    - Event payload
 * @param {string} [event.agent]   - Agent identifier (optional)
 */
function emitTrackingEvent(featureId, event) {
  try {
    const featureDir = getFeatureTrackingDir(featureId);
    fs.mkdirSync(featureDir, { recursive: true });

    const envelope = {
      v: 1,
      ts: new Date().toISOString(),
      sid: sid,
      seq: seqNum++,
      type: event.type || 'unknown',
      feature: featureId,
      agent: event.agent || null,
      data: event.data || {}
    };

    const eventsPath = path.join(featureDir, 'events.jsonl');
    fs.appendFileSync(eventsPath, JSON.stringify(envelope) + '\n');
  } catch {
    // Fail gracefully — never throw
  }
}

// ---------------------------------------------------------------------------
// 4. emitAgentEvent
// ---------------------------------------------------------------------------

/**
 * Append a structured JSONL event to the agent's per-agent JSONL file.
 * Creates the file at .claude/tracking/<featureId>/agents/<agentName>.jsonl.
 *
 * @param {string} featureId   - Feature identifier
 * @param {string} agentName   - Agent name (used as filename, e.g. "codebase-guardian")
 * @param {object} event       - Event object with at minimum: { type, data }
 */
function emitAgentEvent(featureId, agentName, event) {
  try {
    const agentsDir = path.join(getFeatureTrackingDir(featureId), 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const envelope = {
      v: 1,
      ts: new Date().toISOString(),
      sid: sid,
      seq: seqNum++,
      type: event.type || 'unknown',
      feature: featureId,
      agent: agentName,
      data: event.data || {}
    };

    const agentFile = path.join(agentsDir, agentName + '.jsonl');
    fs.appendFileSync(agentFile, JSON.stringify(envelope) + '\n');
  } catch {
    // Fail gracefully — never throw
  }
}

// ---------------------------------------------------------------------------
// 5. updateIndex
// ---------------------------------------------------------------------------

/**
 * Regenerate .claude/tracking/index.json by scanning all feature directories.
 * Reads each feature's manifest.json and writes an aggregate index atomically.
 * Uses a lock to prevent concurrent writes.
 */
function updateIndex() {
  const trackingDir = getTrackingDir();
  const lockPath = path.join(trackingDir, 'index.lock');

  try {
    fs.mkdirSync(trackingDir, { recursive: true });
  } catch {
    return;
  }

  if (!acquireLock(lockPath)) {
    return; // another process is updating — skip
  }

  try {
    const entries = fs.readdirSync(trackingDir, { withFileTypes: true });
    const features = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(trackingDir, entry.name, 'manifest.json');
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        features.push({
          feature: manifest.feature || entry.name,
          status: manifest.status || 'pending',
          created: manifest.created || null,
          branch: manifest.branch || null,
          agentCount: Object.keys(manifest.agents || {}).length
        });
      } catch {
        // Missing or malformed manifest — skip this feature
      }
    }

    const index = {
      v: 1,
      generatedAt: new Date().toISOString(),
      features: features
    };

    const indexPath = path.join(trackingDir, 'index.json');
    const tmpPath = indexPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2));
    fs.renameSync(tmpPath, indexPath);
  } catch {
    // best-effort
  } finally {
    releaseLock(lockPath);
  }
}

// ---------------------------------------------------------------------------
// 6. getManifest
// ---------------------------------------------------------------------------

/**
 * Read and return the manifest.json for a feature.
 * Returns null if the manifest does not exist or cannot be parsed.
 *
 * @param {string} featureId - Feature identifier
 * @returns {object|null}
 */
function getManifest(featureId) {
  try {
    const manifestPath = path.join(getFeatureTrackingDir(featureId), 'manifest.json');
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 7. listTrackedFeatures
// ---------------------------------------------------------------------------

/**
 * Scan .claude/tracking/ and return an array of all tracked feature names.
 * Returns only directories that contain a manifest.json.
 *
 * @returns {string[]}
 */
function listTrackedFeatures() {
  try {
    const trackingDir = getTrackingDir();

    if (!fs.existsSync(trackingDir)) {
      return [];
    }

    const entries = fs.readdirSync(trackingDir, { withFileTypes: true });
    const features = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(trackingDir, entry.name, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        features.push(entry.name);
      }
    }

    return features;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  initTracking,
  updateManifest,
  emitTrackingEvent,
  emitAgentEvent,
  updateIndex,
  getManifest,
  listTrackedFeatures
};
