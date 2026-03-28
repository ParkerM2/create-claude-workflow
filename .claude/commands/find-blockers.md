---
name: find-blockers
description: "Detect stalled and blocked tickets with escalation paths."
---

# Blocker Detection & Escalation

Scans active sprint for blocked, stalled, and at-risk tickets. Identifies what's blocking them, analyzes dependency chains, and recommends escalation actions. Optionally notifies owners and management.

## Usage

```
/find-blockers [--sprint <sprint-id>] [--notify] [--escalate] [--external] [--graph]
```

- `--sprint <id>`: Scan specific sprint (defaults to active)
- `--notify`: Send Slack DMs to blocker owners
- `--escalate`: Also notify team lead/manager
- `--external`: Include blockers from external teams
- `--graph`: Output dependency visualization

## Workflow

### Phase 1: Active Sprint Scan

Identifies tickets in active sprint that are blocked, stalled, or at-risk.

```javascript
// Get active sprint
let activeSprint = null;
try {
  const sprints = await jira.getSprintsFromBoard({
    boardId: detectBoardId(),
    state: "active"
  });

  if (sprints.length === 0) {
    console.error("ERROR: No active sprint found");
    return gracefulFailure("No active sprint; use --sprint to specify one");
  }

  activeSprint = sprints[0];
  console.log(`✓ Active sprint: ${activeSprint.name}`);
} catch (err) {
  console.error(`ERROR: Failed to detect sprint: ${err.message}`);
  return gracefulFailure("Unable to find active sprint");
}

const sprintTickets = await jira.getIssuesByJQL({
  jql: `sprint = ${activeSprint.id} AND status != Done`
});

const blockedItems = {
  explicit: [],    // status = Blocked or has "blocked by" link
  stalled: [],     // no update in 3+ days while In Progress
  helpRequested: [], // comment asking for help with no reply
  atRisk: []       // due soon but in early status
};

const now = new Date();
const thirtyDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

for (const ticket of sprintTickets) {
  // Check explicit blocked status
  if (ticket.status === "Blocked") {
    blockedItems.explicit.push({
      key: ticket.key,
      title: ticket.summary,
      status: ticket.status,
      assignee: ticket.assignee?.name || "Unassigned",
      updated: ticket.updated
    });
    continue;
  }

  // Check for "blocked by" links
  const blockedByLinks = ticket.issuelinks?.filter(link =>
    link.type.name === "is blocked by" &&
    link.outwardIssue?.status !== "Done"
  ) || [];

  if (blockedByLinks.length > 0) {
    blockedItems.explicit.push({
      key: ticket.key,
      title: ticket.summary,
      status: ticket.status,
      assignee: ticket.assignee?.name || "Unassigned",
      blockedBy: blockedByLinks.map(l => l.outwardIssue.key),
      updated: ticket.updated
    });
    continue;
  }

  // Check for staleness (no update in 3+ days while In Progress)
  if (ticket.status === "In Progress") {
    const lastUpdate = new Date(ticket.updated);
    if (lastUpdate < thirtyDaysAgo) {
      blockedItems.stalled.push({
        key: ticket.key,
        title: ticket.summary,
        assignee: ticket.assignee?.name || "Unassigned",
        stalledFor: Math.round((now - lastUpdate) / (1000 * 60 * 60 * 24)) + " days",
        lastUpdate: lastUpdate.toISOString()
      });
    }
  }

  // Check for help requests in comments
  if (ticket.comment?.comments) {
    const recentComments = ticket.comment.comments.filter(c =>
      new Date(c.created) > thirtyDaysAgo
    );

    const helpComments = recentComments.filter(c =>
      /help|stuck|blocked|can't|cannot|need|urgent/i.test(c.body) &&
      !c.author.self
    );

    const replies = recentComments.filter(c =>
      c.author.self || c.author.name === ticket.assignee?.name
    );

    if (helpComments.length > 0 && replies.length === 0) {
      blockedItems.helpRequested.push({
        key: ticket.key,
        title: ticket.summary,
        assignee: ticket.assignee?.name || "Unassigned",
        helpComments: helpComments.length,
        lastHelp: helpComments[helpComments.length - 1].created
      });
    }
  }

  // Check if at-risk (due in 3 days but in early status)
  if (ticket.duedate) {
    const due = new Date(ticket.duedate);
    const daysUntilDue = (due - now) / (1000 * 60 * 60 * 24);
    const earlyStatuses = ["To Do", "Backlog", "Open"];

    if (daysUntilDue < 3 && daysUntilDue > 0 && earlyStatuses.includes(ticket.status)) {
      blockedItems.atRisk.push({
        key: ticket.key,
        title: ticket.summary,
        status: ticket.status,
        assignee: ticket.assignee?.name || "Unassigned",
        dueIn: Math.round(daysUntilDue) + " days"
      });
    }
  }
}

const totalBlocked = blockedItems.explicit.length +
  blockedItems.stalled.length +
  blockedItems.helpRequested.length +
  blockedItems.atRisk.length;

console.log(`✓ Sprint scan complete: ${totalBlocked} blocked/stalled/at-risk items found`);
```

