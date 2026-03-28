---
name: link-ticket
description: "Auto-sync PR ↔ Jira ticket status with branch pattern detection and transitions"
---

# Link Ticket Workflow

Auto-sync GitHub PRs to Jira tickets with intelligent status transitions based on branch patterns, PR state, and ticket availability.

## Integration Points

- **Jira MCP**: `jira_get_issue`, `jira_change_issue_status`, `jira_get_transitions`, `jira_add_comment`
- **GitHub MCP**: Current branch detection, PR URL parsing
- **Memory**: Project key storage, recent linkages
- **Anthropic Engineering Plugin**: Deployment status updates (via status transitions)

## Workflow Phases

### Phase 1: Detection (Branch & Ticket Extraction)

Extract ticket identifiers from current context:

1. **Branch Pattern Parsing**
   - Support patterns:
     - `feature/DEV-1234-description` → `DEV-1234`
     - `fix/PROJ-567/bug-title` → `PROJ-567`
     - `DEV-1234/description` → `DEV-1234`
     - `DEV-1234` → `DEV-1234`
     - Commits with `[DEV-1234]` → `DEV-1234`
   - Regex: `([A-Z][A-Z0-9]+-\d+)`
   - Extract all matches, prioritize first occurrence

2. **Current Context Resolution**
   - Try: current git branch → git commit message → provided argument
   - Command: `git rev-parse --abbrev-ref HEAD`
   - If no branch pattern, prompt user for ticket key or PR URL

3. **Project Key Inference**
   - Extract from ticket (e.g., `DEV-1234` → `DEV`)
   - Check memory for cached project keys
   - If new project, store in `memory/project-keys.yaml`

**Verification Checklist:**
- [ ] Ticket key matches pattern `[A-Z]+-\d+`
- [ ] Project key cached or inferrable
- [ ] No ambiguous matches (e.g., two different projects in branch name)

### Phase 2: Validation (Jira & GitHub)

Verify that ticket and (if applicable) PR exist:

1. **Jira Ticket Validation**
   - Call `jira_get_issue` with extracted ticket key
   - If not found: Graceful degradation — log warning, ask user to create ticket or correct key
   - Extract ticket metadata: summary, status, type, assignee, current transitions
   - Store full issue data for Phase 4

2. **GitHub PR Detection (if applicable)**
   - If user provides PR URL: validate format and existence
   - If linking existing PR: verify branch matches ticket pattern
   - Call GitHub API to get PR state (open/closed/merged)
   - Extract PR number, branch, creator

3. **Bidirectional Check**
   - Does PR description already contain Jira link? → Skip linking phase
   - Does Jira ticket already mention this PR? → Skip adding comment

**Error Handling:**
- Ticket not found: `WARN | Ticket DEV-1234 not found in Jira. Create it now? [y/n]`
- PR not found: `WARN | PR not found. Provide PR number/URL or create draft PR first.`
- Multiple matches (rare): Prompt for disambiguation

**Graceful Degradation:**
- Missing Jira: Continue with GitHub linking only
- Missing GitHub: Continue with Jira linking only
- No connections available: Provide manual instructions

### Phase 3: Link Creation

Add bidirectional references:

1. **Add Jira Comment**
   - Format: Automated link from PR → Jira ticket
   - Content:
     ```
     🔗 [PR#123] {owner}/{repo}: {pr_title}
     Status: {current_pr_status}
     Branch: {branch_name}
     Last commit: {commit_hash} {commit_message}
     Linked: {timestamp}
     ```
   - Call `jira_add_comment` with comment body
   - Mark comment as "Automation" or flag internal system comment if supported

2. **Update PR Description**
   - If creating new PR or PR description lacks Jira link:
   - Append (if exists) or create section:
     ```
     ## Jira Ticket
     📋 [{ticket_key}] {ticket_summary}
     ```
   - Extract PR URL in form: `github.com/{owner}/{repo}/pull/{number}`

3. **Create Memory Record**
   - Store linking in `memory/ticket-pr-links.yaml`:
     ```yaml
     DEV-1234:
       pr_number: 123
       repo: owner/repo
       linked_at: 2026-03-27T14:30:00Z
       last_sync: 2026-03-27T14:30:00Z
     ```

**Verification Checklist:**
- [ ] Jira comment added successfully (or explanation if failed)
- [ ] PR description updated (if applicable)
- [ ] Memory record created
- [ ] No duplicate links/comments created

### Phase 4: Status Sync (State Transitions)

Transition ticket status based on PR state and branch lifecycle:

1. **Determine Current State**
   ```
   git_event = "branch_created" | "pr_opened" | "pr_merged" | "pr_closed"
   current_ticket_status = jira_get_issue(ticket_key).status
   pr_state = "open" | "closed" | "merged"
   ```

2. **Fetch Available Transitions**
   - Call `jira_get_transitions(ticket_key)`
   - Build map: `available_transitions = {name: transition_id}`

