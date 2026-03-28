---
name: start-pairing
description: "Structured pair programming session with knowledge transfer tracking"
---

# Start Pairing Command

Manages pair programming sessions with structured knowledge transfer. Tracks driver/navigator roles, captures decisions and learnings, and produces session summaries.

## Usage

```
/start-pairing [TICKET_ID] [--topic TOPIC] [--end] [--slack] [--remote]
/start-pairing --end                    # End active pairing session
/start-pairing --list                   # List recent pair sessions
```

**Options:**
- `TICKET_ID`: Jira ticket ID for context (optional, topic required if omitted)
- `--topic TOPIC`: Free-form topic name if not ticket-based
- `--end`: End the current active session
- `--slack`: Post session summary to Slack
- `--remote`: Async pairing mode (leave notes for partner)
- `--list`: Show recent pairing sessions

## Phase 1: Session Setup

```javascript
// Check for active session
const getActiveSession = () => {
  const sessionDir = '.claude/sessions';
  if (!fs.existsSync(sessionDir)) {
    return null;
  }

  const files = fs.readdirSync(sessionDir)
    .filter(f => f.startsWith('pair-') && f.endsWith('.md'));

  if (!files.length) return null;

  // Get most recent
  const latest = files.sort().pop();
  const content = fs.readFileSync(`${sessionDir}/${latest}`, 'utf8');

  // Check if session is still active (no end marker)
  if (!content.includes('## Session End')) {
    return {
      file: `${sessionDir}/${latest}`,
      data: content
    };
  }

  return null;
};

// Handle --end flag
if (args.includes('--end')) {
  const active = getActiveSession();
  if (!active) {
    console.log('❌ No active pairing session found');
    return;
  }

  console.log('🛑 Ending pairing session...');
  // Jump to Phase 4
  await endSession(active.file);
  return;
}

// Handle --list flag
if (args.includes('--list')) {
  const sessionDir = '.claude/sessions';
  if (!fs.existsSync(sessionDir)) {
    console.log('No session history');
    return;
  }

  const files = fs.readdirSync(sessionDir)
    .filter(f => f.startsWith('pair-') && f.endsWith('.md'))
    .sort()
    .reverse();

  console.log('\n📋 Recent Pairing Sessions:\n');
  files.slice(0, 10).forEach(f => {
    const content = fs.readFileSync(`${sessionDir}/${f}`, 'utf8');
    const match = content.match(/^# Pair Session: (.+)$/m);
    const title = match ? match[1] : f;
    console.log(`- ${f.replace('.md', '')}\n  ${title}`);
  });
  return;
}

// Detect active session
const activeSession = getActiveSession();
if (activeSession && !args[0]) {
  console.log('⚠️  Active pairing session detected:');
  console.log(activeSession.data.split('\n').slice(0, 5).join('\n'));
  console.log('Use /start-pairing --end to end it, or /start-pairing TICKET to start new');
  return;
}

console.log('\n🚀 Starting pair programming session...\n');

// Get ticket ID or topic
let ticketId = args[0];
let topic = null;

if (ticketId && !ticketId.match(/[A-Z]+-\d+/)) {
  topic = ticketId;
  ticketId = null;
} else if (args.includes('--topic')) {
  const idx = args.indexOf('--topic');
  topic = args[idx + 1];
}

if (!ticketId && !topic) {
  ticketId = await prompt('Ticket ID (or press enter for free topic): ');
  if (!ticketId) {
    topic = await prompt('Topic for this pairing session: ');
  }
}

// Get participants
console.log('\n👥 Pairing Participants\n');

const driver = await prompt('Driver name (who\'s coding): ');
if (!driver) {
  console.log('❌ Driver name required');
  return;
}

const navigator = await prompt('Navigator name (who\'s reviewing/guiding): ');
if (!navigator) {
  console.log('❌ Navigator name required');
  return;
}

// Get session goal
const goal = await prompt('\n🎯 Session goal or focus area: ');
const timeBox = await prompt('Time box in minutes (optional): ') || '60';

console.log('✓ Session configured\n');

// Create session directory
const sessionDir = '.claude/sessions';
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Create session file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const sessionFile = `${sessionDir}/pair-${timestamp}.md`;

const sessionTitle = ticketId ? `${ticketId} - ${goal}` : `${topic} - ${goal}`;

const initialContent = `# Pair Session: ${sessionTitle}

**Started**: ${new Date().toISOString()}
**Driver**: ${driver}
**Navigator**: ${navigator}
**Time Box**: ${timeBox} minutes
${ticketId ? `**Ticket**: ${ticketId}` : `**Topic**: ${topic}`}

## Session Context

(Loading context...)

## Decisions Made

(Decisions will be tracked here)

## Code Changes

(Summary of code modifications)

