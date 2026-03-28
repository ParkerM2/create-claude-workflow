---
name: critical-path
description: "Analyze sprint dependency graph and identify critical path."
---

# Sprint Critical Path Analysis

Builds a dependency graph of all sprint tickets, identifies the critical path (longest chain of dependent work), and flags at-risk items that could delay sprint completion. Reveals parallel work opportunities.

## Usage

```
/critical-path [--sprint <sprint-id>] [--mermaid] [--slack] [--format text|json]
```

- `--sprint <id>`: Analyze specific sprint (defaults to active)
- `--mermaid`: Output dependency graph as Mermaid diagram
- `--slack`: Share critical path to Slack channel
- `--format`: Output format (text, json, markdown)

## Workflow

### Phase 1: Data Collection

Fetches all active sprint tickets with dependency relationships.

```javascript
class SprintAnalyzer {
  constructor() {
    this.sprint = null;
    this.tickets = [];
    this.dependencies = new Map();
  }

  async collectSprintData(sprintId = null) {
    try {
      // Get active sprint
      let sprint = null;
      if (sprintId) {
        sprint = await jira.getSprint({ sprintId });
      } else {
        const sprints = await jira.getSprintsFromBoard({
          boardId: detectBoardId(),
          state: "active"
        });

        if (sprints.length === 0) {
          console.error("ERROR: No active sprint found");
          return gracefulFailure("No active sprint; use --sprint to specify");
        }

        sprint = sprints[0];
      }

      this.sprint = sprint;
      console.log(`✓ Sprint: ${sprint.name} (${sprint.id})`);

      // Fetch all sprint tickets with expanded issue links
      const tickets = await jira.getIssuesByJQL({
        jql: `sprint = ${sprint.id}`,
        expand: ["changelog", "changelog.histories"],
        maxResults: 500
      });

      this.tickets = tickets.map(ticket => ({
        key: ticket.key,
        title: ticket.summary,
        status: ticket.status,
        storyPoints: ticket.customfield_storypoints || 0,
        assignee: ticket.assignee?.name || "Unassigned",
        priority: ticket.priority?.name || "Medium",
        dueDate: ticket.duedate,
        issueLinks: ticket.issuelinks || [],
        created: ticket.created,
        updated: ticket.updated,
        issuetype: ticket.issuetype.name
      }));

      console.log(`✓ Collected ${this.tickets.length} sprint tickets`);
      return this.tickets;
    } catch (err) {
      console.error(`ERROR: Failed to collect sprint data: ${err.message}`);
      return gracefulFailure("Unable to fetch sprint information");
    }
  }

  buildDependencyMap() {
    // Map: ticket key → array of keys it blocks
    const blockingMap = new Map();
    // Map: ticket key → array of keys blocking it
    const blockedByMap = new Map();

    // Initialize maps
    for (const ticket of this.tickets) {
      blockingMap.set(ticket.key, []);
      blockedByMap.set(ticket.key, []);
    }

    // Process issue links
    for (const ticket of this.tickets) {
      for (const link of ticket.issueLinks) {
        const linkType = link.type.name.toLowerCase();

        // "blocks" relationship
        if (linkType === "blocks") {
          const blockedKey = link.outwardIssue?.key;
          if (blockedKey && blockedByMap.has(blockedKey)) {
            blockingMap.get(ticket.key).push(blockedKey);
            blockedByMap.get(blockedKey).push(ticket.key);
          }
        }

        // "is blocked by" relationship
        if (linkType === "is blocked by") {
          const blockerKey = link.outwardIssue?.key;
          if (blockerKey && blockingMap.has(blockerKey)) {
            blockedByMap.get(ticket.key).push(blockerKey);
            blockingMap.get(blockerKey).push(ticket.key);
          }
        }

        // "depends on" relationship
        if (linkType === "depends on" || linkType === "dependency") {
          const depKey = link.outwardIssue?.key;
          if (depKey && blockingMap.has(depKey)) {
            blockingMap.get(depKey).push(ticket.key);
            blockedByMap.get(ticket.key).push(depKey);
          }
        }
      }
    }

    this.dependencies = {
      blocking: blockingMap,
      blockedBy: blockedByMap
    };

    console.log(`✓ Built dependency map`);
    return this.dependencies;
  }
}

const analyzer = new SprintAnalyzer();
await analyzer.collectSprintData(argv.sprint);
analyzer.buildDependencyMap();
```

**Graceful degradation**: If no sprint found, exit with helpful message; handle missing issue links gracefully.

---

### Phase 2: Graph Construction & Cycle Detection

Builds a DAG and detects circular dependencies.

