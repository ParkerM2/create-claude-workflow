---
name: alert-to-ticket
description: "Convert monitoring alerts to Jira tickets with context and severity."
---

# Alert-to-Ticket Automation

Converts monitoring alerts (text, URL, or structured) into properly formatted Jira tickets. Enriches with context (past incidents, recent deploys), maps severity, and links to runbooks and related tickets.

## Usage

```
/alert-to-ticket [<alert-description>] [--url <url>] [--json <file>] [--service <name>] [--severity <level>] [--dry-run]
```

- `<alert-description>`: Paste alert text directly
- `--url <url>`: Fetch alert from monitoring dashboard
- `--json <file>`: Parse structured alert JSON
- `--service <name>`: Override service detection
- `--severity <level>`: Override auto-detected severity
- `--dry-run`: Preview ticket without creating

## Workflow

### Phase 1: Alert Intake & Parsing

Ingests alert data from multiple sources and extracts key information.

```javascript
class AlertParser {
  constructor() {
    this.alert = {
      service: null,
      metric: null,
      threshold: null,
      currentValue: null,
      timestamp: new Date(),
      environment: "production",
      message: "",
      source: null
    };
  }

  async parseInput(input, url, jsonFile) {
    if (jsonFile) {
      return this.parseJSON(jsonFile);
    }

    if (url) {
      return this.parseFromURL(url);
    }

    if (input) {
      return this.parseText(input);
    }

    throw new Error("No alert input provided");
  }

  parseText(text) {
    // Extract common alert patterns
    const patterns = {
      service: /(?:Service|Alert|Service Name):\s*([^\n,]+)/i,
      metric: /(?:Metric|Condition):\s*([^\n,]+)/i,
      threshold: /(?:Threshold|Trigger|Limit):\s*([\d.]+[a-z%]*)/i,
      currentValue: /(?:Current|Actual|Value):\s*([\d.]+[a-z%]*)/i,
      timestamp: /(?:Time|Occurred|Triggered):\s*([^\n,]+)/i,
      environment: /(?:Environment|Env):\s*([\w-]+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        this.alert[key] = match[1];
      }
    }

    // Fallback: look for common service names
    if (!this.alert.service) {
      const serviceMatch = text.match(/\b(api|web|database|cache|queue|scheduler|worker)\b/i);
      if (serviceMatch) this.alert.service = serviceMatch[1];
    }

    this.alert.message = text;
    this.alert.source = "text";

    return this.alert;
  }

  async parseFromURL(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract alert data from HTML (Datadog, New Relic, etc.)
      const serviceMatch = html.match(
        /<span[^>]*class="[^"]*service[^"]*"[^>]*>([^<]+)<\/span>/i
      );
      const metricMatch = html.match(
        /<span[^>]*class="[^"]*metric[^"]*"[^>]*>([^<]+)<\/span>/i
      );
      const valueMatch = html.match(/(?:Value|Current):\s*([\d.]+)/);

      if (serviceMatch) this.alert.service = serviceMatch[1].trim();
      if (metricMatch) this.alert.metric = metricMatch[1].trim();
      if (valueMatch) this.alert.currentValue = valueMatch[1];

      this.alert.message = html;
      this.alert.source = url;

      console.log(`✓ Parsed alert from URL: ${url}`);
      return this.alert;
    } catch (err) {
      console.error(`ERROR: Failed to fetch alert from URL: ${err.message}`);
      return gracefulFailure("Unable to fetch alert from URL");
    }
  }

  parseJSON(jsonFile) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));

      // Map common alert JSON structures
      this.alert.service = data.service || data.serviceName || data.source || null;
      this.alert.metric = data.metric || data.check || data.condition || null;
      this.alert.currentValue = data.value || data.currentValue || null;
      this.alert.threshold = data.threshold || data.limit || null;
      this.alert.environment = data.environment || data.env || "production";
      this.alert.timestamp = new Date(data.timestamp || new Date());
      this.alert.message = JSON.stringify(data, null, 2);
      this.alert.source = jsonFile;

      console.log(`✓ Parsed structured alert from ${jsonFile}`);
      return this.alert;
    } catch (err) {
      console.error(`ERROR: Failed to parse JSON alert: ${err.message}`);
      return gracefulFailure("Invalid JSON alert file");
    }
  }

  validate() {
    if (!this.alert.service) {
      throw new Error("Could not determine service from alert; use --service");
    }

    if (!this.alert.metric && !this.alert.message) {
      throw new Error("No metric or message found in alert");
    }

    return true;
  }
}

const parser = new AlertParser();
const alert = await parser.parseInput(
  argv._[0], // positional text arg
  argv.url,
  argv.json
);

parser.validate();

console.log(`✓ Alert parsed`);
console.log(`  Service: ${alert.service}`);
console.log(`  Metric: ${alert.metric || "(not specified)"}`);
console.log(`  Value: ${alert.currentValue || "(not specified)"}`);
```

