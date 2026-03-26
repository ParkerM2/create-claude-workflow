#!/usr/bin/env node
'use strict';

// Shared configuration reader for all workflow hooks.
// Provides: repo root resolution (worktree-aware), branching config,
// branch pattern matchers, and effective branch detection.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Branching defaults — merged with user config from .claude/workflow.json
// ---------------------------------------------------------------------------

const BRANCHING_DEFAULTS = {
  baseBranch: 'auto',
  featurePrefix: 'feature',
  workPrefix: 'work',
  enforce: 'warn',
  protectedBranches: ['main', 'master'],
  useWorktrees: true,
  worktreeDir: '.worktrees'
};

// ---------------------------------------------------------------------------
// Guard defaults — controls which PreToolUse guards are active
// ---------------------------------------------------------------------------

const GUARDS_DEFAULTS = {
  branchGuard: true,
  destructiveGuard: true,
  configGuard: true,
  // v3 proof-of-work gates
  proofGate: true,       // single gate replacing workflowGate + teamLeaderGate + enforcementGate
  qualityGate: true,     // TeammateIdle quality enforcement (lint/typecheck/test)
  taskValidator: true,   // TaskCompleted validation (uncommitted changes check)
  // Legacy gates (kept for backward compatibility, default OFF in v3)
  workflowGate: false,
  teamLeaderGate: false,
  enforcementGate: false
};

// ---------------------------------------------------------------------------
// Repo root resolution (worktree-aware, cached)
// ---------------------------------------------------------------------------

let _cachedRepoRoot = null;

/**
 * Find the main repository root directory.
 * Works correctly from both the main working tree and any git worktree.
 * Uses git-common-dir which points to the main repo's .git even from worktrees.
 * Caches the result for the lifetime of the process.
 */
