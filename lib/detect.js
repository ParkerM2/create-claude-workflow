'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detection result shape:
 * {
 *   claudeMd: { exists: bool, path: string|null, hasWorkflowSection: bool },
 *   claudeDir: { exists: bool, commands: string[], agents: string[], prompts: string[], settings: object|null },
 *   previousInstall: bool,
 *   existingAgents: string[],
 *   gitRepo: bool
 * }
 */

function detect(projectRoot) {
  return {
    claudeMd: detectClaudeMd(projectRoot),
    claudeDir: detectClaudeDir(projectRoot),
    previousInstall: detectPreviousInstall(projectRoot),
    existingAgents: listAgentNames(projectRoot),
    gitRepo: fs.existsSync(path.join(projectRoot, '.git')),
  };
}

function detectClaudeMd(projectRoot) {
  const variants = ['CLAUDE.md', 'claude.md', '.claude.md'];
  for (const name of variants) {
    const fullPath = path.join(projectRoot, name);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return {
        exists: true,
        path: fullPath,
        hasWorkflowSection: content.includes('<!-- BEGIN: claude-workflow -->'),
      };
    }
  }
  return { exists: false, path: null, hasWorkflowSection: false };
}

function detectClaudeDir(projectRoot) {
  const claudeDir = path.join(projectRoot, '.claude');
  if (!fs.existsSync(claudeDir)) {
    return { exists: false, commands: [], agents: [], prompts: [], settings: null };
  }

  const commands = listMdFiles(path.join(claudeDir, 'commands'));
  const agents = listMdFiles(path.join(claudeDir, 'agents'));
  const prompts = listMdFiles(path.join(claudeDir, 'prompts'));

  let settings = null;
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = null;
    }
  }

  return { exists: true, commands, agents, prompts, settings };
}

function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { recursive: true })
      .filter((f) => typeof f === 'string' && f.endsWith('.md'))
      .map((f) => f.replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

function detectPreviousInstall(projectRoot) {
  // Check for files unique to our workflow
  const markers = [
    path.join(projectRoot, '.claude', 'agents', 'team-leader.md'),
    path.join(projectRoot, '.claude', 'prompts', 'implementing-features', 'README.md'),
    path.join(projectRoot, '.claude', 'commands', 'implement-feature.md'),
  ];
  return markers.some((m) => fs.existsSync(m));
}

function listAgentNames(projectRoot) {
  const agentsDir = path.join(projectRoot, '.claude', 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
}

module.exports = { detect };