**Graceful degradation**: If no active sprint, prompt user; skip comment analysis if changelog unavailable.

---

### Phase 2: Blocker Analysis

For each blocked/stalled ticket, determines root cause and impact.

```javascript
const blockerAnalysis = {};

async function analyzeBlocker(ticket) {
  const analysis = {
    key: ticket.key,
    title: ticket.summary,
    severity: "medium",
    rootCause: "Unknown",
    impact: [],
    suggestions: [],
    dependencies: []
  };

  // Determine root cause
  if (ticket.status === "Blocked") {
    analysis.rootCause = "Explicit blocked status";
  } else if (ticket.blockedBy?.length > 0) {
    analysis.rootCause = `Blocked by: ${ticket.blockedBy.join(", ")}`;
    // Get blocker details
    for (const blockerKey of ticket.blockedBy) {
      try {
        const blocker = await jira.getIssue({ issueIdOrKey: blockerKey });
        analysis.dependencies.push({
          key: blocker.key,
          title: blocker.summary,
          status: blocker.status,
          owner: blocker.assignee?.name || "Unassigned"
        });
      } catch (err) {
        console.warn(`⚠ Could not fetch blocker ${blockerKey}`);
      }
    }
  } else if (ticket.stalledFor) {
    analysis.rootCause = `Stalled for ${ticket.stalledFor}`;
    // Could be: waiting for feedback, capacity issue, unclear requirements
    analysis.suggestions.push("Check if assignee has capacity");
    analysis.suggestions.push("Request status update in comment");
  } else if (ticket.helpComments) {
    analysis.rootCause = `Help requested; ${ticket.helpComments} comment(s) awaiting response`;
    analysis.suggestions.push("Respond to help request immediately");
    analysis.suggestions.push("Consider reassigning if assignee overloaded");
  }

  // Determine severity
  if (analysis.dependencies.filter(d => !d.status === "Done").length > 2) {
    analysis.severity = "critical";
  } else if (ticket.dueIn && parseInt(ticket.dueIn) <= 1) {
    analysis.severity = "critical";
  } else if (ticket.stalledFor && parseInt(ticket.stalledFor) > 5) {
    analysis.severity = "high";
  } else {
    analysis.severity = "medium";
  }

  // Find downstream impact (what tickets depend on this one)
  try {
    const downstreamTickets = await jira.getIssuesByJQL({
      jql: `issueLink = "blocks ${ticket.key}" AND resolution = Unresolved`
    });

    analysis.impact = downstreamTickets.map(t => ({
      key: t.key,
      title: t.summary,
      status: t.status
    }));
  } catch (err) {
    console.warn(`⚠ Could not calculate downstream impact for ${ticket.key}`);
  }

  return analysis;
}

// Analyze all blocked items
for (const item of blockedItems.explicit.concat(
  blockedItems.stalled,
  blockedItems.helpRequested,
  blockedItems.atRisk
)) {
  blockerAnalysis[item.key] = await analyzeBlocker(item);
}

console.log(`✓ Analyzed ${Object.keys(blockerAnalysis).length} blockers`);
```

**Error handling**: Gracefully skip blocked items that can't be fetched; continue with others.

---

### Phase 3: Dependency Chain Analysis

Builds a dependency graph to identify critical paths and circular dependencies.

