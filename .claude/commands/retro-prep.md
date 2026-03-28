---
name: retro-prep
description: "Auto-gather sprint metrics and prepare data-driven retrospective."
---

# Sprint Retrospective Preparation

Automates collection of sprint metrics, trend analysis, and qualitative signals to prepare a comprehensive, data-driven retrospective document. Pulls velocity trends, PR metrics, bug data, blockers, and team sentiment signals.

## Usage

```
/retro-prep [--sprint <sprint-id>] [--publish] [--raw]
```

- `--sprint <id>`: Specify sprint ID (auto-detects last completed sprint if omitted)
- `--publish`: Save formatted retro doc to Confluence
- `--raw`: Output raw JSON data instead of formatted document

## Workflow

### Phase 1: Sprint Selection

Identifies the most recently completed sprint or uses the specified sprint ID.

```javascript
// Pseudo-implementation
const sprints = await jira.getSprintsFromBoard({
  boardId: detectBoardId(),
  state: "closed"
});

const targetSprint = sprints[0]; // Most recent
if (!targetSprint) {
  console.error("ERROR: No closed sprints found");
  return gracefulFailure("No completed sprints available");
}

console.log(`✓ Sprint: ${targetSprint.name} (${targetSprint.id})`);
```

**Graceful degradation**: If no sprints found, prompt user for board selection or exit cleanly.

---

### Phase 2: Metrics Collection

Fetches quantitative sprint data: story points, ticket counts, cycle times, bug rates.

```javascript
const sprintTickets = await jira.getIssuesByJQL({
  jql: `sprint = ${targetSprint.id}`
});

const metrics = {
  committed: 0,
  completed: 0,
  carryover: 0,
  completedPoints: 0,
  committedPoints: 0,
  bugsFiled: 0,
  bugsFixed: 0,
  avgCycleTime: 0,
  prCount: 0,
  avgMergeTime: 0,
  ticketsByType: { Story: 0, Bug: 0, Task: 0, Subtask: 0 }
};

for (const ticket of sprintTickets) {
  metrics.ticketsByType[ticket.issuetype.name]++;

  if (ticket.status === "Done") {
    metrics.completed++;
    metrics.completedPoints += ticket.customfield_storypoints || 0;
  } else {
    metrics.carryover++;
  }

  metrics.committedPoints += ticket.customfield_storypoints || 0;
  metrics.committed++;

  // Calculate cycle time (created → done)
  if (ticket.status === "Done") {
    const created = new Date(ticket.created);
    const resolved = new Date(ticket.resolutiondate);
    const cycleHours = (resolved - created) / (1000 * 60 * 60);
    metrics.avgCycleTime += cycleHours;
  }

  // Count bugs
  if (ticket.issuetype.name === "Bug") {
    if (ticket.status === "Done") metrics.bugsFixed++;
    else metrics.bugsFiled++;
  }
}

metrics.avgCycleTime = Math.round(metrics.avgCycleTime / metrics.completed);
metrics.completionRate = Math.round((metrics.completed / metrics.committed) * 100);
metrics.velocity = metrics.completedPoints;

console.log(`✓ Metrics collected: ${metrics.completed}/${metrics.committed} tickets, ${metrics.velocity}pt velocity`);
```

**Error handling**: Gracefully skip PR/GitHub metrics if GitHub MCP unavailable; continue with Jira-only data.

---

### Phase 3: Trend Analysis

Compares current sprint metrics against previous 2-3 sprints to identify patterns.

```javascript
const previousSprints = sprints.slice(0, 3);
const trends = {
  velocityHistory: [],
  carryoverHistory: [],
  bugRateHistory: [],
  anomalies: []
};

for (const sprint of previousSprints) {
  const prevTickets = await jira.getIssuesByJQL({
    jql: `sprint = ${sprint.id}`
  });

  let prevPoints = 0;
  let prevCarryover = 0;
  let prevBugs = 0;

  for (const t of prevTickets) {
    if (t.status === "Done") prevPoints += t.customfield_storypoints || 0;
    else prevCarryover++;
    if (t.issuetype.name === "Bug") prevBugs++;
  }

  trends.velocityHistory.push(prevPoints);
  trends.carryoverHistory.push(prevCarryover);
  trends.bugRateHistory.push(prevBugs);
}

// Detect anomalies
const avgVelocity = trends.velocityHistory.reduce((a, b) => a + b, 0) / trends.velocityHistory.length;
if (Math.abs(metrics.velocity - avgVelocity) > avgVelocity * 0.3) {
  trends.anomalies.push({
    type: "velocity",
    severity: metrics.velocity < avgVelocity ? "down" : "up",
    delta: Math.round(metrics.velocity - avgVelocity),
    message: `Velocity ${metrics.velocity < avgVelocity ? "dropped" : "increased"} significantly`
  });
}

const avgCarryover = trends.carryoverHistory.reduce((a, b) => a + b, 0) / trends.carryoverHistory.length;
if (metrics.carryover > avgCarryover * 1.5) {
  trends.anomalies.push({
    type: "carryover",
    severity: "warning",
    message: `High carryover: ${metrics.carryover} tickets (avg: ${Math.round(avgCarryover)})`
  });
}

console.log(`✓ Trend analysis: ${trends.anomalies.length} anomalies detected`);
```

**Graceful degradation**: If fewer than 2 previous sprints exist, skip trend analysis and note in output.

---

### Phase 4: Qualitative Signals

Identifies blocked tickets, incidents, high-discussion items, and scope changes.

