#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Compute plugin root from this script's location
const PLUGIN_ROOT = path.resolve(__dirname, '..');

// Read project config or use defaults
const configPath = path.join(process.cwd(), '.claude', 'workflow.json');
let config = {
  projectRulesFile: 'CLAUDE.md',
  architectureFile: 'docs/ARCHITECTURE.md',
  progressDir: 'docs/progress'
};
let configStatus = 'using defaults — run /workflow-setup to customize';

try {
  const raw = fs.readFileSync(configPath, 'utf8');
  const userConfig = JSON.parse(raw);
  config = { ...config, ...userConfig };
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
  'When workflow commands or agents reference "the project rules file", "the architecture file",',
  'or "the progress directory", use the paths above. When they reference prompt files or agent',
  'definitions from the plugin, look under the plugin root path.',
  '</workflow-config>'
].join('\n');

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: configBlock + '\n\n' + skillContent
  }
};

process.stdout.write(JSON.stringify(output));