## Learnings

(Key learnings and patterns discovered)

## Open Questions

(Unresolved issues or follow-ups)

## Session Notes

(Ongoing session notes)

`;

fs.writeFileSync(sessionFile, initialContent);
console.log(`📝 Session file: ${sessionFile}\n`);

// Store active session reference
const activeFile = `${sessionDir}/.active`;
fs.writeFileSync(activeFile, sessionFile);
```

## Phase 2: Context Loading

```javascript
const loadSessionContext = async (ticketId, topic) => {
  console.log('📚 Loading context...\n');

  let context = {
    ticket: null,
    related: [],
    architecture: null,
    memory: []
  };

  // Load ticket context if provided
  if (ticketId) {
    try {
      const ticket = await atlassian.jira.searchIssues({
        jql: `key = ${ticketId}`,
        expand: ['changelog']
      });

      if (ticket.issues.length) {
        const issue = ticket.issues[0];
        context.ticket = {
          key: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description,
          status: issue.fields.status.name,
          acceptance: issue.fields.customFields?.acceptanceCriteria
        };
        console.log(`✓ Loaded ${ticketId}`);
      }
    } catch (e) {
      console.log(`⚠️  Could not load Jira ticket: ${e.message}`);
    }
  }

  // Load progress context
  if (ticketId) {
    const progressDir = `.claude/progress/${ticketId}`;
    if (fs.existsSync(progressDir)) {
      const files = fs.readdirSync(progressDir);
      if (files.includes('plan.md')) {
        context.plan = fs.readFileSync(`${progressDir}/plan.md`, 'utf8');
        console.log('✓ Loaded existing plan');
      }
      if (files.includes('research.md')) {
        context.research = fs.readFileSync(`${progressDir}/research.md`, 'utf8');
        console.log('✓ Loaded research notes');
      }
    }
  }

  // Load relevant memory items
  try {
    const memoryItems = await memory.search({
      query: ticketId || topic,
      limit: 5
    });

    context.memory = memoryItems.map(m => ({
      category: m.category,
      content: m.content,
      source: m.source
    }));

    if (memoryItems.length) {
      console.log(`✓ Loaded ${memoryItems.length} relevant memory items`);
    }
  } catch (e) {
    console.log('ℹ️  Memory system unavailable');
  }

  return context;
};

const sessionContext = await loadSessionContext(ticketId, topic);

// Update session file with context
let sessionContent = fs.readFileSync(sessionFile, 'utf8');
sessionContent = sessionContent.replace(
  '(Loading context...)',
  `**Ticket**: ${sessionContext.ticket?.summary || 'N/A'}

${sessionContext.memory.length ?
  '### Relevant Memory\n' +
  sessionContext.memory.map(m => `- [${m.category}] ${m.content}`).join('\n') :
  ''}`
);

fs.writeFileSync(sessionFile, sessionContent);
console.log('');
```

## Phase 3: Active Session

```javascript
// Session interaction loop
console.log(`✅ Pair session started. Commands during session:

  "swap"          - Switch driver/navigator
  "decide: X"     - Record a decision
  "code: X"       - Note code change
  "learn: X"      - Record a learning
  "ask: X"        - Add open question
  "note: X"       - Add session note
  "status"        - Show session status
  "end"           - End session

`);

const updateSession = (section, content) => {
  let current = fs.readFileSync(sessionFile, 'utf8');

  // Find section and update
  const sectionPattern = new RegExp(`(## ${section}\n\n)(.*?)(\n## |$)`, 's');
  const match = current.match(sectionPattern);

  if (match) {
    let existing = match[2].trim();
    if (existing === '(Decisions will be tracked here)' ||
        existing === '(Summary of code modifications)' ||
        existing === '(Key learnings and patterns discovered)' ||
        existing === '(Unresolved issues or follow-ups)' ||
        existing === '(Ongoing session notes)') {
      existing = '';
    }

    const updated = existing ? `${existing}\n\n- ${content}` : `- ${content}`;
    current = current.replace(sectionPattern, `$1${updated}$3`);
  }

  fs.writeFileSync(sessionFile, current);
};

const trackRoleSwap = (driver, navigator) => {
  const timestamp = new Date().toLocaleTimeString();
  updateSession(
    'Session Notes',
    `[${timestamp}] Driver/Navigator swapped: ${navigator} → ${driver}`
  );
  console.log(`✓ Swapped roles: ${navigator} driving, ${driver} navigating`);
};

