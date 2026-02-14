'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load a template file and substitute variables.
 * Variables use {{VARIABLE_NAME}} syntax.
 */
function loadTemplate(templatePath, variables = {}) {
  const content = fs.readFileSync(templatePath, 'utf-8');
  return substituteVariables(content, variables);
}

/**
 * Replace all {{VARIABLE}} placeholders with values.
 */
function substituteVariables(content, variables) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

/**
 * Get the templates directory path (relative to this package).
 */
function getTemplatesDir() {
  return path.join(__dirname, '..', 'templates');
}

/**
 * List all template files recursively.
 * Returns array of { relativePath, absolutePath, targetPath }
 */
function listTemplates(templatesDir) {
  const results = [];
  walkDir(templatesDir, templatesDir, results);
  return results;
}

function walkDir(dir, baseDir, results) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, results);
    } else if (entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({
        relativePath,
        absolutePath: fullPath,
      });
    }
  }
}

/**
 * Map a template relative path to its target path in the project.
 * templates/commands/foo.md  -> .claude/commands/foo.md
 * templates/agents/foo.md    -> .claude/agents/foo.md
 * templates/prompts/foo.md   -> .claude/prompts/foo.md
 * templates/docs/foo.md      -> docs/foo.md
 */
function mapToTarget(relativePath, projectRoot) {
  if (relativePath.startsWith('commands/')) {
    return path.join(projectRoot, '.claude', relativePath);
  }
  if (relativePath.startsWith('agents/')) {
    return path.join(projectRoot, '.claude', relativePath);
  }
  if (relativePath.startsWith('prompts/')) {
    return path.join(projectRoot, '.claude', relativePath);
  }
  if (relativePath.startsWith('docs/')) {
    return path.join(projectRoot, relativePath);
  }
  // Fallback: place in project root
  return path.join(projectRoot, relativePath);
}

module.exports = { loadTemplate, substituteVariables, getTemplatesDir, listTemplates, mapToTarget };