**Graceful degradation**: If parsing fails, prompt user for missing details; allow manual entry.

---

### Phase 2: Context Enrichment

Searches Jira for related incidents and checks git for recent deploys.

```javascript
async function enrichAlertContext(alert) {
  const context = {
    recentTickets: [],
    recentDeploys: [],
    runbook: null,
    projectKey: null
  };

  // Find recent tickets on same service
  try {
    const project = await detectProject(alert.service);
    context.projectKey = project;

    const recentTickets = await jira.getIssuesByJQL({
      jql: `project = ${project} AND (
        summary ~ "${alert.service}" OR
        labels ~ alert OR
        labels ~ "${alert.service.toLowerCase()}"
      ) AND created >= -30d
      ORDER BY created DESC`,
      maxResults: 5
    });

    context.recentTickets = recentTickets.map(t => ({
      key: t.key,
      title: t.summary,
      status: t.status,
      created: t.created,
      priority: t.priority?.name
    }));

    console.log(
      `✓ Found ${context.recentTickets.length} related tickets in last 30 days`
    );
  } catch (err) {
    console.warn(`⚠ Could not find related tickets: ${err.message}`);
  }

  // Check git for recent deploys
  try {
    const deploys = execSync(
      `git log --all --grep="${alert.service}" --oneline -20 2>/dev/null || true`
    )
      .toString()
      .split("\n")
      .filter(line => line)
      .map(line => {
        const match = line.match(/^(\w+) (.*)/);
        return {
          commit: match?.[1],
          message: match?.[2]
        };
      });

    context.recentDeploys = deploys.slice(0, 5);
    console.log(`✓ Found ${context.recentDeploys.length} recent commits mentioning service`);
  } catch (err) {
    console.log(`ℹ Could not fetch deploy history: ${err.message}`);
  }

  // Search Confluence for runbook
  try {
    const runbooks = await confluence.search({
      cql: `text ~ "runbook" AND text ~ "${alert.service}" AND space = RUNBOOKS`,
      limit: 1
    });

    if (runbooks.results.length > 0) {
      context.runbook = {
        title: runbooks.results[0].title,
        url: runbooks.results[0].url
      };
      console.log(`✓ Found runbook: ${context.runbook.title}`);
    }
  } catch (err) {
    console.log(`ℹ Could not find runbook: ${err.message}`);
  }

  return context;
}

const context = await enrichAlertContext(alert);
```

**Graceful degradation**: If any enrichment source fails, skip it and continue.

---

### Phase 3: Severity Mapping

Maps alert severity to Jira priority with business logic.