```javascript
const qualitative = {
  blockedTickets: [],
  incidents: [],
  highDiscussionItems: [],
  scopeChanges: []
};

for (const ticket of sprintTickets) {
  // Check for blocked status or blocking links
  const isBlocked = ticket.status === "Blocked" ||
    ticket.issuelinks?.some(link =>
      link.type.name === "is blocked by" && link.outwardIssue.status !== "Done"
    );

  if (isBlocked) {
    const blockedDuration = Date.now() - new Date(ticket.updated);
    qualitative.blockedTickets.push({
      key: ticket.key,
      title: ticket.summary,
      status: ticket.status,
      blockedFor: Math.round(blockedDuration / (1000 * 60 * 60)) + " hours",
      assignee: ticket.assignee?.name || "Unassigned"
    });
  }

  // Count comments as proxy for confusion/contention
  if (ticket.changelog?.histories?.length > 5) {
    qualitative.highDiscussionItems.push({
      key: ticket.key,
      title: ticket.summary,
      commentCount: ticket.changelog.histories.length,
      lastUpdate: ticket.updated
    });
  }

  // Detect scope changes (multiple status transitions, multiple assignees)
  const statusTransitions = ticket.changelog?.histories?.filter(h => h.items?.some(i => i.field === "status")) || [];
  if (statusTransitions.length > 3) {
    qualitative.scopeChanges.push({
      key: ticket.key,
      title: ticket.summary,
      statusChanges: statusTransitions.length
    });
  }
}

// Find incidents (filter by label or issue type)
const incidents = await jira.getIssuesByJQL({
  jql: `sprint = ${targetSprint.id} AND type = Incident OR labels = incident`
});
qualitative.incidents = incidents.map(i => ({
  key: i.key,
  title: i.summary,
  severity: i.customfield_severity || "Unknown",
  resolved: i.status === "Done"
}));

console.log(`✓ Qualitative signals: ${qualitative.blockedTickets.length} blocked, ${qualitative.incidents.length} incidents`);
```

**Error handling**: Gracefully handle missing changelog data; use available fields only.

---

### Phase 5: Output Generation & Publishing

Formats retro prep document with scorecard, insights, and discussion starters.

```javascript
const retroDoc = `
# Sprint Retrospective: ${targetSprint.name}

## Sprint Scorecard

| Metric | Value | Trend |
|--------|-------|-------|
| Velocity | ${metrics.velocity}pt | ${trends.velocityHistory[0] > metrics.velocity ? "↓" : "↑"} |
| Completion Rate | ${metrics.completionRate}% | - |
| Carryover Tickets | ${metrics.carryover} | ${metrics.carryover > Math.round(avgCarryover) ? "↑" : "↓"} |
| Avg Cycle Time | ${metrics.avgCycleTime}h | - |
| Bugs Fixed | ${metrics.bugsFixed} | - |
| PRs Merged | ${metrics.prCount} | - |

## Key Findings

${trends.anomalies.map(a => `- **${a.type}**: ${a.message}`).join("\n")}

## What Went Well

${qualitative.completedTickets?.slice(0, 5).map(t => `- ✓ ${t.key}: ${t.title}`).join("\n") || "- No high-impact completions identified"}

## What Needs Improvement

${qualitative.blockedTickets.map(b => `- ⛔ ${b.key}: Blocked for ${b.blockedDuration} (owner: ${b.assignee})`).join("\n")}

${qualitative.incidents.length > 0 ? `\n## Incidents During Sprint\n\n${qualitative.incidents.map(i => `- ${i.key}: ${i.title} (${i.severity})`).join("\n")}` : ""}

## Discussion Starters

${qualitative.highDiscussionItems.slice(0, 3).map(item =>
  `- Why did ${item.key} have ${item.commentCount} status changes?`
).join("\n")}

- How can we reduce carryover from ${metrics.carryover} tickets?
- Are we setting realistic story point estimates?

## Action Items Tracking

- [ ] Review and update ticket estimation accuracy
- [ ] Implement blocker resolution SLA
- [ ] Schedule follow-up on ${qualitative.scopeChanges.length} scope-change tickets

---
*Generated at ${new Date().toISOString()}*
`;

if (argv.publish) {
  try {
    const confluencePage = await confluence.createPage({
      spaceKey: process.env.CONFLUENCE_SPACE || "DEV",
      title: `Retro Prep: ${targetSprint.name}`,
      body: retroDoc
    });
    console.log(`✓ Published to Confluence: ${confluencePage.links.webui}`);
  } catch (err) {
    console.error(`✗ Confluence publish failed: ${err.message}`);
    console.log("Retro doc saved locally. Copy to Confluence manually.");
  }
} else {
  console.log("\n" + retroDoc);
}

if (argv.raw) {
  console.log(JSON.stringify({ metrics, trends, qualitative }, null, 2));
}
```

**Graceful degradation**: If Confluence unavailable, output document to console and suggest manual copy/paste.

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| No closed sprints | Exit with user-friendly message, suggest running `jira list-boards` |
| Jira API rate limit | Retry with exponential backoff; skip optional metrics (PRs) if needed |
| Missing story points field | Calculate velocity as ticket count instead |
| GitHub MCP unavailable | Continue with Jira-only metrics; note in output |
| Confluence publish fails | Output to stdout, suggest manual posting |

## Performance Notes

- Caches sprint data (30-second TTL) to avoid redundant API calls
- Lazy-loads trend data only when 3+ sprints available
- Skips GitHub integration if no `.git` directory found