function getRepoRoot() {
  if (_cachedRepoRoot !== null) return _cachedRepoRoot;

  try {
    // git-common-dir returns the .git path for the main repo, even from worktrees.
    // From main repo: ".git"
    // From worktree: "/abs/path/to/main/.git" (or "../main/.git" relative)
    const commonDir = execSync('git rev-parse --git-common-dir', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // Resolve to absolute path relative to CWD, then take parent (repo root)
    const absCommon = path.resolve(process.cwd(), commonDir);
    _cachedRepoRoot = path.dirname(absCommon);
  } catch {
    // Fallback: try --show-toplevel (won't cross worktree boundaries correctly,
    // but works for non-worktree setups)
    try {
      _cachedRepoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch {
      _cachedRepoRoot = process.cwd();
    }
  }

  return _cachedRepoRoot;
}

// ---------------------------------------------------------------------------
// Config readers
// ---------------------------------------------------------------------------

/**
 * Read .claude/workflow.json from the repo root.
 * Returns the full config object with branching defaults merged in.
 */
function getWorkflowConfig() {
  try {
    const configPath = path.join(getRepoRoot(), '.claude', 'workflow.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);

    // Deep-merge branching section with defaults
    config.branching = { ...BRANCHING_DEFAULTS, ...(config.branching || {}) };

    // Ensure protectedBranches is always an array
    if (!Array.isArray(config.branching.protectedBranches)) {
      config.branching.protectedBranches = BRANCHING_DEFAULTS.protectedBranches;
    }

    // Deep-merge guards section with defaults
    config.guards = { ...GUARDS_DEFAULTS, ...(config.guards || {}) };

    return config;
  } catch {
    return {
      projectRulesFile: 'CLAUDE.md',
      architectureFile: 'docs/ARCHITECTURE.md',
      progressDir: '.claude/progress',
      branching: { ...BRANCHING_DEFAULTS }
    };
  }
}

/**
 * Shorthand: return just the branching config section.
 */
function getBranchingConfig() {
  return getWorkflowConfig().branching;
}

/**
 * Return the guards config section, merged with defaults.
 * Controls which PreToolUse guards are active.
 */
function getGuardsConfig() {
  const config = getWorkflowConfig();
  return { ...GUARDS_DEFAULTS, ...(config.guards || {}) };
}

// ---------------------------------------------------------------------------
// Branch pattern matchers
// ---------------------------------------------------------------------------

/**
 * Check if a branch name matches a protected branch pattern.
 * Supports exact match and trailing * glob (e.g. "release/*").
 */
function isProtectedBranch(name, patterns) {
  if (!name || !Array.isArray(patterns)) return false;

  for (const pattern of patterns) {
    if (pattern.endsWith('*')) {
      // Trailing glob: "release/*" matches "release/v1.0"
      const prefix = pattern.slice(0, -1);
      if (name.startsWith(prefix)) return true;
    } else {
      // Exact match
      if (name === pattern) return true;
    }
  }

  return false;
}

/**
 * Check if a branch name matches the feature prefix pattern.
 * e.g. featurePrefix="feature" matches "feature/my-thing"
 */
function isFeatureBranch(name, config) {
  if (!name || !config) return false;
  const prefix = config.featurePrefix;
  if (!prefix) return false;
  return name.startsWith(prefix + '/');
}

/**
 * Check if a branch name matches the work prefix pattern.
 * e.g. workPrefix="work" matches "work/my-feature/task-1"
 * Also recognizes Claude Code auto-generated worktree branch names:
 *   worktree-agent-*, claude/*, agent-*
 */
function isWorkBranch(name, config) {
  if (!name || !config) return false;

  // Claude Code Agent tool creates worktree branches with these patterns
  // when using isolation: "worktree" — they are legitimate coding agent branches
  if (/^(worktree-agent-|claude\/|agent-)/.test(name)) return true;

  const prefix = config.workPrefix;
  if (!prefix) return false;
  return name.startsWith(prefix + '/');
}

// ---------------------------------------------------------------------------
// Effective branch detection (worktree-aware)
// ---------------------------------------------------------------------------

/**
 * Determine the effective git branch for a bash command.
 * Handles commands that include `cd <path> &&` or `git -C <path>` prefixes.
 * Falls back to the current branch in CWD.
 */
function getEffectiveBranch(command) {
  let targetDir = null;

  if (command) {
    // Match: cd <path> && ...
    const cdMatch = command.match(/\bcd\s+["']?([^\s"';&]+)["']?\s*&&/);
    if (cdMatch) {
      targetDir = cdMatch[1];
    }

    // Match: git -C <path> ...
    const gitCMatch = command.match(/\bgit\s+-C\s+["']?([^\s"']+)["']?/);
    if (gitCMatch) {
      targetDir = gitCMatch[1];
    }
  }

  try {
    const opts = {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    };

    if (targetDir) {
      // Resolve relative to CWD
      const absDir = path.resolve(process.cwd(), targetDir);
      opts.cwd = absDir;
    }

    return execSync('git branch --show-current', opts).trim();
  } catch {
    // Fallback: try without targetDir
    try {
      return execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch {
      return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Workflow state utilities
// ---------------------------------------------------------------------------

/**
 * Migrate v1 (9-gate) workflow state to v2 (phase-based FSM) format.
 * Detects old format by presence of `gates` without `phase`.
 * Returns the migrated state object (does not write to disk — caller handles that).
 *
 * @param {object} parsed - The parsed workflow-state.json contents
 * @returns {object} - Migrated state in v2 format
 */
function migrateV1State(parsed) {
  if (!parsed || !parsed.gates || parsed.phase) {
    return parsed; // Already v2 or empty — no migration needed
  }

  const gates = parsed.gates || {};
  const g = (key) => !!(gates[key] && gates[key].passed);

  // Determine phase from gates
  let phase = 'plan';
  if (g('9_feature_complete')) phase = 'done';
  else if (g('8_guardian_passed')) phase = 'guardian';
  else if (g('7_all_waves_complete')) phase = 'guardian';
  else if (g('3_branch_team_ready')) phase = 'wave';
  else if (g('2_plan_complete')) phase = 'setup';

  // Migrate wave data
  const oldWaves = parsed.waves || {};
  const newWaves = {};
  for (const [key, val] of Object.entries(oldWaves)) {
    newWaves[key] = (val && val.status === 'complete') ? 'complete' : 'active';
  }

  const migrated = {
    feature: parsed.feature || null,
    mode: parsed.mode || 'strict',
    startedAt: parsed.startedAt || null,
    phase: phase,
    setupComplete: g('3_branch_team_ready'),
    guardianPassed: g('8_guardian_passed'),
    currentWave: parsed.currentWave || 0,
    totalWaves: parsed.totalWaves || 0,
    waves: newWaves
  };

  return migrated;
}

/**
 * Read the workflow state file for a feature.
 * Transparently migrates v1 (9-gate) format to v2 (phase-based FSM).
 * Returns parsed JSON object or null if file doesn't exist or cannot be read.
 * MUST fail gracefully — never throws.
 *
 * @param {string} feature - Feature name (maps to progress dir subdirectory)
 * @returns {object|null}
 */
function getWorkflowState(feature) {
  try {
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const statePath = path.join(getRepoRoot(), progressDir, feature, 'workflow-state.json');
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    return migrateV1State(parsed);
  } catch {
    return null;
  }
}

/**
 * Recursively deep-merge `source` into `target`.
 * For each key: if both values are plain objects, recurse; otherwise overwrite.
 * Returns a new object — does not mutate inputs.
 *
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
      // Empty source object means "replace with empty" — don't merge
      if (Object.keys(srcVal).length === 0) {
        result[key] = {};
      } else {
        result[key] = deepMerge(tgtVal, srcVal);
      }
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Deep-merge updates into the workflow state file for a feature.
 * Writes atomically: write to .tmp file first, then fs.renameSync to actual path.
 * MUST fail gracefully — never throws.
 *
 * @param {string} feature - Feature name
 * @param {object} updates - Partial state to merge in
 */
function updateWorkflowState(feature, updates) {
  try {
    const config = getWorkflowConfig();
    const progressDir = config.progressDir || '.claude/progress';
    const featureDir = path.join(getRepoRoot(), progressDir, feature);
    const statePath = path.join(featureDir, 'workflow-state.json');
    const tmpPath = statePath + '.tmp';

    // Ensure feature directory exists
    fs.mkdirSync(featureDir, { recursive: true });

    // Read existing state or start fresh
    const existing = getWorkflowState(feature) || {};

    // Deep-merge updates into existing state
    const merged = deepMerge(existing, updates);

    // Atomic write: write to .tmp, then rename
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
    fs.renameSync(tmpPath, statePath);
  } catch {
    // Fail gracefully — never throw
  }
}

/**
 * Detect the active feature from git branch or progress directory scan.
 * Returns feature name string or null.
 *
 * Detection order:
 * 1. Git branch — matches work/<feature>/<task> or feature/<feature> patterns
 * 2. Progress dir scan — finds a feature with events.jsonl whose last event
 *    is NOT a session.end event (i.e. an active session)
 *
 * MUST fail gracefully — never throws.
 *
 * @returns {string|null}
 */
function getActiveFeature() {
  try {
    // Step 1: Try to detect from git branch
    try {
      const branch = execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (branch) {
        const config = getBranchingConfig();
        const workPrefix = config.workPrefix;
        const featurePrefix = config.featurePrefix;

        // work/<feature>/<task> pattern — second segment is the feature
        if (workPrefix && branch.startsWith(workPrefix + '/')) {
          const parts = branch.split('/');
          if (parts.length >= 3) {
            return parts[1];
          }
        }

        // feature/<feature> pattern — second segment is the feature
        if (featurePrefix && branch.startsWith(featurePrefix + '/')) {
          const parts = branch.split('/');
          if (parts.length >= 2 && parts[1]) {
            return parts[1];
          }
        }
      }
    } catch {
      // Branch detection failed — continue to progress dir scan
    }

    // Step 2: Scan progress dir for active features
    try {
      const config = getWorkflowConfig();
      const progressDir = config.progressDir || '.claude/progress';
      const absProgressDir = path.join(getRepoRoot(), progressDir);

      if (!fs.existsSync(absProgressDir)) {
        return null;
      }

      const entries = fs.readdirSync(absProgressDir, { withFileTypes: true });

      const candidates = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const eventFile = path.join(absProgressDir, entry.name, 'events.jsonl');

        if (!fs.existsSync(eventFile)) continue;

        try {
          const raw = fs.readFileSync(eventFile, 'utf8');
          const lines = raw.split('\n').filter(Boolean);

          if (lines.length === 0) continue;

          // Check if the last event is NOT a session.end (meaning session still active)
          const lastLine = lines[lines.length - 1];
          const lastEvent = JSON.parse(lastLine);

          if (lastEvent.type !== 'session.end') {
            candidates.push({ name: entry.name, ts: lastEvent.ts || '' });
          }
        } catch {
          // Malformed events file — skip this feature
          continue;
        }
      }

      // Sort by timestamp descending, return most recent
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
        return candidates[0].name;
      }
    } catch {
      // Progress dir scan failed
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sentinel file helpers
// ---------------------------------------------------------------------------

const SENTINEL_FILENAME = '.workflow-active';

/**
 * Check if the workflow sentinel file exists.
 * Fast check via fs.existsSync — ~0.1ms.
 *
 * @returns {boolean}
 */
function isSentinelActive() {
  try {
    const sentinelPath = path.join(getRepoRoot(), '.claude', SENTINEL_FILENAME);
    return fs.existsSync(sentinelPath);
  } catch {
    return false;
  }
}

/**
 * Read and parse the sentinel file.
 * Returns the parsed JSON object or null if absent/invalid.
 * Detects stale sentinels (>24h old with dead process).
 *
 * @returns {object|null}
 */
function readSentinel() {
  try {
    const sentinelPath = path.join(getRepoRoot(), '.claude', SENTINEL_FILENAME);
    if (!fs.existsSync(sentinelPath)) return null;

    const raw = fs.readFileSync(sentinelPath, 'utf8');
    const sentinel = JSON.parse(raw);

    // Stale detection: >24h old AND process dead
    if (sentinel.startedAt && sentinel.pid) {
      const age = Date.now() - new Date(sentinel.startedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        try {
          process.kill(sentinel.pid, 0);
        } catch {
          // Process dead + over 24h = stale
          return null;
        }
      }
    }

    return sentinel;
  } catch {
    return null;
  }
}

/**
 * Write the sentinel file atomically.
 *
 * @param {object} data - Sentinel data (ticket, feature, startedAt, sessionId, pid, mode)
 */
function writeSentinel(data) {
  try {
    const claudeDir = path.join(getRepoRoot(), '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const sentinelPath = path.join(claudeDir, SENTINEL_FILENAME);
    const tmpPath = sentinelPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, sentinelPath);
  } catch {
    // Best effort
  }
}

/**
 * Remove the sentinel file.
 */
function removeSentinel() {
  try {
    const sentinelPath = path.join(getRepoRoot(), '.claude', SENTINEL_FILENAME);
    if (fs.existsSync(sentinelPath)) {
      fs.unlinkSync(sentinelPath);
    }
  } catch {
    // Best effort
  }
}

// ---------------------------------------------------------------------------
// Ticket module integration
// ---------------------------------------------------------------------------

let _ticketModule = null;

/**
 * Lazily load and return the ticket module.
 * Returns null if the module is not available.
 */
function getTicketModule() {
  if (_ticketModule !== null) return _ticketModule;
  try {
    _ticketModule = require('./ticket.js');
  } catch {
    _ticketModule = false; // Mark as unavailable
  }
  return _ticketModule || null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  BRANCHING_DEFAULTS,
  GUARDS_DEFAULTS,
  getRepoRoot,
  getWorkflowConfig,
  getBranchingConfig,
  getGuardsConfig,
  isProtectedBranch,
  isFeatureBranch,
  isWorkBranch,
  getEffectiveBranch,
  getWorkflowState,
  updateWorkflowState,
  getActiveFeature,
  // Sentinel helpers
  isSentinelActive,
  readSentinel,
  writeSentinel,
  removeSentinel,
  // Ticket integration
  getTicketModule
};
