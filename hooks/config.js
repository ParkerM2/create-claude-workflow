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
  configGuard: true
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
 */
function isWorkBranch(name, config) {
  if (!name || !config) return false;
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
  getEffectiveBranch
};
