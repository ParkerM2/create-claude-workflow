---
name: incident-postmortem
description: "Blameless postmortem generation with root cause analysis and prevention tickets"
---

# Incident Postmortem Workflow

Complete incident-to-prevention pipeline: generate comprehensive blameless postmortems, create Jira tickets for prevention, detect incident patterns, and publish findings to Confluence with Slack notifications.

## Integration Points

- **Jira MCP**: Fetch incident tickets, auto-create prevention tickets, link postmortem
- **Slack MCP**: Extract incident channel messages, post postmortem summary
- **Confluence MCP**: Publish postmortem documents, create searchable knowledge base
- **GitHub MCP**: Query commits/PRs during incident window for timeline
- **Memory**: Incident history, pattern detection, prevention ticket tracking
- **Engineering Plugin**: Integration with `/incident-response` command output

## Workflow Phases

### Phase 1: Incident Intake & Data Gathering

Collect incident details from multiple sources:

1. **Incident Context Resolution**
   - Accept inputs (in priority order):
     - Jira incident ticket: `SEV1-2024-001`
     - Slack channel: `#incident-2026-03-27`
     - Direct description: "Database connection pool exhausted"
   - Auto-detect: Check memory for recent incidents (< 24 hours old)

2. **Interactive Incident Details** (if not provided)
   - Prompt user with structured form:
     ```
     Incident Title: _______________________________
     Severity (SEV1/2/3/4): _______
     Start Time (UTC): _______________________________
     End Time / Resolution Time (UTC): ______________
     Root Cause (brief): _____________________________
     Systems Affected: ______________________________
     Estimated User Impact: __________________________
     Lead Investigator: ______________________________
     ```

3. **Fetch from Jira Incident Ticket**
   - If `--ticket SEV1-2024-001` provided:
     - Call `jira_get_issue(SEV1-2024-001)`
     - Extract: Summary, description, status, timestamps
     - Get comments (investigation notes from team)
     - Identify: Reporter, assignee, watchers (participants)

4. **Fetch from Slack**
   - If `--slack-channel #incident-2026-03-27` provided:
   - Extract messages from incident window:
     - Initial report message and timestamp
     - Key investigation messages
     - Resolution confirmation
     - Message-based timeline of discovery
   - Identify participants: Extract @mentions and reactions

5. **Fetch from GitHub**
   - Query commits during incident window:
     ```
     git log --since="2026-03-27T14:30:00Z" --until="2026-03-27T15:45:00Z" --oneline
     ```
   - Query PRs merged during window:
     - Check if recent merge caused incident
     - Identify rollback commits if applicable

6. **Build Initial Incident Metadata**
   ```yaml
   incident_id: SEV1-2024-001
   title: "Database Connection Pool Exhaustion"
   severity: SEV1
   status: "resolved"
   start_time: 2026-03-27T14:30:00Z
   end_time: 2026-03-27T15:45:00Z
   duration_minutes: 75

   participants:
     - name: Alice Chen
       role: incident_commander
       github: achen
       slack: @achen
     - name: Bob Smith
       role: engineer

   data_sources:
     - jira: SEV1-2024-001
     - slack: "#incident-2026-03-27"
     - github: commits during window
   ```

**Error Handling:**
- Incident not found in Jira: Note "ticket not linked; use manual entry"
- Slack channel inaccessible: Note "Slack data unavailable" but continue
- Multiple incident tickets in window: Prompt for disambiguation
- No data sources: Require at minimum manual description

**Verification Checklist:**
- [ ] Incident ID/reference identified
- [ ] Severity level assigned
- [ ] Timeline window confirmed (start & end times)
- [ ] At least 2 data sources engaged or manual input provided
- [ ] Participants identified
- [ ] Impact scope estimated

### Phase 2: Timeline Reconstruction (Minute-by-Minute)

Build detailed chronological incident progression:

1. **Auto-Timeline from Data Sources**
   - Slack messages: Extract timestamps, content
   - GitHub commits: Commit timestamps, messages, authors
   - Jira updates: Status changes, comment timestamps
   - Combine and sort by timestamp