const showStatus = () => {
  let content = fs.readFileSync(sessionFile, 'utf8');
  const lines = content.split('\n');

  console.log('\n📊 Session Status:\n');

  const decisionMatch = content.match(/## Decisions Made\n\n([\s\S]*?)(?:\n##|$)/);
  const decisions = decisionMatch ? decisionMatch[1].trim().split('\n').filter(l => l.startsWith('-')).length : 0;

  const learningMatch = content.match(/## Learnings\n\n([\s\S]*?)(?:\n##|$)/);
  const learnings = learningMatch ? learningMatch[1].trim().split('\n').filter(l => l.startsWith('-')).length : 0;

  const questionsMatch = content.match(/## Open Questions\n\n([\s\S]*?)(?:\n##|$)/);
  const questions = questionsMatch ? questionsMatch[1].trim().split('\n').filter(l => l.startsWith('-')).length : 0;

  console.log(`Decisions captured: ${decisions}`);
  console.log(`Learnings captured: ${learnings}`);
  console.log(`Open questions: ${questions}`);
  console.log('');
};

// Session interaction handler
const handleSessionInput = async (input) => {
  const cmd = input.split(':')[0].toLowerCase().trim();

  switch (cmd) {
    case 'swap':
      trackRoleSwap(navigator, driver);
      [driver, navigator] = [navigator, driver];
      break;

    case 'decide':
      const decision = input.substring(input.indexOf(':') + 1).trim();
      updateSession('Decisions Made', `${decision} (${driver})`);
      console.log('✓ Decision recorded');
      break;

    case 'code':
      const codeChange = input.substring(input.indexOf(':') + 1).trim();
      updateSession('Code Changes', codeChange);
      console.log('✓ Code change noted');
      break;

    case 'learn':
      const learning = input.substring(input.indexOf(':') + 1).trim();
      updateSession('Learnings', learning);
      console.log('✓ Learning recorded');
      break;

    case 'ask':
      const question = input.substring(input.indexOf(':') + 1).trim();
      updateSession('Open Questions', question);
      console.log('✓ Question added');
      break;

    case 'note':
      const note = input.substring(input.indexOf(':') + 1).trim();
      updateSession('Session Notes', `[${new Date().toLocaleTimeString()}] ${note}`);
      console.log('✓ Note added');
      break;

    case 'status':
      showStatus();
      break;

    case 'end':
      return 'END_SESSION';

    default:
      console.log('Unknown command. Use "status" to see options.');
  }

  return null;
};

// Interactive session loop
let sessionActive = true;
while (sessionActive) {
  const input = await prompt(`[${driver} driving] > `);
  if (!input.trim()) continue;

  const result = await handleSessionInput(input);
  if (result === 'END_SESSION') {
    sessionActive = false;
  }
}
```

## Phase 4: Session Wrap-up

```javascript
const endSession = async (sessionFilePath) => {
  console.log('\n📋 Wrapping up session...\n');

  let content = fs.readFileSync(sessionFilePath, 'utf8');

  // Extract session data
  const titleMatch = content.match(/^# Pair Session: (.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Pair Session';

  const driverMatch = content.match(/\*\*Driver\*\*: (.+)$/m);
  const driver = driverMatch ? driverMatch[1].trim() : 'Unknown';

  const navigatorMatch = content.match(/\*\*Navigator\*\*: (.+)$/m);
  const navigator = navigatorMatch ? navigatorMatch[1].trim() : 'Unknown';

  const ticketMatch = content.match(/\*\*Ticket\*\*: ([A-Z]+-\d+)/);
  const ticketId = ticketMatch ? ticketMatch[1] : null;

  // Count items captured
  const decisionMatch = content.match(/## Decisions Made\n\n([\s\S]*?)(?:\n##|$)/);
  const decisions = decisionMatch ? decisionMatch[1].trim().split('\n').filter(l => l.startsWith('-')) : [];

  const learningMatch = content.match(/## Learnings\n\n([\s\S]*?)(?:\n##|$)/);
  const learnings = learningMatch ? learningMatch[1].trim().split('\n').filter(l => l.startsWith('-')) : [];

  const codeMatch = content.match(/## Code Changes\n\n([\s\S]*?)(?:\n##|$)/);
  const codeChanges = codeMatch ? codeMatch[1].trim().split('\n').filter(l => l.startsWith('-')) : [];

  const questionsMatch = content.match(/## Open Questions\n\n([\s\S]*?)(?:\n##|$)/);
  const openQuestions = questionsMatch ? questionsMatch[1].trim().split('\n').filter(l => l.startsWith('-')) : [];

  // Add end marker
  const sessionEnd = `

## Session End

**Ended**: ${new Date().toISOString()}
**Duration**: Calculated from timestamps above

### Summary

- **Decisions made**: ${decisions.length}
- **Learnings captured**: ${learnings.length}
- **Code changes**: ${codeChanges.length}
- **Open questions**: ${openQuestions.length}
`;

  fs.appendFileSync(sessionFilePath, sessionEnd);

  console.log(`
✅ Session Complete: ${title}

📊 Session Summary:
   Driver: ${driver}
   Navigator: ${navigator}
   Decisions: ${decisions.length}
   Learnings: ${learnings.length}
   Code Changes: ${codeChanges.length}
   Open Questions: ${openQuestions.length}
`);

  return {
    title,
    driver,
    navigator,
    ticketId,
    decisions,
    learnings,
    codeChanges,
    openQuestions
  };
};

const sessionSummary = await endSession(sessionFile);
```

## Phase 5: Knowledge Persistence

```javascript
const persistSessionLearnings = async (summary, ticketId) => {
  console.log('🧠 Saving to memory system...\n');

  const memoryItems = [];

  // Add decisions to memory
  summary.decisions.forEach(d => {
    memoryItems.push({
      category: 'pair-decision',
      content: d.trim(),
      participants: [summary.driver, summary.navigator],
      ticket: ticketId,
      source: 'pairing-session'
    });
  });

  // Add learnings to memory
  summary.learnings.forEach(l => {
    memoryItems.push({
      category: 'pair-learning',
      content: l.trim(),
      participants: [summary.driver, summary.navigator],
      ticket: ticketId,
      source: 'pairing-session'
    });
  });

  // Update expertise mapping
  memoryItems.push({
    category: 'expertise',
    content: `${summary.driver} paired with ${summary.navigator} on ${ticketId || 'general topic'}`,
    participants: [summary.driver, summary.navigator],
    source: 'pairing-session'
  });

  try {
    await memory.addItems(memoryItems);
    console.log(`✓ Added ${memoryItems.length} items to memory`);
  } catch (e) {
    console.log(`⚠️  Could not save to memory: ${e.message}`);
  }

  return memoryItems;
};

await persistSessionLearnings(sessionSummary, ticketId);
```

## Slack Integration

```javascript
const postToSlack = async (summary, ticketId) => {
  if (!args.includes('--slack')) {
    return;
  }

  console.log('📤 Posting to Slack...\n');

  try {
    const text = `Pair programming session complete!

*Title*: ${summary.title}
*Participants*: ${summary.driver} & ${summary.navigator}
${ticketId ? `*Ticket*: ${ticketId}` : ''}

*Captured*:
• ${summary.decisions.length} decisions
• ${summary.learnings.length} learnings
• ${summary.codeChanges.length} code changes
• ${summary.openQuestions.length} open questions

Session details saved to session history.`;

    await slack.chat.postMessage({
      channel: '#engineering',
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Driver*\n${summary.driver}` },
            { type: 'mrkdwn', text: `*Navigator*\n${summary.navigator}` },
            { type: 'mrkdwn', text: `*Decisions*\n${summary.decisions.length}` },
            { type: 'mrkdwn', text: `*Learnings*\n${summary.learnings.length}` }
          ]
        }
      ]
    });

    console.log('✓ Posted to #engineering');
  } catch (e) {
    console.log(`⚠️  Could not post to Slack: ${e.message}`);
  }
};

await postToSlack(sessionSummary, ticketId);
```

## Jira Comment Integration

```javascript
const postToJira = async (summary, ticketId) => {
  if (!ticketId) {
    return;
  }

  console.log('🔗 Posting to Jira...\n');

  try {
    const comment = `👥 *Pair Programming Session*

*Participants*: ${summary.driver} & ${summary.navigator}

*Captured in session*:
• ${summary.decisions.length} key decisions
• ${summary.learnings.length} learnings
• ${summary.codeChanges.length} code changes
• ${summary.openQuestions.length} open questions

Session details available in session history.`;

    await atlassian.jira.addComment({
      issueKey: ticketId,
      body: comment
    });

    console.log('✓ Posted to Jira');
  } catch (e) {
    console.log(`⚠️  Could not post to Jira: ${e.message}`);
  }
};

await postToJira(sessionSummary, ticketId);
```

## Completion & Follow-ups

```javascript
// Clean up active session marker
const activeFile = '.claude/sessions/.active';
try {
  fs.unlinkSync(activeFile);
} catch (e) {
  // File doesn't exist, that's fine
}

// Suggest follow-ups
if (sessionSummary.openQuestions.length > 0) {
  console.log('\n❓ Open Questions from Session:\n');
  sessionSummary.openQuestions.slice(0, 3).forEach(q => {
    console.log(`  - ${q}`);
  });
  console.log('');
}

// Suggest context extraction if ticket-based
if (ticketId) {
  console.log(`💡 Next step: Extract full context with:
  /extract-context ${ticketId}
`);
}

console.log(`
📁 Session saved: ${sessionFile}
📚 Knowledge persisted to memory system
${args.includes('--slack') ? '✓ Posted to Slack' : ''}
${ticketId ? '✓ Posted to Jira' : ''}
`);
```