```javascript
class DependencyGraph {
  constructor() {
    this.edges = new Map(); // key -> [dependencies]
    this.nodes = new Map(); // key -> {title, status, assignee}
    this.cycles = [];
  }

  addNode(key, data) {
    this.nodes.set(key, data);
  }

  addEdge(from, to) {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from).push(to);
  }

  detectCycles(startNode = null, visited = new Set(), recursionStack = new Set()) {
    const nodes = startNode ? [startNode] : Array.from(this.edges.keys());

    for (const node of nodes) {
      if (!visited.has(node)) {
        this._detectCyclesDFS(node, visited, recursionStack);
      }
    }

    return this.cycles;
  }

  _detectCyclesDFS(node, visited, recursionStack) {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = this.edges.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this._detectCyclesDFS(neighbor, visited, recursionStack);
      } else if (recursionStack.has(neighbor)) {
        this.cycles.push({ from: node, to: neighbor });
      }
    }

    recursionStack.delete(node);
  }

  criticalPath() {
    // Find longest path weighted by edges (simple approximation)
    const paths = [];

    for (const [start, neighbors] of this.edges) {
      const path = this._findLongestPath(start, new Set(), [start]);
      paths.push(path);
    }

    return paths.sort((a, b) => b.length - a.length)[0] || [];
  }

  _findLongestPath(node, visited, currentPath) {
    const neighbors = this.edges.get(node) || [];

    if (neighbors.length === 0) {
      return currentPath;
    }

    let longestExtension = currentPath;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const extended = this._findLongestPath(neighbor, visited, [...currentPath, neighbor]);
        if (extended.length > longestExtension.length) {
          longestExtension = extended;
        }
        visited.delete(neighbor);
      }
    }

    return longestExtension;
  }
}

const depGraph = new DependencyGraph();

// Build graph from all sprint tickets
for (const ticket of sprintTickets) {
  depGraph.addNode(ticket.key, {
    title: ticket.summary,
    status: ticket.status,
    assignee: ticket.assignee?.name
  });

  // Add blocking relationships
  const blockingLinks = ticket.issuelinks?.filter(link =>
    link.type.name === "is blocked by"
  ) || [];

  for (const link of blockingLinks) {
    depGraph.addEdge(ticket.key, link.outwardIssue.key);
  }
}

// Detect cycles and critical path
const cycles = depGraph.detectCycles();
if (cycles.length > 0) {
  console.warn(`⚠ WARNING: ${cycles.length} circular dependencies detected!`);
  cycles.forEach(c => console.warn(`  ${c.from} <-> ${c.to}`));
}

const criticalPath = depGraph.criticalPath();
if (criticalPath.length > 1) {
  console.log(`✓ Critical path (${criticalPath.length} items): ${criticalPath.join(" → ")}`);
}
```

**Graceful degradation**: If cycles detected, flag but continue; if graph is huge (>50 nodes), summarize critical path only.

---

### Phase 4: Report Generation

Formats blockers by severity with recommendations.

```javascript
const report = {
  critical: [],
  high: [],
  medium: [],
  suggestions: new Map()
};

for (const [key, analysis] of Object.entries(blockerAnalysis)) {
  const bucket = report[analysis.severity] || report.medium;
  bucket.push(analysis);
}

// Sort each bucket by impact
[report.critical, report.high, report.medium].forEach(bucket => {
  bucket.sort((a, b) => b.impact.length - a.impact.length);
});

let reportOutput = `
# Blocker Report for Sprint: ${activeSprint.name}

Generated: ${new Date().toISOString()}

## Executive Summary

| Severity | Count | Impact |
|----------|-------|--------|
| 🔴 Critical | ${report.critical.length} | ${report.critical.reduce((sum, b) => sum + b.impact.length, 0)} tickets blocked downstream |
| 🟠 High | ${report.high.length} | ${report.high.reduce((sum, b) => sum + b.impact.length, 0)} tickets blocked downstream |
| 🟡 Medium | ${report.medium.length} | ${report.medium.reduce((sum, b) => sum + b.impact.length, 0)} tickets blocked downstream |

${cycles.length > 0 ? `⚠️ **WARNING**: ${cycles.length} circular dependencies detected\n` : ""}

`;

// Critical blockers
if (report.critical.length > 0) {
  reportOutput += `## 🔴 CRITICAL Blockers\n\n`;
  for (const blocker of report.critical) {
    reportOutput += `### ${blocker.key}: ${blocker.title}\n`;
    reportOutput += `- **Root Cause**: ${blocker.rootCause}\n`;
    reportOutput += `- **Assignee**: ${blocker.dependencies[0]?.owner || "Unknown"}\n`;
    reportOutput += `- **Blocking**: ${blocker.impact.map(i => i.key).join(", ")}\n`;
    reportOutput += `- **Actions**:\n`;
    blocker.suggestions.forEach(s => reportOutput += `  - ${s}\n`);
    reportOutput += "\n";
  }
}