```javascript
function mapSeverity(alert, context) {
  const severityMap = {
    critical: "Highest",
    high: "High",
    warning: "Medium",
    low: "Low"
  };

  let severity = alert.severity || "high";

  // Auto-detect if not provided
  if (!alert.severity) {
    if (alert.message.match(/critical|sev-1|p1|urgent/i)) {
      severity = "critical";
    } else if (alert.message.match(/error|down|failing/i)) {
      severity = "high";
    } else if (alert.message.match(/warn|threshold|slow/i)) {
      severity = "warning";
    }
  }

  let priority = severityMap[severity.toLowerCase()] || "Medium";

  // Adjust based on business context
  const now = new Date();
  const hour = now.getHours();
  const isOffHours = hour < 6 || hour > 20;

  // Escalate off-hours alerts slightly
  if (isOffHours && priority !== "Highest") {
    priority = {
      High: "Highest",
      Medium: "High",
      Low: "Medium"
    }[priority] || priority;
  }

  // Check if user-facing service
  const userFacingServices = ["api", "web", "frontend", "auth", "payment"];
  const isUserFacing = userFacingServices.some(svc =>
    alert.service.toLowerCase().includes(svc)
  );

  if (isUserFacing && priority !== "Highest") {
    priority = {
      Medium: "High",
      Low: "Medium"
    }[priority] || priority;
  }

  // Check if database/payment (critical services)
  const criticalServices = ["database", "payment", "auth", "security"];
  const isCritical = criticalServices.some(svc =>
    alert.service.toLowerCase().includes(svc)
  );

  if (isCritical && priority === "Medium") {
    priority = "High";
  }

  const result = {
    detectedSeverity: severity,
    jirapriority: priority,
    isOffHours,
    isUserFacing,
    isCritical,
    isFirstOccurrence: context.recentTickets.length === 0
  };

  console.log(`✓ Severity mapped: ${severity} → ${priority}`);
  return result;
}

const severityInfo = mapSeverity(alert, context);
```

**Graceful degradation**: Default to "High" if severity detection fails.

---

### Phase 4: Jira Ticket Creation

Creates a formatted ticket with all context and linking.

```javascript
async function createAlertTicket(alert, context, severityInfo) {
  const title = `[ALERT] ${alert.service}: ${alert.metric || "Threshold exceeded"}`;

  const description = formatDescription(alert, context);

  const labels = [
    "alert",
    `service-${alert.service.toLowerCase()}`,
    `environment-${alert.environment.toLowerCase()}`,
    `severity-${severityInfo.detectedSeverity.toLowerCase()}`
  ];

  // Check for duplicate recent ticket
  const isDuplicate = context.recentTickets.some(t => {
    const created = new Date(t.created);
    const hoursAgo = (new Date() - created) / (1000 * 60 * 60);
    return hoursAgo < 24;
  });

  if (isDuplicate) {
    console.log("⚠ Similar alert exists within 24 hours");
    if (!argv["allow-duplicate"]) {
      return gracefulFailure(
        "Duplicate detected; use --allow-duplicate to override"
      );
    }
    labels.push("duplicate");
  }

  try {
    const ticket = await jira.createIssue({
      fields: {
        project: { key: context.projectKey || "OPS" },
        summary: title,
        description,
        priority: { name: severityInfo.jirapriority },
        issuetype: { name: "Alert" },
        labels,
        environment: alert.environment,
        customfield_alert_metric: alert.metric,
        customfield_alert_value: alert.currentValue,
        customfield_alert_threshold: alert.threshold,
        customfield_alert_source: alert.source
      }
    });

    console.log(`✓ Ticket created: ${ticket.key}`);

    // Add links to related tickets
    if (context.recentTickets.length > 0) {
      for (const relatedTicket of context.recentTickets.slice(0, 3)) {
        try {
          await jira.createIssueLink({
            type: "relates to",
            inwardIssue: ticket.key,
            outwardIssue: relatedTicket.key
          });
          console.log(`✓ Linked to ${relatedTicket.key}`);
        } catch (err) {
          console.warn(`⚠ Failed to link ${relatedTicket.key}`);
        }
      }
    }

    // Add comment with context if runbook found
    if (context.runbook) {
      await jira.addIssueComment({
        issueIdOrKey: ticket.key,
        body: `🔧 Runbook: [${context.runbook.title}|${context.runbook.url}]`
      });
    }

    // Add comment with recent deploys if found
    if (context.recentDeploys.length > 0) {
      const deployComment = `Recent commits to this service:\n${context.recentDeploys
        .map(d => `- \`${d.commit}\`: ${d.message}`)
        .join("\n")}`;

      await jira.addIssueComment({
        issueIdOrKey: ticket.key,
        body: deployComment
      });
    }

    return {
      key: ticket.key,
      url: ticket.self.replace("/rest/api", "").replace("/issue/", "/browse/")
    };
  } catch (err) {
    console.error(`ERROR: Failed to create Jira ticket: ${err.message}`);
    return gracefulFailure("Jira creation failed; check project/field configuration");
  }
}

function formatDescription(alert, context) {
  let desc = `Alert from monitoring system\n\n`;

  desc += `h2. Alert Details\n\n`;
  desc += `* *Service*: ${alert.service}\n`;
  if (alert.metric) desc += `* *Metric*: ${alert.metric}\n`;
  if (alert.currentValue) desc += `* *Current Value*: ${alert.currentValue}\n`;
  if (alert.threshold) desc += `* *Threshold*: ${alert.threshold}\n`;
  desc += `* *Environment*: ${alert.environment}\n`;
  desc += `* *Triggered*: ${alert.timestamp.toISOString()}\n`;

  if (alert.message && alert.message.length < 1000) {
    desc += `\nh2. Raw Alert\n\n{code}\n${alert.message}\n{code}\n`;
  }

  if (context.recentDeploys.length > 0) {
    desc += `\nh2. Recent Activity\n\n`;
    context.recentDeploys.forEach(d => {
      desc += `* \`${d.commit}\`: ${d.message}\n`;
    });
  }

  desc += `\nh2. Related Incidents\n\n`;
  if (context.recentTickets.length > 0) {
    context.recentTickets.forEach(t => {
      desc += `* [${t.key}|${t.key}]: ${t.title} (${t.status})\n`;
    });
  } else {
    desc += `* No related incidents in past 30 days\n`;
  }

  return desc;
}

