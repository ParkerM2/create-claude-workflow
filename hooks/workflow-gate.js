#!/usr/bin/env node
'use strict';

// PreToolUse hook: Enforce workflow phase gates before agent spawning.
// Blocks Task tool calls when prerequisite gates haven't passed.
// Respects guards.workflowGate setting (disabled = always allow).
// Fail-open design: any internal error = allow the operation.

const { getGuardsConfig, getWorkflowState, getActiveFeature } = require('./config.js');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Check if workflow gate is enabled
    const guards = getGuardsConfig();
    if (!guards.workflowGate) {
      process.exit(0);
    }

    // Get active feature — if none, not in a workflow, allow
    const feature = getActiveFeature();
    if (!feature) {
      process.exit(0);
    }

    // Read workflow state — if no state file, allow (state tracking not initialized)
    const state = getWorkflowState(feature);
    if (!state) {
      process.exit(0);
    }

    const toolInput = data.tool_input || {};
    const description = (toolInput.description || '').toLowerCase();
    const prompt = toolInput.prompt || '';
    const teamName = toolInput.team_name || '';

    // If no team_name, or team_name doesn't match active feature: not a workflow spawn, allow
    if (!teamName || !teamName.includes(feature)) {
      process.exit(0);
    }

    // Determine agent type

    // QA agent: description or prompt contains QA keywords
    const isQA = /qa[\s-]?review|qa-task|qa-reviewer/i.test(description) ||
                 /qa[\s-]?review|qa-task|qa-reviewer/i.test(prompt);

    // Guardian agent: description or prompt contains Guardian keywords
    const isGuardian = /guardian/i.test(description) || /guardian/i.test(prompt);

    // Research/explore agent: contains explore/plan/research/search/general-purpose
    // keywords BUT NOT implementation keywords
    const implementKeywords = /implement|coding|build|create|engineer/i;
    const exploreKeywords = /explore|plan|research|search|general-purpose/i;
    const isResearch = (exploreKeywords.test(description) ||
                        exploreKeywords.test(toolInput.subagent_type || '')) &&
                       !implementKeywords.test(description);

    // QA and research agents always allowed
    if (isQA || isResearch) {
      process.exit(0);
    }

    // Guardian agents: require phase === 'guardian' or 'done'
    if (isGuardian) {
      if (state.phase !== 'guardian' && state.phase !== 'done') {
        const result = {
          decision: 'block',
          reason: 'Workflow gate: Cannot spawn Guardian — phase is "' + (state.phase || 'unknown') + '", must be "guardian" or "done". Complete all waves first.',
        };
        process.stdout.write(JSON.stringify(result));
        process.exit(0);
      }
      process.exit(0);
    }

    // Coding agents (anything else with matching team_name): require setupComplete
    if (!state.setupComplete) {
      const result = {
        decision: 'block',
        reason: 'Workflow gate: Cannot spawn coding agents — setup not complete. Create the feature branch, team, and tasks first, then emit checkpoint "setup-complete".',
      };
      process.stdout.write(JSON.stringify(result));
      process.exit(0);
    }

    process.exit(0);
  } catch {
    // On any error, allow the operation (fail open)
    process.exit(0);
  }
});
