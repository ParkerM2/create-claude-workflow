---
name: extract-context
description: "Capture ticket knowledge and technical context before it's lost"
---

# Extract Context Command

Captures and persists all valuable knowledge from ticket work: technical decisions, blockers, code patterns, gotchas, and cross-references. Saves to `.claude/progress/<ticket>/context-extract.md` and optionally to Confluence.

## Usage

```
/extract-context [TICKET_ID] [--confluence] [--memory] [--force]
```

**Options:**
- `TICKET_ID`: Jira ticket ID (e.g., PROJ-123). Auto-detect from git branch if omitted.
- `--confluence`: Also create/update Confluence page with extracted context
- `--memory`: Add key findings to memory system for future conversations
- `--force`: Overwrite existing context-extract.md without prompting

## Phase 1: Ticket Detection

```javascript
// Detect ticket ID from branch or user input
const detectTicketId = async (provided) => {
  if (provided) return provided;

  try {
    const branch = await exec('git rev-parse --abbrev-ref HEAD');
    const match = branch.match(/([A-Z]+-\d+)/);
    if (match) return match[1];
  } catch (e) {
    // Not in git repo or can't get branch
  }
  return null;
};

const ticketId = await detectTicketId(args[0]);
if (!ticketId) {
  console.error('❌ No ticket ID provided and could not detect from branch');
  console.log('Usage: /extract-context PROJ-123');
  return;
}

console.log(`\n📋 Extracting context for ${ticketId}...`);

// Load existing progress directory
const progressDir = `.claude/progress/${ticketId}`;
let existingData = {
  research: null,
  plans: null,
  tasks: null
};

try {
  if (fs.existsSync(progressDir)) {
    const files = fs.readdirSync(progressDir);
    if (files.includes('research.md')) {
      existingData.research = fs.readFileSync(
        `${progressDir}/research.md`, 'utf8'
      );
    }
    if (files.includes('plan.md')) {
      existingData.plans = fs.readFileSync(
        `${progressDir}/plan.md`, 'utf8'
      );
    }
    if (files.includes('tasks.md')) {
      existingData.tasks = fs.readFileSync(
        `${progressDir}/tasks.md`, 'utf8'
      );
    }
  }
  console.log('✓ Loaded existing progress data');
} catch (e) {
  console.log('ℹ️  No existing progress directory');
}
```

## Phase 2: Context Gathering

### Git Analysis
```javascript
const gatherGitContext = async (ticketId) => {
  console.log('\n🔍 Gathering git context...');

  try {
    const mainBranch = await exec('git rev-parse --abbrev-ref origin/HEAD');
    const baseBranch = mainBranch.split('/').pop().trim();

    // Get commits on this branch
    const commits = await exec(
      `git log ${baseBranch}..HEAD --pretty=format:"%h %s" --reverse`
    );

    // Get files changed
    const filesChanged = await exec(
      `git diff ${baseBranch}...HEAD --name-only`
    );

    // Get diff stats
    const diffStats = await exec(
      `git diff ${baseBranch}...HEAD --stat`
    );

    return {
      commits: commits.split('\n').filter(l => l),
      filesChanged: filesChanged.split('\n').filter(l => l),
      stats: diffStats,
      branchName: ticketId
    };
  } catch (e) {
    console.log('⚠️  Could not gather git context:', e.message);
    return null;
  }
};

const gitContext = await gatherGitContext(ticketId);
```

### Jira Integration
```javascript
const gatherJiraContext = async (ticketId) => {
  console.log('📊 Pulling Jira ticket...');

  try {
    const ticket = await atlassian.jira.searchIssues({
      jql: `key = ${ticketId}`,
      expand: ['changelog', 'changelog.histories']
    });

    if (!ticket.issues.length) {
      console.log(`⚠️  Ticket ${ticketId} not found`);
      return null;
    }

    const issue = ticket.issues[0];

    // Extract status history
    const statusHistory = issue.changelog.histories
      .map(h => {
        const statusChange = h.items.find(i => i.field === 'status');
        if (statusChange) {
          return {
            date: h.created,
            from: statusChange.fromString,
            to: statusChange.toString
          };
        }
      })
      .filter(Boolean);

    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName,
      created: issue.fields.created,
      updated: issue.fields.updated,
      comments: issue.fields.comment.comments.map(c => ({
        author: c.author.displayName,
        date: c.created,
        text: c.body
      })),
      statusHistory,
      customFields: issue.fields
    };
  } catch (e) {
    console.log('⚠️  Could not fetch Jira ticket:', e.message);
    return null;
  }
};

const jiraContext = await gatherJiraContext(ticketId);
```

