'use strict';

// v2: Agent protocol injection. Not called by the scaffolder in v1.
// Kept as a library for future use — the scaffolder will offer per-agent
// protocol injection when existing agent detection is more common.

const fs = require('fs');

const BEGIN_PROTOCOL = '<!-- BEGIN: claude-workflow-protocol -->';
const END_PROTOCOL = '<!-- END: claude-workflow-protocol -->';

/**
 * Generate the workflow protocol block to inject into agents.
 */
function generateProtocolBlock() {
  return `${BEGIN_PROTOCOL}

## Workflow Integration Protocol

### PHASE 0: Load Rules
Read these files COMPLETELY before starting work:
1. \`{{PROJECT_RULES_FILE}}\` — Project rules and conventions
2. \`{{ARCHITECTURE_FILE}}\` — System architecture
3. Your agent definition (this file)

### PHASE 1: Write Plan [BLOCKING]
Before ANY work, produce a written plan that includes:
1. Task summary — restate the task in your own words
2. Rules that apply — cite specific rules by section
3. Files to create/modify — exact paths
4. Step-by-step implementation order
5. Acceptance criteria verification

### PHASE 2: Execute
Follow your plan step by step. Commit when complete.

### PHASE 3: Self-Review
Verify your work against your Phase 1 plan before reporting completion.

### Error Recovery Protocol
When you encounter ANY error:
1. STOP — re-read your Phase 1 plan
2. Determine if the error is in scope
3. Max 2 fix attempts per error
4. Report unresolvable errors to the Team Leader

${END_PROTOCOL}`;
}

/**
 * Inject workflow protocol into an agent file.
 * Returns the modified content.
 */
function injectProtocol(content) {
  const block = generateProtocolBlock();

  // If protocol already exists, replace it
  if (content.includes(BEGIN_PROTOCOL)) {
    const regex = new RegExp(
      escapeRegex(BEGIN_PROTOCOL) + '[\\s\\S]*?' + escapeRegex(END_PROTOCOL),
      'm'
    );
    return content.replace(regex, block);
  }

  // Find injection point: after ## Identity section, or after first ---, or at end
  const identityMatch = content.match(/^## Identity\b.*$/m);
  if (identityMatch) {
    // Find the next ## heading after Identity
    const identityIndex = content.indexOf(identityMatch[0]);
    const afterIdentity = content.substring(identityIndex + identityMatch[0].length);
    const nextHeading = afterIdentity.match(/^## /m);
    if (nextHeading) {
      const insertIndex = identityIndex + identityMatch[0].length + nextHeading.index;
      return content.substring(0, insertIndex) + '\n' + block + '\n\n' + content.substring(insertIndex);
    }
  }

  // Fallback: after first ---
  const hrIndex = content.indexOf('\n---\n');
  if (hrIndex !== -1) {
    const insertAt = hrIndex + 5;
    return content.substring(0, insertAt) + '\n' + block + '\n' + content.substring(insertAt);
  }

  // Last resort: append at end
  return content.trimEnd() + '\n\n' + block + '\n';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { injectProtocol, generateProtocolBlock, BEGIN_PROTOCOL, END_PROTOCOL };
