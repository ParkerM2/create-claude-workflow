'use strict';

const path = require('path');
const fs = require('fs');
const { detect } = require('./detect');
const { runPrompts } = require('./prompts');
const { loadTemplate, getTemplatesDir, listTemplates, mapToTarget } = require('./templates');
const { mergeClaudeMd, generateWorkflowSection } = require('./merge-claude-md');
const { writeFile } = require('./merge-file');

/**
 * Main init flow: detect → prompt → install
 */
async function init(projectRoot) {
  console.log('');

  // Phase 1: Detect project state
  const detection = detect(projectRoot);

  // Phase 2: Interactive prompts
  const config = await runPrompts(detection);
  const { variables } = config;

  // Phase 3: Install templates
  const results = { created: [], updated: [], skipped: [], errors: [] };
  const force = detection.previousInstall;

  const templatesDir = getTemplatesDir();
  const templates = listTemplates(templatesDir);

  for (const template of templates) {
    const targetPath = mapToTarget(template.relativePath, projectRoot);
    try {
      const content = loadTemplate(template.absolutePath, variables);
      const result = writeFile(targetPath, content, { backup: true, force });

      if (result === 'conflict') {
        results.skipped.push(targetPath);
      } else {
        results[result === 'created' ? 'created' : result === 'updated' ? 'updated' : 'skipped'].push(targetPath);
      }
    } catch (err) {
      results.errors.push({ path: targetPath, error: err.message });
    }
  }

  // Create progress directory
  const progressDirPath = path.join(projectRoot, variables.PROGRESS_DIR);
  if (!fs.existsSync(progressDirPath)) {
    fs.mkdirSync(progressDirPath, { recursive: true });
    console.log(`  Created: ${variables.PROGRESS_DIR}/`);
  }

  // Merge workflow section into CLAUDE.md
  handleClaudeMd(projectRoot, detection, variables, results);

  // Install hook configuration into .claude/settings.json
  handleHooksSettings(projectRoot, results);

  // Summary
  printSummary(results);
}

function handleClaudeMd(projectRoot, detection, variables, results) {
  const workflowSection = generateWorkflowSection(variables);

  if (detection.claudeMd.exists) {
    const existing = fs.readFileSync(detection.claudeMd.path, 'utf-8');
    const merged = mergeClaudeMd(existing, workflowSection);
    writeFile(detection.claudeMd.path, merged, { backup: true, force: true });
    results.updated.push(detection.claudeMd.path);
    console.log(`  Updated: ${path.basename(detection.claudeMd.path)} (workflow section merged)`);
  } else {
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const content = `# Project Rules\n\n> Add your project-specific rules and conventions here.\n\n---\n\n${mergeClaudeMd('', workflowSection).trim()}\n`;
    writeFile(claudeMdPath, content);
    results.created.push(claudeMdPath);
    console.log('  Created: CLAUDE.md (with workflow section)');
  }
}

function handleHooksSettings(projectRoot, results) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      // If settings.json is corrupt, start fresh
      settings = {};
    }
  }

  const hooksConfig = {
    PreToolUse: [
      { matcher: 'Bash', hooks: [
        { type: 'command', command: 'node .claude/hooks/branch-guard.js', timeout: 10 },
        { type: 'command', command: 'node .claude/hooks/destructive-guard.js', timeout: 10 },
      ]},
      { matcher: 'Edit', hooks: [
        { type: 'command', command: 'node .claude/hooks/config-guard.js', timeout: 10 },
      ]},
      { matcher: 'Write', hooks: [
        { type: 'command', command: 'node .claude/hooks/config-guard.js', timeout: 10 },
      ]},
    ],
    PostToolUse: [
      { matcher: 'Edit', hooks: [
        { type: 'command', command: 'node .claude/hooks/activity-logger.js', timeout: 10, async: true },
      ]},
      { matcher: 'Write', hooks: [
        { type: 'command', command: 'node .claude/hooks/activity-logger.js', timeout: 10, async: true },
      ]},
    ],
  };

  settings.hooks = hooksConfig;
  writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', { backup: true, force: true });
  results.updated.push(settingsPath);
  console.log('  Updated: .claude/settings.json (workflow hooks configured)');
}

function printSummary(results) {
  console.log('');
  console.log('  Done!');
  console.log('  =====');
  console.log(`    Created:  ${results.created.length} files`);
  console.log(`    Updated:  ${results.updated.length} files`);
  console.log(`    Skipped:  ${results.skipped.length} files`);

  if (results.errors.length > 0) {
    console.log(`    Errors:   ${results.errors.length}`);
    for (const err of results.errors) {
      console.log(`      - ${err.path}: ${err.error}`);
    }
  }

  console.log('');
  console.log('  Next steps:');
  console.log('    1. /discover-agents — auto-detect your stack and generate agents');
  console.log('    2. /implement-feature "your feature" — start building');
  console.log('');
}

module.exports = { init };