### GitHub PR Integration
```javascript
const gatherGithubContext = async (ticketId) => {
  console.log('🐙 Looking for GitHub PR...');

  try {
    const prs = await github.repos.listPullRequests({
      head: ticketId,
      state: 'all'
    });

    if (!prs.length) {
      console.log('ℹ️  No GitHub PR found');
      return null;
    }

    const pr = prs[0];

    // Get review comments
    const reviews = await github.pulls.listReviews({
      pull_number: pr.number
    });

    return {
      number: pr.number,
      title: pr.title,
      description: pr.body,
      state: pr.state,
      url: pr.html_url,
      reviews: reviews.map(r => ({
        author: r.user.login,
        state: r.state,
        body: r.body
      })),
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      files: pr.changed_files
    };
  } catch (e) {
    console.log('⚠️  Could not fetch GitHub PR:', e.message);
    return null;
  }
};

const githubContext = await gatherGithubContext(ticketId);
```

### User Input
```javascript
const gatherUserContext = async () => {
  console.log('\n💬 Gathering additional context...\n');

  const responses = {};

  const questions = [
    'What were the main technical decisions made and why?',
    'What blockers were encountered and how were they resolved?',
    'What code patterns or techniques could be reused?',
    'What gotchas or surprising discoveries did you find?',
    'What dependencies or side effects does this work have?',
    'Anything else important to capture?'
  ];

  for (const question of questions) {
    const answer = await prompt(`${question}\n> `);
    if (answer.trim()) {
      responses[question] = answer.trim();
    }
  }

  return responses;
};

const userContext = await gatherUserContext();
```

## Phase 3: Knowledge Extraction

```javascript
const extractStructuredKnowledge = (gathered) => {
  const knowledge = {
    decisions: [],
    gotchas: [],
    patterns: [],
    dependencies: [],
    timeTracking: null
  };

  // Extract decisions from comments and PR reviews
  if (gathered.jira?.comments) {
    gathered.jira.comments.forEach(comment => {
      if (comment.text.toLowerCase().includes('decided') ||
          comment.text.toLowerCase().includes('decision')) {
        knowledge.decisions.push({
          source: 'Jira comment',
          author: comment.author,
          date: comment.date,
          text: comment.text.substring(0, 200)
        });
      }
    });
  }

  if (gathered.github?.reviews) {
    gathered.github.reviews.forEach(review => {
      if (review.body?.toLowerCase().includes('suggest') ||
          review.body?.toLowerCase().includes('approach')) {
        knowledge.decisions.push({
          source: 'GitHub review',
          author: review.author,
          text: review.body.substring(0, 200)
        });
      }
    });
  }

  // Extract gotchas from user input
  if (gathered.user?.['What gotchas']) {
    knowledge.gotchas.push({
      source: 'User input',
      text: gathered.user['What gotchas']
    });
  }

  // Extract patterns
  if (gathered.user?.['What code patterns']) {
    knowledge.patterns.push({
      source: 'User input',
      text: gathered.user['What code patterns']
    });
  }

  // Time estimation
  const created = new Date(gathered.jira?.created);
  const updated = new Date(gathered.jira?.updated);
  const daySpent = (updated - created) / (1000 * 60 * 60 * 24);
  knowledge.timeTracking = {
    daysSpent: daySpent.toFixed(1),
    workLog: gathered.jira?.workLog || null
  };

  return knowledge;
};

const knowledge = extractStructuredKnowledge({
  jira: jiraContext,
  github: githubContext,
  git: gitContext,
  existing: existingData,
  user: userContext
});
```

## Phase 4: Persistence

```javascript
const persistContext = async (ticketId, data, opts) => {
  console.log('\n💾 Persisting context...');

  // Create progress directory
  const progressDir = `.claude/progress/${ticketId}`;
  if (!fs.existsSync(progressDir)) {
    fs.mkdirSync(progressDir, { recursive: true });
  }

  const contextFile = `${progressDir}/context-extract.md`;

  // Check if file exists
  if (fs.existsSync(contextFile) && !opts.force) {
    const overwrite = await prompt(
      `context-extract.md already exists. Overwrite? (y/n): `
    );
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Skipped.');
      return;
    }
  }

  // Build markdown content
  const content = `# Context Extract: ${data.jira?.key || ticketId}

Generated: ${new Date().toISOString()}

## Summary

**Ticket**: ${data.jira?.key || ticketId}
**Status**: ${data.jira?.status || 'Unknown'}
**Assignee**: ${data.jira?.assignee || 'Unassigned'}

## Decisions Made

${data.knowledge.decisions.length ?
  data.knowledge.decisions.map(d =>
    `- **${d.source}** (${d.author || 'Unknown'}): ${d.text}`
  ).join('\n') :
  '(No decisions captured)'}

## Gotchas & Learnings

${data.knowledge.gotchas.length ?
  data.knowledge.gotchas.map(g => `- ${g.text}`).join('\n') :
  '(No gotchas captured)'}