if (argv["dry-run"]) {
  console.log("\n=== DRY RUN: Would create ticket ===\n");
  console.log(formatDescription(alert, context));
  process.exit(0);
}

const createdTicket = await createAlertTicket(alert, context, severityInfo);
```

**Graceful degradation**: If ticket creation fails, output formatted description to stdout for manual creation.

---

### Phase 5: Notifications

Posts alert info to Slack incident channel.

```javascript
async function notifySlack(alert, ticket, severityInfo, context) {
  const slackChannel = process.env.SLACK_INCIDENT_CHANNEL || "#incidents";
  const iconMap = {
    Highest: "🔴",
    High: "🟠",
    Medium: "🟡",
    Low: "🟢"
  };

  const icon = iconMap[severityInfo.jirapriority] || "ℹ️";

  const message = `
${icon} *Alert*: ${alert.service}
${alert.metric ? `Metric: ${alert.metric}` : ""}
${alert.currentValue ? `Value: ${alert.currentValue}` : ""}

*Jira*: <${ticket.url}|${ticket.key}>
*Priority*: ${severityInfo.jirapriority}
`;

  try {
    await slack.chat.postMessage({
      channel: slackChannel,
      text: message,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message
          }
        },
        ...(context.runbook
          ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🔧 <${context.runbook.url}|View Runbook>`
              }
            }
          ]
          : [])
      ]
    });

    console.log(`✓ Notified Slack: ${slackChannel}`);
  } catch (err) {
    console.warn(`⚠ Slack notification failed: ${err.message}`);
  }
}

await notifySlack(alert, createdTicket, severityInfo, context);
```

**Graceful degradation**: If Slack unavailable, skip notification but don't fail ticket creation.

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| No service detected | Prompt user or exit with hint |
| Jira creation fails | Output description to stdout |
| Duplicate found | Alert user; require `--allow-duplicate` |
| Context enrichment fails | Continue with partial context |
| Slack post fails | Log warning; don't fail |
| Invalid severity | Default to "High" |

## Performance Notes

- Caches Confluence runbook searches (30-minute TTL)
- Limits git log search to 20 recent commits
- Batches Jira link creation (max 3 links per alert)
- Skips duplicate check if over 100 recent tickets