// High priority
if (report.high.length > 0) {
  reportOutput += `## 🟠 HIGH Priority Blockers\n\n`;
  for (const blocker of report.high.slice(0, 5)) {
    reportOutput += `### ${blocker.key}: ${blocker.title}\n`;
    reportOutput += `- **Root Cause**: ${blocker.rootCause}\n`;
    reportOutput += `- **Blocking**: ${blocker.impact.length} downstream tickets\n`;
    reportOutput += "\n";
  }
}

// Critical path
if (criticalPath.length > 1) {
  reportOutput += `## 📊 Critical Path\n\n`;
  reportOutput += "The longest dependency chain in this sprint:\n\n";
  reportOutput += "```\n" + criticalPath.join(" → ") + "\n```\n\n";
}

console.log(reportOutput);
```

**Graceful degradation**: If no blockers, output summary saying "No blockers detected"; if data incomplete, note in report.

---

### Phase 5: Notification & Escalation

Optionally sends Slack DMs to blocker owners and team lead.

```javascript
async function notifyBlockerOwners() {
  const notifyList = new Set();
  const escalateList = new Set();

  // Collect owners of blockers
  for (const blocker of report.critical.concat(report.high)) {
    if (blocker.dependencies.length > 0) {
      blocker.dependencies.forEach(dep => {
        notifyList.add(dep.owner);
      });
    }
  }

  // Also add team lead for escalation
  if (argv.escalate) {
    const teamLead = await getTeamLead(); // Look up from org config
    escalateList.add(teamLead);
  }

  for (const owner of notifyList) {
    try {
      const slackUser = await slack.users.list({ name: owner });
      if (!slackUser.ok) continue;

      const userId = slackUser.members?.[0]?.id;
      if (!userId) continue;

      const blockersByOwner = report.critical
        .concat(report.high)
        .filter(b => b.dependencies.some(d => d.owner === owner));

      const message = `
You have ${blockersByOwner.length} critical/high-priority blockers:

${blockersByOwner.map(b =>
  `• ${b.key}: ${b.title}\n  Impact: ${b.impact.length} downstream tickets`
).join("\n")}

Please unblock these ASAP or comment on the tickets for help.
`;

      await slack.chat.postMessage({
        channel: userId,
        text: message
      });

      console.log(`✓ Notified ${owner}`);
    } catch (err) {
      console.warn(`⚠ Failed to notify ${owner}: ${err.message}`);
    }
  }

  // Add Jira comments
  for (const blocker of report.critical) {
    try {
      await jira.addIssueComment({
        issueIdOrKey: blocker.key,
        body: `[Automated] This ticket is blocking ${blocker.impact.length} other tickets. Please prioritize unblocking.`
      });
    } catch (err) {
      console.warn(`⚠ Failed to comment on ${blocker.key}`);
    }
  }
}

if (argv.notify || argv.escalate) {
  await notifyBlockerOwners();
}

if (argv.graph) {
  console.log("\n## Dependency Graph (Mermaid)\n");
  console.log("```mermaid");
  console.log("graph TD");
  for (const [from, tos] of depGraph.edges) {
    for (const to of tos) {
      const status = depGraph.nodes.get(to)?.status || "?";
      const style = status === "Done" ? " style=" + from + ",fill:#90EE90" : "";
      console.log(`  ${from}["${from}"] --> ${to}["${to}"]${style}`);
    }
  }
  console.log("```");
}
```

**Graceful degradation**: If Slack unavailable, add Jira comments only; if user not found, log and continue.

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| No active sprint | Exit with message; use `--sprint` to specify |
| PR/comment fetch fails | Skip that data; continue scanning |
| Slack user not found | Log warning; continue |
| Circular dependency | Flag in report; highlight nodes involved |
| Graph too large (>100 nodes) | Show summary only; offer `--all-nodes` |

## Performance Notes

- Caches sprint tickets (5-minute TTL)
- Lazy-loads blocker details on-demand
- Limits graph computation to sprint scope
- Uses JQL for efficient filtering