2. **Fill Timeline Gaps**
   - For each time gap > 5 minutes, prompt:
     - "What happened between 14:35 and 14:42?"
     - Allow: User input, skip, or auto-fill with "Investigating"
   - Build narrative timeline:
     ```
     14:30:00 — Alert triggered: High error rate (5% above baseline)
     14:30:15 — Alice on-call, acknowledges alert in Slack
     14:32:00 — Team joins #incident-2026-03-27
     14:35:00 — Bob identifies: Database connection timeout errors
     14:38:00 — Check DB connection pool metrics
     14:41:00 — Alice decides to restart connection pool
     14:42:15 — Connection pool restart in progress
     14:43:30 — Error rate normalizing
     14:45:00 — All systems back to baseline
     14:50:00 — Resolved: Post-incident monitoring active
     ```

3. **Extract Key Events**
   - Detection time: When did monitoring/user report incident?
   - Investigation duration: Time to identify root cause
   - Resolution time: Time from root cause to fix applied
   - Confirmation time: Time to verify system recovery
   - Calculate MTTR (Mean Time To Resolution): End - Start

4. **Impact Timeline**
   - User-facing impact (when did users notice?)
   - Propagation (how did incident spread?)
   - Isolation (when were affected systems quarantined?)
   - Recovery (how did systems restart?)

**Verification Checklist:**
- [ ] Timeline covers start to end time
- [ ] Events sorted chronologically
- [ ] Key decision points marked
- [ ] No gaps > 10 minutes without explanation
- [ ] Human-readable narrative created

### Phase 3: Root Cause Analysis (5 Whys)

Deep-dive investigation into underlying causes:

1. **Initial Symptom & Immediate Cause**
   - Symptom: "Database connection pool exhausted"
   - Immediate cause: "Connection pool configured for 100; load was 150 concurrent requests"

2. **5 Whys Questioning** (Blameless framing)
   ```
   Why 1: Why did connection pool exhaust?
      → Load exceeded pool capacity (150 > 100)

   Why 2: Why did load exceed capacity?
      → Recent feature deployed to 10% of users; feature polling database every 100ms

   Why 3: Why polling every 100ms (excessive)?
      → Developer intended 1s polling, misconfigured in config

   Why 4: Why wasn't config tested before deployment?
      → Load testing skipped (timeline pressure for release)

   Why 5: Why was timeline pressure applied?
      → Feature committed for sprint demo; no buffer for testing

   → Root Cause: Combination of inadequate load testing, config error, and timeline pressure
   ```

3. **Contributing Factors** (Not root cause, but enabled incident)
   - Monitoring alert threshold: 5% baseline (too late to prevent)
   - No connection pool circuit breaker: Didn't fail gracefully
   - Insufficient documentation: New feature polling behavior unclear

4. **Severity vs. Prevention Analysis**
   - What made this SEV1 (vs. SEV2)?
     - Duration: 75 minutes (business impact)
     - Users affected: 10% of user base (10K users)
     - Revenue impact: $X K (if quantifiable)
   - What prevented SEV0?
     - Graceful degradation: Feature toggle available
     - Load balancer: Distributed load across instances
     - Fallback DB pool: Read replica available

**Blameless Tone (Critical):**
- ❌ "Developer Alice misconfigured the polling interval"
- ✅ "Configuration error in feature polling (100ms instead of 1s) combined with inadequate pre-deployment load testing"
- ❌ "On-call engineer failed to respond immediately"
- ✅ "Alert threshold (5% increase) triggered 5 minutes after symptom onset; investigation took additional 3 minutes"

**Error Handling:**
- Root cause unclear after 5 whys: Note "investigation incomplete; recommend follow-up with {expert}"
- Multiple competing root causes: List all and note "likely multi-factor incident"
- Technical causes unclear: Escalate to SME; continue with provisional analysis

**Verification Checklist:**
- [ ] Immediate cause (mechanism) identified
- [ ] 5 whys completed (or noted as incomplete)
- [ ] Root cause stated clearly (blameless phrasing)
- [ ] Contributing factors listed
- [ ] Severity drivers identified

### Phase 4: Postmortem Document Generation

Compose comprehensive blameless postmortem:

1. **Document Structure** (Standard format)
   ```markdown
   # Incident Postmortem: {Incident Title}

   **Severity:** SEV1
   **Date:** 2026-03-27
   **Duration:** 75 minutes (14:30-15:45 UTC)
   **Report Generated:** 2026-03-27 16:30 UTC
   **Incident ID:** SEV1-2024-001

   ## Executive Summary
   [1-2 sentences describing what happened and impact]

   ## Impact
   ### Users & Services Affected
   - Services: {list affected services}
   - Users: {count} users affected ({percentage}% of user base)
   - Duration: 75 minutes of degraded service

   ### Business Impact (if quantifiable)
   - Estimated revenue impact: $X K
   - SLA violation: Yes / No
   - Critical customer accounts affected: {list or count}

   ### System Impact
   - Request error rate: 15% (peak)
   - Latency increase: 500ms average (baseline 50ms)
   - Dependent systems affected: Cache, Session store

   ## Timeline
   [Minute-by-minute reconstruction from Phase 2]

   ## Root Cause Analysis
   ### Symptom & Mechanism
   Database connection pool exhaustion under load.

   ### 5 Whys Analysis
   [Structured root cause from Phase 3]

   ### Blameless Root Cause Statement
   The incident resulted from three contributing factors:
   1. Configuration error (polling interval 100ms vs. 1s)
   2. Insufficient pre-deployment load testing
   3. Feature shipped without circuit breaker protection

   None of these factors alone would have caused SEV1;
   the combination exposed gaps in process.

   ### Contributing Factors (Not Root Cause)
   - Alert threshold too lenient
   - No automatic connection pool scaling
   - Database documentation unclear on connection limits

   ## What Went Well
   - Team responded immediately (< 2 minutes to acknowledge)
   - Feature flag allowed rapid containment
   - Cross-team collaboration effective
   - Customer communication clear and timely

   ## What Went Poorly
   - Detection delay: 5 minutes from symptom to monitoring alert
   - Load testing skipped due to timeline pressure
   - Configuration not peer-reviewed before deployment
   - No post-deployment smoke testing for polling behavior

   ## Action Items (Prevention)
   ### Immediate (This Sprint)
   - [ ] Config review process for feature flags (Alice, 3 days)
   - [ ] Add smoke tests for feature polling frequency (Bob, 1 week)
   - [ ] Update connection pool documentation (Charlie, 3 days)

   ### Short-term (Next Sprint)
   - [ ] Implement circuit breaker for DB connection pool (Squad, 1 sprint)
   - [ ] Add load testing to deployment checklist (Platform, 2 weeks)
   - [ ] Reduce alert threshold to 2% (On-call rotation, 3 days)

   ### Medium-term (Next Quarter)
   - [ ] Database connection auto-scaling research (Platform, 1 month)
   - [ ] Feature flag canary deployment validation (Infra, 6 weeks)
   - [ ] Developer on-call training program (HR, 2 months)

   ## Lessons Learned
   1. Configuration errors can cascade at scale; peer review catches 80% of issues
   2. Load testing under timeline pressure is essential, not optional
   3. Feature flags provide rapid mitigation but don't replace proper testing
   4. Cross-functional response strengthened by pre-defined roles

   ## Appendices
   ### A. Participants
   [List with roles and contributions]

   ### B. Supporting Data
   - Monitoring graphs: [links]
   - Database logs: [excerpt if relevant]
   - Deployment history: [changes in deployment window]

   ### C. External References
   - Related incidents: SEV2-2026-02-14 (similar polling issue)
   - Documentation: [links to architecture, deployment docs]
   ```

2. **Markdown Rendering**
   - Generate clean, readable Markdown
   - Include severity color codes: 🔴 SEV1, 🟠 SEV2, 🟡 SEV3, 🔵 SEV4
   - Add links to related: Jira tickets, Confluence pages, GitHub commits
   - Embed: Metrics, graphs, logs (if available as links)

3. **Document Metadata**
   ```yaml
   ---
   title: "Incident Postmortem: Database Connection Pool Exhaustion"
   incident_id: SEV1-2024-001
   severity: SEV1
   date: 2026-03-27
   duration_minutes: 75
   participants: [Alice Chen, Bob Smith, Charlie Davis]
   tags: [database, scaling, monitoring, config]
   related_incidents: [SEV2-2026-02-14]
   action_item_count: 8
   ---
   ```

**Error Handling:**
- Missing impact data: Mark as "TBD; customer impact unknown"
- Timeline gaps: Note "timeline incomplete; follow-up meeting recommended"
- Root cause inconclusive: State "investigation ongoing; preliminary analysis below"

