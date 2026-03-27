#!/usr/bin/env node
'use strict';

// SessionStart hook (compact matcher): Re-injects critical workflow context
// after context compaction.
//
// When a workflow is ACTIVE (sentinel file exists), this reinjects:
//   1. Team-leader identity and coordination rules
//   2. Current workflow phase and state
//   3. Active team info (name, leader name, agents)
//   4. Explicit "you are WAITING — do NOT write code" instruction
//   5. Recovery steps to re-orient
//
// When no workflow is active, injects only the generic phase protocol.

const fs = require('fs');
const path = require('path');
const { getRepoRoot, getActiveFeature, getWorkflowState, isSentinelActive, readSentinel } = require('./config.js');

try {
  const PLUGIN_ROOT = path.resolve(__dirname, '..');
  const repoRoot = getRepoRoot();

  // Check if a workflow is actively running (sentinel file exists)
  const sentinel = readSentinel();
  const feature = sentinel ? sentinel.feature : getActiveFeature();
  const isWorkflowActive = !!sentinel;

  // Read workflow state
  let state = feature ? getWorkflowState(feature) : null;
  if (feature && !state) {
    try {
      const { rebuildState } = require('./tracker.js');
      state = rebuildState(feature);
    } catch { /* best-effort rebuild */ }
  }

  // ---------------------------------------------------------------------------
  // ACTIVE WORKFLOW — Full team-leader identity reinject
  // ---------------------------------------------------------------------------
  if (isWorkflowActive && state) {
    // Try to read team config for leader name and active agents
    let teamLeaderName = 'unknown';
    let activeAgents = [];
    const teamName = sentinel.ticket || feature;

    try {
      const teamConfigPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.claude', 'teams', teamName, 'config.json'
      );
      if (fs.existsSync(teamConfigPath)) {
        const teamConfig = JSON.parse(fs.readFileSync(teamConfigPath, 'utf8'));
        if (teamConfig.members && Array.isArray(teamConfig.members)) {
          // Find the leader (first member, or the one that isn't a spawned agent)
          for (const member of teamConfig.members) {
            if (member.agentType === 'team-leader' || member.name === teamConfig.leader) {
              teamLeaderName = member.name;
            } else {
              activeAgents.push(member.name);
            }
          }
          // If no explicit leader type, first member is usually the leader
          if (teamLeaderName === 'unknown' && teamConfig.members.length > 0) {
            teamLeaderName = teamConfig.members[0].name;
            activeAgents = teamConfig.members.slice(1).map(m => m.name);
          }
        }
      }
    } catch { /* team config not readable — use defaults */ }

    // Read task files to understand current work
    let taskSummary = '';
    try {
      const progressDir = path.join(repoRoot, '.claude', 'progress', teamName, 'tasks');
      if (fs.existsSync(progressDir)) {
        const taskFiles = fs.readdirSync(progressDir).filter(f => f.endsWith('.md')).sort();
        const tasks = [];
        for (const tf of taskFiles) {
          try {
            const content = fs.readFileSync(path.join(progressDir, tf), 'utf8');
            const nameMatch = content.match(/taskName:\s*"?([^"\n]+)"?/);
            const statusMatch = content.match(/status:\s*"?([^"\n]+)"?/);
            const taskNum = tf.match(/task-(\d+)/);
            if (taskNum) {
              tasks.push(`  - Task #${taskNum[1]}: ${nameMatch ? nameMatch[1].trim() : '?'} [${statusMatch ? statusMatch[1].trim() : 'pending'}]`);
            }
          } catch { /* skip unreadable task files */ }
        }
        if (tasks.length > 0) {
          taskSummary = '\n## Active Tasks\n' + tasks.join('\n');
        }
      }
    } catch { /* best-effort task reading */ }

    // Determine what the leader should be doing right now
    let currentAction = '';
    switch (state.phase) {
      case 'plan':
        currentAction = 'You are in the PLAN phase. Read the design doc and task files.';
        break;
      case 'setup':
        currentAction = 'You are in the SETUP phase. Create team, set up tasks, prepare to spawn agents.';
        break;
      case 'wave':
        currentAction = 'You are in the WAVE EXECUTION phase. You have spawned agents. WAIT for their messages via SendMessage. Do NOT write application code. When agents message you with completion or QA results, handle them per the workflow protocol.';
        break;
      case 'guardian':
        currentAction = 'You are in the GUARDIAN phase. Spawn or wait for the Codebase Guardian verdict.';
        break;
      case 'done':
        currentAction = 'The workflow is COMPLETE. Clean up and report to user.';
        break;
      default:
        currentAction = 'Read workflow-state.json to determine your current phase.';
    }

    const contextString = [
      '<workflow-recovery>',
      '══════════════════════════════════════════════════════════════',
      'CONTEXT WAS COMPACTED — TEAM LEADER IDENTITY RESTORED',
      '══════════════════════════════════════════════════════════════',
      '',
      '## WHO YOU ARE',
      '',
      'You are the TEAM LEADER. You orchestrate a multi-agent feature implementation.',
      'You do NOT write application code — you spawn agents who do.',
      '',
      `Your name (for SendMessage): "${teamLeaderName}"`,
      `Team name: "${teamName}"`,
      `Feature: ${feature}`,
      `Mode: ${sentinel.mode || state.mode || 'strict'}`,
      '',
      '## YOUR COORDINATION RULES (non-negotiable)',
      '',
      '1. Never write application code — you orchestrate, agents implement',
      '2. Never skip the progress file — crash-recovery artifact',
      '3. Never merge without QA PASS',
      '4. Never run parallel merges — one at a time',
      '5. Always rebase before merge',
      '6. Always delete merged workbranches',
      '7. Always use thin spawn templates from THIN-SPAWN-TEMPLATE.md',
      '8. Always read agents/team-leader.md first (Step 0)',
      '9. Always check context budget before spawning',
      '10. Always use QA auto-fill for checklists',
      '11. Always emit checkpoint events',
      '',
      '## CURRENT STATE',
      '',
      `Phase: **${state.phase || 'unknown'}**`,
      `Wave: ${state.currentWave || 0} of ${state.totalWaves || '?'}`,
      `Setup complete: ${state.setupComplete ? 'YES' : 'NO'}`,
      `Guardian passed: ${state.guardianPassed ? 'YES' : 'NO'}`,
      '',
      `**${currentAction}**`,
      '',
      activeAgents.length > 0
        ? '## ACTIVE AGENTS\n\nThese agents may send you messages via SendMessage:\n' + activeAgents.map(a => `  - ${a}`).join('\n')
        : '## AGENTS\n\nNo active agents detected in team config. Check ~/.claude/teams/' + teamName + '/config.json',
      taskSummary,
      '',
      '## WHAT TO DO NOW',
      '',
      state.phase === 'wave'
        ? [
            '1. You are WAITING for agent messages. They arrive as new conversation turns.',
            '2. Do NOT write application code yourself.',
            '3. When a coding agent messages "Task #N complete":',
            '   → Notify the paired QA agent: SendMessage(to: "qa-task-N", message: "Code ready for review.")',
            '4. When a QA agent messages "QA PASS":',
            '   → Emit qa.passed → rebase → merge → cleanup → shutdown agents',
            '5. When a QA agent messages "QA FAIL":',
            '   → Forward issues to coder → wait for fix → spawn new QA',
            '6. If unsure about state, read:',
            `   - .claude/progress/${feature}/workflow-state.json`,
            `   - .claude/progress/${feature}/current.md`,
            '   - ~/.claude/teams/' + teamName + '/config.json'
          ].join('\n')
        : [
            '1. Read your current state files:',
            `   - .claude/progress/${feature}/workflow-state.json`,
            `   - .claude/progress/${feature}/current.md`,
            '2. Read the command file for your current workflow:',
            '   - commands/agent-team.md',
            '3. Continue from your current phase — do NOT restart from the beginning',
            '4. The hooks WILL block you if you try to skip phases'
          ].join('\n'),
      '',
      '## KEY FILES',
      '',
      '- Workflow command: commands/agent-team.md',
      '- Agent definition: agents/team-leader.md',
      '- Spawn templates: prompts/implementing-features/THIN-SPAWN-TEMPLATE.md',
      '- Agent phases: prompts/implementing-features/AGENT-WORKFLOW-PHASES.md',
      `- Progress: .claude/progress/${feature}/`,
      `- Team config: ~/.claude/teams/${teamName}/config.json`,
      '',
      '</workflow-recovery>'
    ].join('\n');

    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: contextString
      }
    };
    process.stdout.write(JSON.stringify(output));

  // ---------------------------------------------------------------------------
  // NO ACTIVE WORKFLOW — Generic phase protocol reinject (original behavior)
  // ---------------------------------------------------------------------------
  } else {
    const protocolPath = path.join(PLUGIN_ROOT, 'prompts', 'implementing-features', 'PHASE-GATE-PROTOCOL.md');
    let protocolContent = '';
    try { protocolContent = fs.readFileSync(protocolPath, 'utf8'); } catch { protocolContent = '(Phase Gate Protocol file not found)'; }

    const contextString = [
      '<workflow-enforcement>',
      'CONTEXT WAS COMPACTED — Workflow rules re-injected.',
      '',
      protocolContent,
      '',
      '## Current Workflow State',
      `Feature: ${feature || 'No active feature detected'}`,
      `Phase: ${state && state.phase ? state.phase : 'unknown'}`,
      `State: ${state ? JSON.stringify(state, null, 2) : 'No workflow state file found'}`,
      '',
      'If you are in the middle of a workflow:',
      '1. Read .claude/progress/<feature>/workflow-state.json for current phase',
      '2. Continue from your current phase — do NOT restart from the beginning',
      '3. The hooks WILL block you if you try to skip phases',
      '</workflow-enforcement>'
    ].join('\n');

    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: contextString
      }
    };
    process.stdout.write(JSON.stringify(output));
  }

} catch {
  // Fail silently — never crash the hook
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: ''
    }
  };
  process.stdout.write(JSON.stringify(output));
}
