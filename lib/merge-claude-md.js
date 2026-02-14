'use strict';

const fs = require('fs');

const BEGIN_SENTINEL = '<!-- BEGIN: claude-workflow -->';
const END_SENTINEL = '<!-- END: claude-workflow -->';

/**
 * Merge workflow section into CLAUDE.md content.
 * - If sentinels exist: replace the section between them.
 * - If not: append after a --- separator.
 */
function mergeClaudeMd(existingContent, workflowSection) {
  const block = `${BEGIN_SENTINEL}\n${workflowSection}\n${END_SENTINEL}`;

  if (existingContent.includes(BEGIN_SENTINEL)) {
    // Replace existing section
    const regex = new RegExp(
      escapeRegex(BEGIN_SENTINEL) + '[\\s\\S]*?' + escapeRegex(END_SENTINEL),
      'm'
    );
    return existingContent.replace(regex, block);
  }

  // Append with separator
  const separator = existingContent.trimEnd().endsWith('---') ? '' : '\n\n---\n';
  return existingContent.trimEnd() + separator + '\n\n' + block + '\n';
}

/**
 * Generate the workflow section content.
 */
function generateWorkflowSection(variables) {
  const progressDir = variables.PROGRESS_DIR || 'docs/progress';
  const projectRulesFile = variables.PROJECT_RULES_FILE || 'CLAUDE.md';
  const architectureFile = variables.ARCHITECTURE_FILE || 'docs/ARCHITECTURE.md';

  return `## Claude Workflow

**Workflow Mode**: standard

### Agent Scopes

> Agent scopes are defined in \`.claude/agents/*.md\`. Each agent has an explicit file scope.

### Restricted Files

> Files that should not be modified by agents without explicit approval:
> - ${projectRulesFile}
> - ${architectureFile}
> - package.json / package-lock.json

### Progress Directory

All progress files, design docs, and performance logs are stored in \`${progressDir}/\`.

### Quick Reference

| Command | Purpose |
|---------|---------|
| \`/implement-feature\` | Full orchestration workflow |
| \`/create-feature-plan\` | Deep technical planning |
| \`/claude-new\` | Create any artifact (feature, task, plan, agent, idea) |
| \`/resume-feature\` | Resume from crash/pause |
| \`/status\` | Show feature progress |
| \`/hotfix\` | Urgent single-agent fix |
| \`/review-pr\` | QA + Guardian on a PR |
| \`/generate-tests\` | Focused test generation |
| \`/refactor\` | Safe restructuring |
| \`/scaffold-agent\` | Create new agent |
| \`/audit-agents\` | Check agent scopes |
| \`/discover-agents\` | Auto-detect stack + generate agents |`;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { mergeClaudeMd, generateWorkflowSection, BEGIN_SENTINEL, END_SENTINEL };