**Verification Checklist:**
- [ ] Document structure complete
- [ ] Timeline chronological and detailed
- [ ] Root cause stated in blameless language
- [ ] Action items assigned with owners and dates
- [ ] Supporting data included or linked
- [ ] Metadata embedded

### Phase 5: Prevention Tickets (Jira Auto-Creation)

Create actionable Jira tickets for prevention:

1. **Categorize Action Items by Priority**
   - Immediate (This Sprint / 3-7 days): Security, customer-facing recurrence risk
   - Short-term (1-2 sprints / 2-4 weeks): Process improvements, automated detection
   - Medium-term (Quarter / 4-12 weeks): Infrastructure changes, major refactors

2. **Create Jira Ticket Per Action Item**
   - For each action:
     ```
     Project: Engineering / DevOps (configurable)
     Type: Story / Task
     Title: "[INCIDENT-PREVENTION] {Incident ID}: {Action Item Title}"
     Description:
       {Action description}

       Related Incident: {SEV1-2024-001}
       Category: {Root Cause / Contributing Factor / Process}

       **Why this matters:**
       {1-2 sentences on prevention impact}

       **Acceptance Criteria:**
       - [ ] {specific deliverable 1}
       - [ ] {specific deliverable 2}
       - [ ] {tested in staging}
       - [ ] {documented}

     Priority:
       - Immediate → Highest
       - Short-term → High
       - Medium-term → Medium

     Labels: ["incident-prevention", "SEV1-2024-001", "outage-prevention"]

     Due Date: {from action item}

     Assignee: {owner from action item}
     ```

3. **Link Prevention Tickets**
   - Link all tickets to incident Jira ticket: "Incident SEV1-2024-001"
   - Create epic: "Prevent SEV1-2024-001 Recurrence" (parent for tickets)
   - Cross-link: Tickets that address same root cause together

4. **Batch Creation**
   - Create all tickets in single operation to avoid duplicates
   - Return list: `[SEC-789, SEC-790, SEC-791, ...]`
   - Store in `memory/prevention-tickets.yaml`:
     ```yaml
     SEV1-2024-001:
       tickets:
         - SEC-789: Config review process (Immediate)
         - SEC-790: Circuit breaker implementation (Short-term)
       created_at: 2026-03-27T16:30:00Z
       status: all_created
     ```

**Error Handling:**
- Jira unavailable: Generate action item list in Markdown; note "manual ticket creation required"
- Assignee unavailable: Note "no assignee; requires team discussion" or assign to team lead
- Duplicate tickets exist: Link to existing vs. creating new

**Verification Checklist:**
- [ ] All action items have corresponding tickets
- [ ] Tickets linked to incident
- [ ] Owners assigned
- [ ] Due dates set
- [ ] Acceptance criteria clear
- [ ] Creation confirmed in Jira

### Phase 6: Pattern Detection (Historical Analysis)

Search for incident patterns:

1. **Query Past Incidents**
   - Search Jira: `project = Incidents AND created >= -6m ORDER BY created DESC`
   - Build list: All SEV1-3 incidents from last 6 months
   - Extract: Title, date, root cause, systems affected

2. **Pattern Matching**
   ```
   Current incident: "Database Connection Pool Exhaustion"

   Pattern 1 - Same Root Cause
   → Found: SEV2-2026-02-14 "High Database Load"
            Root cause: Feature polling database (not optimized)
            Note: Different feature, same underlying problem
            Recommendation: Add automatic detection for polling patterns

   Pattern 2 - Same Service
   → Found: SEV3-2026-01-20 "Database Timeout"
            Root cause: Query performance degradation
            Note: Different cause, same service fragile

   Pattern 3 - Same Time-of-Day Pattern
   → Check: Do incidents cluster around specific hours?
            e.g., "All incidents between 14:00-15:00 UTC"
            → May indicate scheduled batch job, peak traffic window

   Pattern 4 - Symptom Similarity
   → Found: "Connection Pool Exhaustion" appears in:
            SEV1-2026-03-27 (current)
            SEV2-2026-02-14 (2 months prior)
            SEV3-2025-11-30 (4 months prior)
            → This is a REPEAT PATTERN; needs systemic fix
   ```