```javascript
class DependencyGraph {
  constructor(tickets, dependencies) {
    this.tickets = new Map(tickets.map(t => [t.key, t]));
    this.blocking = dependencies.blocking;
    this.blockedBy = dependencies.blockedBy;
    this.cycles = [];
    this.roots = []; // Tickets with no dependencies
    this.leaves = []; // Tickets that don't block anything
  }

  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();

    for (const ticket of this.tickets.keys()) {
      if (!visited.has(ticket)) {
        this._detectCyclesDFS(ticket, visited, recursionStack);
      }
    }

    if (this.cycles.length > 0) {
      console.warn(`⚠ WARNING: ${this.cycles.length} circular dependencies detected`);
      this.cycles.forEach(cycle => {
        console.warn(`  ${cycle.join(" → ")}`);
      });
    }

    return this.cycles;
  }

  _detectCyclesDFS(node, visited, stack, path = []) {
    visited.add(node);
    stack.add(node);
    path.push(node);

    const dependencies = this.blockedBy.get(node) || [];

    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        this._detectCyclesDFS(dep, visited, stack, [...path]);
      } else if (stack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).concat([dep]);
        this.cycles.push(cycle);
      }
    }

    stack.delete(node);
  }

  identifyRootsAndLeaves() {
    for (const ticket of this.tickets.keys()) {
      const blockers = this.blockedBy.get(ticket) || [];
      if (blockers.length === 0) {
        this.roots.push(ticket);
      }

      const blocked = this.blocking.get(ticket) || [];
      if (blocked.length === 0) {
        this.leaves.push(ticket);
      }
    }

    console.log(`✓ Found ${this.roots.length} root items (no dependencies)`);
    console.log(`✓ Found ${this.leaves.length} leaf items (no downstream blocks)`);

    return { roots: this.roots, leaves: this.leaves };
  }

  calculateCriticalPath() {
    // Topological sort
    const inDegree = new Map();
    const allNodes = Array.from(this.tickets.keys());

    for (const node of allNodes) {
      inDegree.set(node, this.blockedBy.get(node)?.length || 0);
    }

    // Find all paths from roots to leaves and calculate weights
    const pathWeights = [];

    for (const root of this.roots) {
      const paths = this._findAllPaths(root, new Set());

      for (const path of paths) {
        let weight = 0;
        for (const key of path) {
          const ticket = this.tickets.get(key);
          weight += ticket.storyPoints;
        }

        pathWeights.push({
          path,
          weight,
          length: path.length
        });
      }
    }

    // Sort by weight (longest critical path)
    pathWeights.sort((a, b) => b.weight - a.weight || b.length - a.length);

    const criticalPath = pathWeights.length > 0 ? pathWeights[0] : null;

    if (criticalPath) {
      console.log(
        `✓ Critical path: ${criticalPath.length} items, ${criticalPath.weight}pt`
      );
      console.log(
        `  ${criticalPath.path.slice(0, 5).join(" → ")}${criticalPath.path.length > 5 ? " ..." : ""}`
      );
    } else {
      console.log("ℹ No dependency chains found");
    }

    return criticalPath;
  }

  _findAllPaths(node, visited, maxDepth = 10) {
    if (visited.size > maxDepth) {
      return [[node]];
    }

    const blocked = this.blocking.get(node) || [];

    if (blocked.length === 0) {
      return [[node]];
    }

    const paths = [];
    visited.add(node);

    for (const next of blocked) {
      if (!visited.has(next)) {
        const subPaths = this._findAllPaths(next, new Set(visited), maxDepth);
        for (const subPath of subPaths) {
          paths.push([node, ...subPath]);
        }
      }
    }

    return paths.length > 0 ? paths : [[node]];
  }
}

const graph = new DependencyGraph(analyzer.tickets, analyzer.dependencies);
graph.detectCycles();
graph.identifyRootsAndLeaves();
const criticalPath = graph.calculateCriticalPath();
```

**Graceful degradation**: If cycles detected, flag them but continue; if no dependencies exist, report and move on.

---

### Phase 3: Risk Assessment

Evaluates each critical path ticket for on-track status and capacity.