## Reusable Patterns

${data.knowledge.patterns.length ?
  data.knowledge.patterns.map(p => `- ${p.text}`).join('\n') :
  '(No patterns captured)'}

## Dependencies & Side Effects

${data.user?.['dependencies'] || '(None documented)'}

## Time Tracking

- **Estimated**: ${data.jira?.customFields?.timeestimate || 'Not set'}
- **Actual**: ${data.knowledge.timeTracking?.daysSpent} days
- **Last Updated**: ${data.jira?.updated || 'Unknown'}

## Files Changed

\`\`\`
${data.git?.stats || '(No git data)'}
\`\`\`

### Key Files

${data.git?.filesChanged?.slice(0, 10).map(f => `- ${f}`).join('\n') || '(None)'}

## Commit History

${data.git?.commits?.slice(0, 5).map(c => `- ${c}`).join('\n') || '(No commits)'}

## Research & Plans

${existingData.research ? '### Research\n' + existingData.research : ''}
${existingData.plans ? '### Plans\n' + existingData.plans : ''}

## Next Steps

(Add follow-up work here)
`;

  fs.writeFileSync(contextFile, content);
  console.log(`✓ Saved to ${contextFile}`);

  return contextFile;
};

const contextFile = await persistContext(ticketId, {
  jira: jiraContext,
  github: githubContext,
  git: gitContext,
  user: userContext,
  knowledge
}, args);
```

## Phase 5: Cross-Reference & Confluence

```javascript
const linkFromJira = async (ticketId, contextFileUrl) => {
  console.log('\n🔗 Linking from Jira...');

  if (!args.includes('--confluence')) {
    return;
  }

  try {
    // Post comment to Jira ticket
    await atlassian.jira.addComment({
      issueKey: ticketId,
      body: `🤖 Context extracted — [Full context](${contextFileUrl})

This extraction captures decisions, gotchas, code patterns, and learnings from work on this ticket.`
    });
    console.log('✓ Posted link to Jira');
  } catch (e) {
    console.log('⚠️  Could not post Jira comment:', e.message);
  }
};

const confluenceSync = async (ticketId, data) => {
  console.log('📖 Syncing to Confluence...');

  try {
    const pageTitle = `${ticketId} - Context Extract`;

    // Create or find page
    const existingPage = await atlassian.confluence.search({
      cql: `title = "${pageTitle}"`
    });

    const content = `<h2>Context Extract: ${ticketId}</h2>
<p><strong>Generated:</strong> ${new Date().toISOString()}</p>

<h3>Key Decisions</h3>
<ul>
${data.knowledge.decisions.map(d =>
  `<li>${d.text}</li>`
).join('')}
</ul>

<h3>Gotchas</h3>
<ul>
${data.knowledge.gotchas.map(g =>
  `<li>${g.text}</li>`
).join('')}
</ul>`;

    if (existingPage.results.length) {
      await atlassian.confluence.updatePage({
        id: existingPage.results[0].id,
        title: pageTitle,
        body: { storage: { value: content } }
      });
      console.log('✓ Updated Confluence page');
    } else {
      const newPage = await atlassian.confluence.createPage({
        spaceKey: 'ENG',
        title: pageTitle,
        body: { storage: { value: content } }
      });
      console.log(`✓ Created Confluence page: ${newPage.links.webui}`);
    }
  } catch (e) {
    console.log('⚠️  Could not sync to Confluence:', e.message);
  }
};

if (args.includes('--confluence')) {
  await confluenceSync(ticketId, {jira: jiraContext, knowledge});
}
```

## Memory System Integration

```javascript
const addToMemory = async (ticketId, knowledge) => {
  if (!args.includes('--memory')) {
    return;
  }

  console.log('🧠 Adding to memory system...');

  const memoryItems = [];

  // Add decisions
  knowledge.decisions.forEach(d => {
    memoryItems.push({
      category: 'decision',
      ticket: ticketId,
      content: d.text,
      date: new Date()
    });
  });

  // Add patterns
  knowledge.patterns.forEach(p => {
    memoryItems.push({
      category: 'pattern',
      ticket: ticketId,
      content: p.text,
      date: new Date()
    });
  });

  try {
    // Save to memory system
    await memory.addItems(memoryItems);
    console.log(`✓ Added ${memoryItems.length} items to memory`);
  } catch (e) {
    console.log('⚠️  Could not save to memory:', e.message);
  }
};

await addToMemory(ticketId, knowledge);
```

## Completion

```javascript
console.log(`
✅ Context extraction complete for ${ticketId}

📁 Saved to: ${contextFile}
${args.includes('--confluence') ? '📖 Confluence page updated' : ''}
${args.includes('--memory') ? '🧠 Memory system updated' : ''}

Next: Review the context file and update follow-up tasks.
`);
```