3. **Risk Assessment**
   - If repeat pattern:
     - 🔴 **RED**: Same incident > 2 times in 6 months
     - 🟠 **ORANGE**: Related incidents, same subsystem > 2 times
     - 🟡 **YELLOW**: Similar symptoms, different root causes (systemic weakness)

4. **Escalation Recommendation**
   - If RED: "This is a repeat incident. Recommend escalation to platform/infrastructure team for systemic fix."
   - If ORANGE: "Connection pool issues recurring; warrants architectural review."
   - If YELLOW: "Database layer showing fragility; recommend capacity/monitoring improvements."

**Error Handling:**
- Jira search unavailable: Note "pattern detection skipped; requires historical data"
- Too many similar incidents: Summarize top 3; note "review full history in Jira"

**Verification Checklist:**
- [ ] Historical incidents retrieved
- [ ] Pattern matches found (if any)
- [ ] Repeat incident status determined
- [ ] Risk level assigned
- [ ] Escalation recommendation provided (if applicable)

### Phase 7: Publishing & Notifications

Publish postmortem and notify team:

1. **Save Postmortem to Confluence**
   - Call `confluence_create_page`:
     ```
     Space: Engineering or Incident Knowledge Base
     Title: "Postmortem: {Incident Title} ({Date})"
     Parent: "Incident Reports / {Year}-{Month}" (tree structure)
     Content: {Generated Markdown}
     Labels: ["incident", "postmortem", "SEV1", incident_id]
     ```
   - Publish (not draft)
   - Return URL for linking

2. **Link to Incident Ticket**
   - Update incident Jira ticket:
     - Add postmortem link in description
     - Add postmortem as "relates to" link
     - Add prevention tickets as "relates to"
   - Change ticket status: "Resolved → Closed (Postmortem)"

3. **Post to Slack**
   - Post in #incidents or team channel:
     ```
     ✅ Postmortem complete: SEV1-2024-001

     📋 Incident: Database Connection Pool Exhaustion
     Duration: 75 minutes (14:30-15:45 UTC)
     Impact: 10K users, 15% error rate

     🔍 Root Cause: Config error + inadequate load testing

     🎯 Action Items: 8 tickets created (3 immediate)

     📖 Full Postmortem: [Confluence Link]
     🎫 Prevention Tickets: [Jira Epic Link]

     Team standup review scheduled for tomorrow 10 AM.
     ```
   - Thread reply: @ team members thanking for response

4. **Standup Reminder** (Optional)
   - If `--schedule-standup` flag:
     - Create meeting: "Postmortem Standup: {Incident}"
     - Attendees: Incident commander, engineers, on-call lead
     - Duration: 30 minutes
     - Agenda: Review postmortem, assign prevention ticket owners, discuss escalations

5. **Memory Archive**
   - Store in `memory/incident-postmortems.yaml`:
     ```yaml
     SEV1-2024-001:
       title: "Database Connection Pool Exhaustion"
       date: 2026-03-27
       severity: SEV1
       duration_minutes: 75
       impact_users: 10000
       root_causes: ["config_error", "inadequate_testing", "no_circuit_breaker"]
       confluence_url: "https://wiki.example.com/pages/..."
       jira_ticket: "SEV1-2024-001"
       prevention_tickets: ["SEC-789", "SEC-790", ...]
       pattern_match: "repeat_incident"
       published_at: 2026-03-27T16:35:00Z
     ```

**Error Handling:**
- Confluence unavailable: Save Markdown locally; note "manual publish required"
- Slack unavailable: Note "notification not sent; manual posting required"
- Jira link fails: Try again with backoff; log for manual follow-up

**Verification Checklist:**
- [ ] Postmortem published to Confluence
- [ ] Link added to incident Jira ticket
- [ ] Prevention tickets linked to incident
- [ ] Slack notification posted
- [ ] Memory archive updated
- [ ] Standup scheduled (if applicable)

## Configuration & Memory

### Incident Severity Classification
Store in `memory/severity-config.yaml`:
```yaml
SEV1:
  description: "Complete service outage or critical data loss"
  duration_threshold: "any"
  user_impact: "widespread"
  response_time: "< 5 minutes"
  postmortem_required: true
  post_incident_review: true

SEV2:
  description: "Significant degradation affecting some users"
  duration_threshold: "> 15 minutes"
  user_impact: "partial"
  response_time: "< 15 minutes"
  postmortem_required: false  # unless recurring

SEV3:
  description: "Minor issues with workarounds available"
  user_impact: "minimal"
  postmortem_required: false

SEV4:
  description: "Informational; no user impact"
  postmortem_required: false
```

