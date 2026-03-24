#!/usr/bin/env node
'use strict';

// PreToolUse hook: Enforce workflow phase gates before agent spawning.
// Blocks Task tool calls when prerequisite gates haven't passed.
// Respects guards.workflowGate setting (disabled = always allow).
// V2: Prompt content validation — coding agents must include required template markers.
// V5: Classification hardening — dual signal for QA/Guardian, fail-CLOSED catch block.

const { getGuardsConfig, getWorkflowState, getActiveFeature } = require('./config.js');

// V2: Required structural markers for coding agent spawn prompts
const CODING_MARKERS = [
  { pattern: /MANDATORY PHASED WORKFLOW/i, label: 'Phased workflow header' },
  { pattern: /PHASE 0:.*LOAD RULES/i, label: 'Phase 0' },
  { pattern: /PHASE 1:.*PLAN/i, label: 'Phase 1' },
  { pattern: /PHASE 2:.*EXECUTE/i, label: 'Phase 2' },
  { pattern: /PHASE 3:.*SELF.REVIEW/i, label: 'Phase 3' },
  { pattern: /PHASE 4:.*REPORT/i, label: 'Phase 4' },
  { pattern: /ERROR RECOVERY PROTOCOL/i, label: 'Error recovery' },
  { pattern: /Acceptance Criteria/i, label: 'Acceptance criteria' },
  { pattern: /QA Checklist/i, label: 'QA checklist' },
  { pattern: /Rules That Apply/i, label: 'Pre-digested rules' },
  { pattern: /SendMessage/i, label: 'SendMessage instructions' },
];
const MIN_CODING_MARKERS = 8;
const MIN_PROMPT_LENGTH = 2000;

// V2: Required structural markers for Guardian agent spawn prompts
const GUARDIAN_MARKERS = [
  { pattern: /Codebase Guardian/i, label: 'Guardian identity' },
  { pattern: /PHASE 0:.*LOAD RULES/i, label: 'Phase 0' },
  { pattern: /PHASE 1:.*CHECK PLAN/i, label: 'Phase 1' },
  { pattern: /PHASE 2:.*EXECUTE CHECKS/i, label: 'Phase 2' },
  { pattern: /PHASE 3:.*REPORT/i, label: 'Phase 3' },
  { pattern: /guardian-passed/i, label: 'Guardian checkpoint' },
];
const MIN_GUARDIAN_MARKERS = 5;

// V2: Validate coding agent prompt — returns null on pass, error string on fail
function validateCodingPrompt(prompt) {
  if (prompt.length < MIN_PROMPT_LENGTH) {
    return 'Workflow gate: Coding agent prompt too short (' + prompt.length + ' chars, minimum ' + MIN_PROMPT_LENGTH + '). Use the full Standard Coding Agent Spawn template.';
  }
  const missing = CODING_MARKERS.filter(m => !m.pattern.test(prompt)).map(m => m.label);
  if (missing.length > CODING_MARKERS.length - MIN_CODING_MARKERS) {
    return 'Workflow gate: Coding agent prompt missing required template sections (' +
      (CODING_MARKERS.length - missing.length) + '/' + CODING_MARKERS.length + ' markers found, ' +
      MIN_CODING_MARKERS + ' required). Missing: ' + missing.join(', ') + '. Use the full Standard Coding Agent Spawn template.';
  }
  return null;
}

// V2: Validate guardian agent prompt — returns null on pass, error string on fail
function validateGuardianPrompt(prompt) {
  const missing = GUARDIAN_MARKERS.filter(m => !m.pattern.test(prompt)).map(m => m.label);
  if (missing.length > GUARDIAN_MARKERS.length - MIN_GUARDIAN_MARKERS) {
    return 'Workflow gate: Guardian prompt missing required template sections (' +
      (GUARDIAN_MARKERS.length - missing.length) + '/' + GUARDIAN_MARKERS.length + ' markers found, ' +
      MIN_GUARDIAN_MARKERS + ' required). Missing: ' + missing.join(', ') + '. Use the Codebase Guardian Spawn template.';
  }
  return null;
}

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

    // V5: If no team_name, not a workflow spawn, allow.
    // If team_name doesn't match active feature, fall through to coding-agent gates
    // (do NOT exit/bypass — mismatched team_name is not a reason to skip enforcement).
    if (!teamName) {
      process.exit(0);
    }

    // Determine agent type

    // V5: QA agent — requires dual signal: naming pattern AND content marker
    const qaNameMatch = /qa[\s-]?review|qa-task|qa-reviewer/i.test(description);
    const qaContentMatch = /QA REPORT|VERDICT|Code Review/i.test(prompt);
    const isQA = qaNameMatch && qaContentMatch;

    // V5: Guardian agent — requires dual signal: naming pattern AND content marker
    const guardianNameMatch = /guardian/i.test(description);
    const guardianContentMatch = /Guardian Checks|File Placement|Module Completeness|guardian-passed/i.test(prompt);
    const isGuardian = guardianNameMatch && guardianContentMatch;

    // Research/explore agent: contains explore/plan/research/search/general-purpose
    // keywords BUT NOT implementation keywords
    const implementKeywords = /implement|coding|build|create|engineer/i;
    const exploreKeywords = /explore|plan|research|search|general-purpose/i;
    const isResearch = (exploreKeywords.test(description) ||
                        exploreKeywords.test(toolInput.subagent_type || '')) &&
                       !implementKeywords.test(description);

    // QA and research agents are exempt from prompt validation
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
      // V2: Validate guardian prompt
      const guardianError = validateGuardianPrompt(prompt);
      if (guardianError) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: guardianError }));
        process.exit(0);
      }
      process.exit(0);
    }

    // Coding agents (anything else with team_name set): require setupComplete
    if (!state.setupComplete) {
      const result = {
        decision: 'block',
        reason: 'Workflow gate: Cannot spawn coding agents — setup not complete. Create the feature branch, team, and tasks first, then emit checkpoint "setup-complete".',
      };
      process.stdout.write(JSON.stringify(result));
      process.exit(0);
    }

    // V2: Validate coding agent prompt after setupComplete check
    const codingError = validateCodingPrompt(prompt);
    if (codingError) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: codingError }));
      process.exit(0);
    }

    process.exit(0);
  } catch (err) {
    // V5: Fail-CLOSED — on any error, block the operation rather than allowing it
    const reason = 'Workflow gate: Internal error during validation — blocking as fail-safe. Error: ' + (err && err.message ? err.message : String(err));
    process.stdout.write(JSON.stringify({ decision: 'block', reason: reason }));
    process.exit(0);
  }
});
