#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getRepoRoot, getWorkflowConfig, BRANCHING_DEFAULTS } = require('./config.js');

// Compute plugin root from this script's location
const PLUGIN_ROOT = path.resolve(__dirname, '..');

// Read project config (using repo-root-aware reader)
const fullConfig = getWorkflowConfig();
const config = {
  projectRulesFile: fullConfig.projectRulesFile || 'CLAUDE.md',
  architectureFile: fullConfig.architectureFile || 'docs/ARCHITECTURE.md',
  progressDir: fullConfig.progressDir || '.claude/progress'
};
const branching = fullConfig.branching || { ...BRANCHING_DEFAULTS };

// Determine config status
let configStatus = 'using defaults — run /workflow-setup to customize';
try {
  const configPath = path.join(getRepoRoot(), '.claude', 'workflow.json');
  fs.accessSync(configPath, fs.constants.R_OK);
  configStatus = 'configured via .claude/workflow.json';
} catch {
  // No config file — use defaults
}

// Read the bootstrap skill content
let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(PLUGIN_ROOT, 'skills', 'using-workflow', 'SKILL.md'),
    'utf8'
  );
} catch {
  skillContent = 'claude-workflow plugin is active but bootstrap skill not found.';
}

// Build the context to inject
const isolation = branching.useWorktrees ? 'worktrees' : 'shared-directory';
const configBlock = [
  '<workflow-config>',
  `claude-workflow plugin is active (${configStatus}).`,
  '',
  'Project paths:',
  `- Project rules file: ${config.projectRulesFile}`,
  `- Architecture file: ${config.architectureFile}`,
  `- Progress directory: ${config.progressDir}`,
  `- Plugin root: ${PLUGIN_ROOT}`,
  '',
  'Branching configuration:',
  `- Base branch: ${branching.baseBranch}`,
  `- Feature prefix: ${branching.featurePrefix || '(none)'}`,
  `- Work prefix: ${branching.workPrefix || '(none)'}`,
  `- Enforcement: ${branching.enforce}`,
  `- Protected branches: ${JSON.stringify(branching.protectedBranches)}`,
  `- Agent isolation: ${isolation}`,
  `- Worktree directory: ${branching.worktreeDir}`,
  '',
  'When workflow commands or agents reference "the project rules file", "the architecture file",',
  'or "the progress directory", use the paths above. When they reference prompt files or agent',
  'definitions from the plugin, look under the plugin root path.',
  '',
  'Branch rules are guidelines, not permanent. If the user asks to change enforcement',
  '(e.g., "allow commits on main", "lower branch rules"), update .claude/workflow.json.',
  '</workflow-config>'
].join('\n');

// Check if a workflow is actively running (sentinel file exists)
// If so, inject a reminder that this session is a team-leader orchestrating agents
let activeWorkflowNotice = '';
try {
  const { isSentinelActive, readSentinel } = require('./config.js');
  if (isSentinelActive()) {
    const sentinel = readSentinel();
    if (sentinel) {
      activeWorkflowNotice = [
        '',
        '<active-workflow-notice>',
        '⚠️  A MULTI-AGENT WORKFLOW IS CURRENTLY ACTIVE.',
        '',
        `Feature: ${sentinel.feature}`,
        `Ticket: ${sentinel.ticket || 'unknown'}`,
        `Started: ${sentinel.startedAt}`,
        `Mode: ${sentinel.mode || 'strict'}`,
        '',
        'You are the TEAM LEADER for this workflow.',
        'You do NOT write application code — you orchestrate agents who do.',
        '',
        'If you just started or resumed this session:',
        '1. Read agents/team-leader.md for your full protocol',
        '2. Read .claude/progress/' + (sentinel.feature || '<feature>') + '/workflow-state.json for current phase',
        '3. Read the team config to find your agents',
        '4. Continue from your current phase — do NOT restart',
        '',
        'If agents are working (phase = "wave"):',
        '- WAIT for agent messages — they arrive as new conversation turns',
        '- Do NOT write code, do NOT start new tasks',
        '- When agents message you, handle per the workflow protocol',
        '</active-workflow-notice>'
      ].join('\n');
    }
  }
} catch { /* sentinel check failed — skip notice */ }

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: configBlock + '\n\n' + skillContent + activeWorkflowNotice
  }
};

process.stdout.write(JSON.stringify(output));