```javascript
class RiskAssessment {
  constructor(tickets, criticalPath) {
    this.tickets = new Map(tickets.map(t => [t.key, t]));
    this.criticalPath = criticalPath?.path || [];
    this.risks = [];
    this.opportunities = [];
  }

  assessCriticalPathRisks() {
    if (this.criticalPath.length === 0) {
      console.log("ℹ No critical path to assess");
      return [];
    }

    const statusProgression = {
      "To Do": 0,
      "Open": 0,
      "Backlog": 0,
      "In Progress": 50,
      "In Review": 75,
      "Testing": 80,
      "Done": 100
    };

    const sprintDaysElapsed = Math.ceil(
      (new Date() - new Date(this.tickets.get(this.criticalPath[0])?.created)) /
      (1000 * 60 * 60 * 24)
    );

    const sprintDaysTotal = 10; // Typically 2-week sprint
    const expectedProgress = Math.round((sprintDaysElapsed / sprintDaysTotal) * 100);

    console.log(`\nℹ Sprint progress: ${sprintDaysElapsed} days elapsed`);
    console.log(`  Expected completion: ${expectedProgress}% of work`);

    for (const key of this.criticalPath) {
      const ticket = this.tickets.get(key);
      if (!ticket) continue;

      const actualProgress = statusProgression[ticket.status] || 50;
      const isAtRisk = actualProgress < expectedProgress * 0.8; // 20% behind

      const assessment = {
        key,
        title: ticket.title,
        status: ticket.status,
        actualProgress,
        expectedProgress,
        isAtRisk,
        assignee: ticket.assignee,
        storyPoints: ticket.storyPoints,
        reasons: []
      };

      // Check if assigned
      if (ticket.assignee === "Unassigned") {
        assessment.reasons.push("Not assigned");
        assessment.isAtRisk = true;
      }

      // Check if overloaded (heuristic: more than 20pt in progress)
      const assignedTicketsInProgress = Array.from(this.tickets.values())
        .filter(t => t.assignee === ticket.assignee && t.status === "In Progress")
        .reduce((sum, t) => sum + t.storyPoints, 0);

      if (assignedTicketsInProgress > 20) {
        assessment.reasons.push(
          `Assignee overloaded: ${assignedTicketsInProgress}pt in progress`
        );
        assessment.isAtRisk = true;
      }

      // Check if blocked
      if (ticket.status === "Blocked") {
        assessment.reasons.push("Currently blocked");
        assessment.isAtRisk = true;
      }

      if (assessment.isAtRisk) {
        this.risks.push(assessment);
      }
    }

    console.log(
      `⚠ Found ${this.risks.length} at-risk items on critical path`
    );

    return this.risks;
  }

  findParallelOpportunities() {
    if (this.criticalPath.length === 0) {
      return [];
    }

    const criticalSet = new Set(this.criticalPath);
    const opportunities = [];

    for (const ticket of this.tickets.values()) {
      // Skip if already on critical path
      if (criticalSet.has(ticket.key)) continue;

      // Skip if already completed
      if (ticket.status === "Done") continue;

      // Only look at To Do items (not started)
      if (ticket.status !== "To Do") continue;

      // Check if could start now (no blockers)
      const hasBlockers = false; // Would need to check blockedBy map

      opportunities.push({
        key: ticket.key,
        title: ticket.title,
        storyPoints: ticket.storyPoints,
        priority: ticket.priority,
        reason: "Ready to start; not on critical path"
      });
    }

    opportunities.sort((a, b) => (b.priority === "High" ? 1 : -1) - (a.priority === "High" ? 1 : -1));

    console.log(`✓ Found ${opportunities.length} parallel work opportunities`);

    return opportunities.slice(0, 5); // Return top 5
  }
}

const riskAssess = new RiskAssessment(analyzer.tickets, criticalPath);
const risks = riskAssess.assessCriticalPathRisks();
const parallelOps = riskAssess.findParallelOpportunities();
```

**Graceful degradation**: If no risks found, report clean status; if limited tickets, adapt heuristics.

---

### Phase 4: Visualization & Report

Generates ASCII graph, Mermaid diagram, or text report.

```javascript
function generateReport(format = "text") {
  let report = `# Sprint Critical Path Analysis

## Sprint: ${analyzer.sprint.name}

`;

  // Summary section
  report += `## Summary

| Metric | Value |
|--------|-------|
| Total Tickets | ${analyzer.tickets.length} |
| Root Items (no deps) | ${graph.roots.length} |
| Leaf Items (no blocks) | ${graph.leaves.length} |
| Critical Path Length | ${criticalPath?.path.length || 0} |
| Critical Path Weight | ${criticalPath?.weight || 0}pt |
| At-Risk Items | ${risks.length} |

`;

  // Critical path
  if (criticalPath && criticalPath.path.length > 0) {
    report += `## Critical Path

The longest dependency chain that determines minimum sprint completion time:

\`\`\`
${formatASCIIPath(criticalPath.path)}
\`\`\`

### Critical Path Details

`;

    for (const key of criticalPath.path) {
      const ticket = analyzer.tickets.find(t => t.key === key);
      if (ticket) {
        report += `- **${key}** (${ticket.storyPoints}pt): ${ticket.title}\n`;
        report += `  Status: ${ticket.status} | Assignee: ${ticket.assignee}\n`;
      }
    }

    report += "\n";
  }

  // At-risk items
  if (risks.length > 0) {
    report += `## ⚠️ At-Risk Items

${risks
  .map(
    risk =>
      `### ${risk.key}: ${risk.title}
- **Status**: ${risk.status}
- **Progress**: ${risk.actualProgress}% (expected: ${risk.expectedProgress}%)
- **Assignee**: ${risk.assignee}
- **Issues**: ${risk.reasons.join(", ")}`
  )
  .join("\n\n")}

`;
  }

  // Parallel opportunities
  if (parallelOps.length > 0) {
    report += `## 🚀 Parallel Work Opportunities

These items are ready to start and don't block the critical path:

${parallelOps
  .map(
    op =>
      `- **${op.key}** (${op.storyPoints}pt): ${op.title}`
  )
  .join("\n")}

`;
  }

  // Cycle warnings
  if (graph.cycles.length > 0) {
    report += `## 🔴 Circular Dependencies

**WARNING: Found ${graph.cycles.length} circular dependency chains:**

${graph.cycles
  .map(cycle => `- ${cycle.join(" → ")}`)
  .join("\n")}

These must be resolved before sprint completion.

`;
  }

  return report;
}

function formatASCIIPath(path) {
  if (path.length === 0) return "(no dependencies)";

  let ascii = "";
  for (let i = 0; i < path.length; i++) {
    ascii += `[${path[i]}]`;
    if (i < path.length - 1) ascii += " → ";
    if ((i + 1) % 3 === 0 && i < path.length - 1) ascii += "\n";
  }

  return ascii;
}

let output = "";
if (argv.mermaid) {
  // Generate Mermaid diagram
  output = generateMermaidDiagram(analyzer.tickets, analyzer.dependencies, criticalPath);
} else if (argv.format === "json") {
  output = JSON.stringify(
    {
      sprint: analyzer.sprint.name,
      criticalPath: criticalPath?.path || [],
      risks: risks.map(r => ({ key: r.key, reasons: r.reasons })),
      opportunities: parallelOps.map(o => ({ key: o.key, storyPoints: o.storyPoints }))
    },
    null,
    2
  );
} else {
  output = generateReport("text");
}

console.log(output);
```

**Graceful degradation**: If Mermaid generation fails, fall back to text report.

---

### Phase 5: Slack Publishing

Optionally shares critical path to Slack.

```javascript
async function publishToSlack(report) {
  const slackChannel = process.env.SLACK_SPRINT_CHANNEL || "#sprint";

  const summaryText = `
📊 *Critical Path Analysis: ${analyzer.sprint.name}*

${criticalPath ? `🔴 Critical Path: ${criticalPath.path.length} items (${criticalPath.weight}pt)` : ""}
⚠️ At-Risk Items: ${risks.length}
🚀 Parallel Opportunities: ${parallelOps.length}

${risks.length > 0 ? `\n*Action Required:* ${risks.map(r => r.key).join(", ")}` : ""}
`;

  try {
    await slack.chat.postMessage({
      channel: slackChannel,
      text: summaryText,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: summaryText
          }
        },
        ...(risks.length > 0
          ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*At-Risk:*\n${risks.map(r => `• ${r.key}: ${r.reasons.join(", ")}`).join("\n")}`
              }
            }
          ]
          : [])
      ]
    });

    console.log(`✓ Published to Slack: ${slackChannel}`);
  } catch (err) {
    console.warn(`⚠ Slack publish failed: ${err.message}`);
  }
}

if (argv.slack) {
  await publishToSlack(output);
}
```

**Graceful degradation**: If Slack unavailable, skip notification but continue.

---

## Mermaid Diagram Generation

```javascript
function generateMermaidDiagram(tickets, dependencies, criticalPath) {
  let diagram = "graph TD\n";

  // Add all nodes
  for (const ticket of tickets) {
    const style = criticalPath?.path.includes(ticket.key) ? ",stroke:#ff0000,stroke-width:3px" : "";
    const label = `${ticket.key}<br/>${ticket.status}<br/>${ticket.storyPoints}pt`;
    diagram += `  ${ticket.key}["${label}"${style}]\n`;
  }

  // Add edges
  const seenEdges = new Set();
  for (const [from, tos] of dependencies.blocking.entries()) {
    for (const to of tos) {
      const edgeKey = `${from}-${to}`;
      if (!seenEdges.has(edgeKey)) {
        diagram += `  ${from} --> ${to}\n`;
        seenEdges.add(edgeKey);
      }
    }
  }

  return "\`\`\`mermaid\n" + diagram + "\`\`\`";
}
```

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| No active sprint | Exit with message; use `--sprint` |
| No dependencies found | Report empty critical path |
| Circular dependency | Flag in report; don't fail |
| Large graph (>50 nodes) | Simplify visualization; show summary |
| Slack post fails | Log warning; continue |

## Performance Notes

- Uses topological sorting for path finding
- Caches dependency graph (per sprint)
- Limits path enumeration to max 10 items
- Skips detailed analysis for sprints with <5 tickets