3. **Transition Logic (Deterministic State Machine)**
   ```
   if git_event == "branch_created":
       target = "In Progress"
   elif git_event == "pr_opened":
       target = "In Review"
   elif git_event == "pr_merged":
       target = "Done"
   elif git_event == "pr_closed" and not pr_was_merged:
       target = "In Progress"  # Reopen for rework
   else:
       target = None  # No transition needed

   if target and target in available_transitions:
       transition_id = available_transitions[target]
       jira_change_issue_status(ticket_key, transition_id)
       log_transition(ticket_key, current_status, target)
   elif target and target not in available_transitions:
       WARN "Transition '{target}' not available for {ticket_key}. Current status: {current_status}"
       log_available(available_transitions.keys())
   ```

4. **Transition with Metadata**
   - Include comment: `"Auto-transitioned via PR #{pr_number} {action}"`
   - Update PR draft status if in Jira
   - Handle workflow blockers gracefully (e.g., "Needs Review Before Closing" → prompt review)

**Error Handling:**
- Transition not available: Log as warning, suggest manual transition
- Transition blocked by automation rule: Include rule name in warning
- Jira workflow disabled: Notify and continue without status update

**Verification Checklist:**
- [ ] Available transitions fetched from Jira
- [ ] Target status determined correctly
- [ ] Transition executed (or error logged)
- [ ] Ticket status updated in Jira

### Phase 5: Ongoing Monitoring (Optional `--watch`)

Enable auto-sync via git hooks:

1. **Hook Installation**
   ```bash
   --watch: Install git hooks
   post-checkout: Detect branch change, extract ticket, link/sync
   post-merge: Detect merged PR, transition ticket to "Done"
   post-commit: If commit message contains [TICKET], sync status
   ```

2. **Hook Logic**
   - Lightweight: Extract ticket from branch/message, call linking workflow
   - Rate limit: Cache results for 30 seconds (prevent double-triggers)
   - Fail silently: Don't block git operations

3. **Deactivation**
   - `--unwatch`: Remove hooks
   - `--watch-config`: Show installed hooks and status

## Configuration & Memory

### Team Configuration
Store in `memory/team-config.md`:
```yaml
projects:
  DEV:
    jira_key: DEV
    github_org: myorg
    github_repos: [backend, frontend]
    auto_link: true
    auto_transition: true
  PROJ:
    jira_key: PROJ
    github_org: anotherorg
    github_repos: [main-repo]
```

### Ticket-PR Linkage History
Store in `memory/ticket-pr-links.yaml` for quick lookup.

## Usage Examples

```bash
# Auto-detect current branch, link to ticket, sync status
/link-ticket

# Explicit: link DEV-1234 to PR https://github.com/org/repo/pull/42
/link-ticket DEV-1234 https://github.com/org/repo/pull/42

# Enable auto-sync via git hooks
/link-ticket --watch

# Disable auto-sync
/link-ticket --unwatch

# Sync a specific ticket without PR
/link-ticket DEV-1234 --status-only
```

## Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Jira unavailable | Link PR only; store pending sync in memory |
| GitHub unavailable | Link Jira only; provide manual PR instructions |
| Ticket not found | Prompt to create; suggest JQL search for similar |
| Transition unavailable | Log available transitions; prompt manual action |
| No branch pattern | Prompt user for ticket key or skip auto-linking |
| PR already linked | Skip linking phase; still sync status |
| Merge conflict | Defer status update until merge confirmed |

## Output Format

Success:
```
✅ Linked DEV-1234 ↔ PR#42
   Jira: In Review
   GitHub: PR opened
   Next: Monitor for merge

📌 Synced status: "In Progress" → "In Review"
```

Partial Success:
```
⚠️ Linked DEV-1234, but status sync failed
   Available transitions: [In Review, In Dev, Done]
   Requested: In Review (already in progress)
   Action: Manual transition required
```

Failure:
```
❌ Cannot link: Ticket DEV-1234 not found in Jira
   Suggestions:
   1. Create ticket: jira.example.com/secure/CreateIssueDetails.jspa
   2. Verify key: DEV (correct)
   3. Check Jira connection
```

## Integration Notes

- **Jira Webhook (Optional)**: If webhook available, trigger link-ticket on issue status change for reverse sync
- **GitHub PR Checks**: Can integrate as GitHub status check (pass/fail based on Jira link)
- **Slack**: Post link summary to PR channel if configured
- **Memory**: All state persisted across sessions for audit trail

## Testing Checklist

- [ ] Branch pattern extraction works for all 4 formats
- [ ] Jira ticket validation handles missing tickets gracefully
- [ ] Status transitions respect workflow rules (no invalid paths)
- [ ] Watch hooks don't interfere with normal git operations
- [ ] Memory records updated after each linking
- [ ] Bidirectional linking prevents duplicates
- [ ] PR merge detection correctly identifies "merged" state
- [ ] Handles team migration (project key changes)