### Incident History & Pattern Detection
Store in `memory/incident-postmortems.yaml` (append-only log).

### Action Item Template
Store in `memory/action-item-template.yaml`:
```yaml
template:
  immediate_due_days: 3
  short_term_due_days: 14
  medium_term_due_days: 60
  immediate_priority: "Highest"
  short_term_priority: "High"
  medium_term_priority: "Medium"
```

## Usage Examples

```bash
# Generate postmortem from Jira incident ticket
/incident-postmortem --ticket SEV1-2024-001

# Generate postmortem from Slack incident channel
/incident-postmortem --slack-channel #incident-2026-03-27

# Interactive: Prompt for incident details
/incident-postmortem

# Generate postmortem from incident-response command output
/incident-postmortem --from-incident-response

# Skip pattern detection (faster)
/incident-postmortem --ticket SEV1-2024-001 --skip-patterns

# Don't create prevention tickets automatically
/incident-postmortem --ticket SEV1-2024-001 --skip-tickets

# Create tickets but don't publish to Confluence
/incident-postmortem --ticket SEV1-2024-001 --create-tickets --draft

# Publish to Confluence and schedule standup
/incident-postmortem --ticket SEV1-2024-001 --publish --schedule-standup
```

## Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Incident ticket not found | Use manual entry; note source |
| Slack channel inaccessible | Continue with Jira/manual data only |
| Timeline incomplete | Note gaps; offer follow-up meeting |
| Root cause unclear | Mark as "investigation ongoing"; continue with partial analysis |
| Jira unavailable | Save Markdown; note manual ticket creation needed |
| Confluence down | Save to disk; provide Slack message with content |
| Pattern detection slow (1000+ incidents) | Use sampling; note "full analysis available separately" |
| All data sources unavailable | Require manual incident entry; offer template |

## Output Format

Success:
```
✅ Postmortem generated: SEV1-2024-001

📋 Document:
   Title: Database Connection Pool Exhaustion
   Severity: SEV1
   Duration: 75 minutes (14:30-15:45 UTC)
   Impact: 10K users, 15% error rate

🔍 Root Cause: Config error (100ms polling) + inadequate load testing + no circuit breaker

🎯 Action Items: 8 tickets created
   3 immediate (SEC-789, SEC-790, SEC-791)
   3 short-term (SEC-792, SEC-793, SEC-794)
   2 medium-term (SEC-795, SEC-796)

⚠️ Pattern Detection: REPEAT incident found (SEV2-2026-02-14)
   Recommendation: Escalate for systemic fix

📖 Published: Confluence Wiki
🎫 Prevention: Jira Epic link added
📌 Slack: Notification posted
```

Partial Success:
```
⚠️ Postmortem generated with limitations

✅ Document created (Confluence)
✅ Prevention tickets created (Jira)
❌ Pattern detection incomplete (Jira search failed)
⚠️ Slack notification not sent (connectivity issue)

Action: Manually post Slack notification; retry pattern detection when Jira available
```

## Integration Notes

- **Engineering Plugin**: Consume `/incident-response` command output directly
- **Slack Workflows**: Trigger postmortem generation on incident channel creation
- **GitHub**: Link to commits/PRs during incident window
- **Confluence**: Create multi-level hierarchy (Year/Month/Incidents)
- **Jira**: Bulk prevention ticket creation with linking
- **Memory**: Audit trail for trend analysis and AI learning

## Testing Checklist

- [ ] Incident detection from all 3 sources (Jira, Slack, manual)
- [ ] Timeline reconstruction fills gaps correctly
- [ ] 5 whys analysis produces blameless root causes
- [ ] Postmortem Markdown renders cleanly
- [ ] Prevention tickets created with correct owners/dates
- [ ] Pattern detection identifies repeat incidents
- [ ] Confluence publish preserves formatting
- [ ] Slack notification includes all key info
- [ ] Memory archive enables historical queries
- [ ] Multi-incident scenarios (concurrent incidents) handled
