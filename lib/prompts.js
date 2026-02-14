'use strict';

const { confirm, input } = require('@inquirer/prompts');

/**
 * Run the interactive installation prompts.
 * Returns user's configuration choices.
 */
async function runPrompts(detection) {
  console.log('');
  console.log('  create-claude-workflow');
  console.log('  =====================');
  console.log('');

  // Step 1: Show detection summary + confirm
  if (detection.claudeMd.exists) {
    console.log(`  Found: ${detection.claudeMd.path.split(/[\\/]/).pop()}`);
  }
  if (detection.claudeDir.exists) {
    console.log(`  Found: .claude/ directory (${detection.claudeDir.commands.length} commands, ${detection.claudeDir.agents.length} agents)`);
  }
  if (detection.previousInstall) {
    console.log('  Found: Previous installation (files will be backed up as .bak)');
  }
  if (detection.existingAgents.length > 0) {
    console.log(`  Found: ${detection.existingAgents.length} existing agent(s): ${detection.existingAgents.join(', ')}`);
  }
  console.log('');

  const proceed = await confirm({
    message: detection.previousInstall
      ? 'Update existing installation? (originals backed up as .bak)'
      : 'Install Claude workflow into this project?',
    default: true,
  });

  if (!proceed) {
    console.log('Installation cancelled.');
    process.exit(0);
  }

  // Step 2: Three variable questions
  const projectRulesFile = await input({
    message: 'Project rules file:',
    default: detection.claudeMd.exists
      ? detection.claudeMd.path.split(/[\\/]/).pop()
      : 'CLAUDE.md',
  });

  const architectureFile = await input({
    message: 'Architecture file:',
    default: 'docs/ARCHITECTURE.md',
  });

  const progressDir = await input({
    message: 'Progress directory:',
    default: 'docs/progress',
  });

  return {
    variables: {
      PROJECT_RULES_FILE: projectRulesFile,
      ARCHITECTURE_FILE: architectureFile,
      PROGRESS_DIR: progressDir,
    },
  };
}

module.exports = { runPrompts };
