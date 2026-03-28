---
name: sprint-tickets
description: "View current sprint's full state: tickets, status, assignments, velocity, and health metrics"
---

# Sprint Tickets Command

This command displays your current sprint in a clean, scannable format with complete ticket details, sprint health metrics, and filtering options.

## Usage

```bash
/sprint-tickets                          # Full sprint view
/sprint-tickets --assignee me            # Your assigned tickets
/sprint-tickets --status "In Progress"   # Specific status
/sprint-tickets --label "bug"            # By label
/sprint-tickets --priority high          # By priority
/sprint-tickets --group assignee         # Group by assignee instead of status
/sprint-tickets --format detailed        # Show full descriptions
```

## Arguments

- `--assignee <name|me>` - Filter by assignee (use "me" for current user)
- `--status <status>` - Filter by status (To Do, In Progress, In Review, Done, etc.)
- `--label <label>` - Filter by label
- `--priority <priority>` - Filter by priority (Highest, High, Medium, Low, Lowest)
- `--group <by>` - Group by: status (default), assignee, priority, label
- `--format <format>` - Output format: compact (default), detailed
- `--board <board-id>` - Override stored board ID (for multi-board projects)
- `--include-archived` - Include archived/closed sprints (use with caution)

## First Run: Auto-Detection

On first run, the command will:
1. Fetch all agile boards accessible to the user
2. If only one board exists, use it automatically
3. If multiple boards exist, prompt user to select
4. Store board ID and project key in memory for future sessions
5. Auto-detect the currently active sprint

To reset stored board preference: `/sprint-tickets --reset-board`

## Output Format

### Sprint Overview Header

```
╔════════════════════════════════════════════════════════════════════╗
║ SPRINT: Sprint 24 "Q1 Core Features"                              ║
║ Goal: Improve dashboard performance and add bulk operations       ║
║ Dates: 2026-03-24 → 2026-04-07 (15 days)                         ║
║ Status: 12 days remaining • 47% complete (47/100 points)         ║
╠════════════════════════════════════════════════════════════════════╣
║ Velocity: 100 pts/sprint | Capacity: 120 hrs | Team: 4 members   ║
║ Burndown: ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚════════════════════════════════════════════════════════════════════╝
```

### Tickets by Status (Default Grouping)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TO DO (4 tickets, 18 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[HIGH] PROJ-1234 | Add bulk export functionality | 8 pts | @sarah.chen
       └─ Assignee: Sarah Chen | Due: 2026-03-31 | Labels: feature, ui
       └─ Description: Users should be able to export multiple records
       └─ Acceptance: [✓] API endpoint | [ ] UI integration | [ ] Tests
       └─ Blocked by: PROJ-1200 | Related: PROJ-1235, PROJ-1236
       └─ Comments: 3 recent

[MEDIUM] PROJ-1235 | Update export templates | 5 pts | @alex.kim
         └─ Assignee: Alex Kim | Labels: feature
         └─ Description: Create CSV, JSON, PDF export templates
         └─ Blocked: YES (waiting on PROJ-1234)
         └─ Comments: 2 recent

[MEDIUM] PROJ-1243 | Documentation: bulk operations | 3 pts | Unassigned
         └─ Due: 2026-04-02 | Labels: documentation, help
         └─ Description: Write comprehensive guide for bulk features
         └─ Comments: 1 recent

[LOW] PROJ-1250 | Add preference settings | 2 pts | @alex.kim
      └─ Description: User export preferences storage
      └─ Comments: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IN PROGRESS (5 tickets, 35 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[HIGH] PROJ-1200 | Optimize dashboard queries | 13 pts | @jordan.lee
       └─ Assignee: Jordan Lee | Due: 2026-03-29 | Progress: 60%
       └─ Description: Reduce query time from 2s to 400ms for dashboard load
       └─ Acceptance: [✓] Backend optimization | [✓] Caching layer | [ ] E2E tests
       └─ Links: Blocking PROJ-1234, PROJ-1235
       └─ Attachments: 2 | Comments: 5 recent

... (additional tickets)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IN REVIEW (3 tickets, 15 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

... (tickets)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DONE (3 tickets, 32 points)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

... (completed tickets)
```

### Sprint Health Summary

```
╔════════════════════════════════════════════════════════════════════╗
║ SPRINT HEALTH                                                      ║
╠════════════════════════════════════════════════════════════════════╣
║ Points Distribution:                                               ║
║   To Do:       18 pts (18%)  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║   In Progress: 35 pts (35%)  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║   In Review:   15 pts (15%)  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║   Done:        32 pts (32%)  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║                                                                    ║
║ 🚨 BLOCKED TICKETS: 2                                              ║
║    • PROJ-1235 (waiting on PROJ-1234)                              ║
║    • PROJ-1242 (Code review pending)                               ║
║                                                                    ║
║ 📋 UNASSIGNED: 1 ticket (3 pts)                                    ║
║    • PROJ-1243 (Documentation)                                     ║
║                                                                    ║
║ ⏰ OVERDUE: 0 tickets                                               ║
║ 🔴 DUE THIS WEEK: 2 tickets                                        ║
║    • PROJ-1200 (Due: 2026-03-29)                                   ║
║    • PROJ-1234 (Due: 2026-03-31)                                   ║
║                                                                    ║
║ Team Workload:                                                     ║
║   Sarah Chen:   42 pts | Jordan Lee:  38 pts | Alex Kim:  28 pts  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Grouped by Assignee

```
╔════════════════════════════════════════════════════════════════════╗
║ SARAH CHEN (4 tickets, 42 points)                                  ║
╠════════════════════════════════════════════════════════════════════╣
│ [HIGH] PROJ-1234 - Add bulk export functionality (8 pts) | In Progress│
│ [HIGH] PROJ-1210 - Auth improvements (18 pts) | In Review         │
│ [MEDIUM] PROJ-1256 - Testing (12 pts) | To Do                     │
│ [LOW] PROJ-1290 - Polish (4 pts) | Done                           │

╔════════════════════════════════════════════════════════════════════╗
║ JORDAN LEE (3 tickets, 38 points)                                  ║
╠════════════════════════════════════════════════════════════════════╣
│ [HIGH] PROJ-1200 - Optimize dashboard queries (13 pts) | Progress │
│ [HIGH] PROJ-1245 - API design (15 pts) | In Review                │
│ [MEDIUM] PROJ-1255 - Caching (10 pts) | To Do                     │

... (additional team members)
```

## Detailed Format (`--format detailed`)

Includes full ticket descriptions and recent comments:

```
[HIGH] PROJ-1234 | Add bulk export functionality | 8 pts | @sarah.chen
Status: In Progress | Due: 2026-03-31 | Labels: feature, ui, high-value

DESCRIPTION
Users should be able to export multiple records at once in various formats
(CSV, JSON, PDF). This feature requires a new backend endpoint, frontend UI
components, and comprehensive test coverage.

ACCEPTANCE CRITERIA
 [✓] Implement /api/export endpoint supporting multiple formats
 [✓] Design and implement React export dialog component
 [ ] Add E2E tests for all export formats
 [ ] Add unit tests for format validators
 [ ] Update API documentation

RECENT COMMENTS (3)
• Jordan Lee (2 hours ago)
  "Ready to review the API implementation when you push. Let me know about
   the file size limits you're planning."

• Sarah Chen (1 day ago)
  "Starting frontend work today. Using react-csv library for CSV export."

LINKED ISSUES
Depends on: PROJ-1200 (Optimize dashboard queries)
Blocks: PROJ-1235 (Update export templates), PROJ-1236 (Export guide)
Related: PROJ-890 (Legacy export feature)

ATTACHMENTS
• api-schema.json (shared 2 days ago)
• export-wireframes.png (shared 3 days ago)
```

## Implementation Flow

### 1. Initialization & Memory Management

```
Load stored context from memory:
  - board_id (Jira board ID)
  - project_key (Jira project key)
  - user_id (Current Jira user)
  - last_board_access (timestamp)

If context missing or --reset-board flag:
  - Call: jira_get_agile_boards()
  - Display boards for selection
  - Store selected board_id in memory
```

### 2. Fetch Sprint Data

```
Call: jira_get_sprints_from_board(board_id=stored_board_id)

Handle states:
  ✓ Active sprint found
    → Proceed to fetch tickets

  ✗ No active sprint
    → Display: "No active sprint. Recent sprints:"
    → Show 3 most recent closed sprints with option to view
    → Suggest creating new sprint

  ⚠ Multiple active sprints (edge case)
    → Display all with option to select
    → Use most recently started by default
```

### 3. Fetch Tickets (CRITICAL: Sprint Scope Only)

**Always scope queries to the specific active sprint ID. Never query the board or backlog directly.**

```
CORRECT approach — use sprint-scoped query:

  Primary method:
    jira_get_sprint_issues(sprintId: <active_sprint_id>)
    → Returns ONLY tickets in this sprint (excludes backlog and future sprints)

  With filters — use JQL scoped to sprint ID:
    Base JQL: sprint = {active_sprint_id} ORDER BY rank ASC
    + Assignee: AND assignee = {user_id}
    + Status:   AND status = "{status}"
    + Label:    AND labels = {label}
    + Priority: AND priority = {priority}

    Call: jira_search(jql=built_query, maxResults=100)

WRONG approaches — DO NOT USE:
  ✗ jira_get_board_issues(boardId)  ← Returns ALL board tickets including backlog
  ✗ sprint in openSprints()         ← May match multiple sprints
  ✗ project = X                     ← Returns entire project backlog

Validation after fetch:
  - Verify ticket count is reasonable (< 30 for typical sprint)
  - If > 50 tickets returned, warn: "Unusually high ticket count — verify sprint scope"
  - Confirm all tickets have sprint field matching active sprint ID
```

### 4. Fetch Detailed Information

```
For each ticket:
  - Call: jira_get_issue(issue_id)
    → Get: full description, links, subtasks, attachments

  - Call: jira_get_comments(issue_id)
    → Get: last 3 comments with author, date, text
    → Skip if 0 comments

  Cache results to avoid redundant calls
```

### 5. Calculate Sprint Health

```
Data to calculate:
  ✓ Total points in sprint
  ✓ Points by status (distribution)
  ✓ Completion percentage: done_points / total_points
  ✓ Burndown: expected daily burn vs actual
  ✓ Blocked tickets: any with "blocked" status or "Blocked By" link
  ✓ Unassigned tickets: assignee is empty
  ✓ Overdue tickets: duedate < today
  ✓ Due soon: duedate within 7 days
  ✓ Team workload: sum points per assignee
```

### 6. Format & Display

```
Build formatted output:
  1. Sprint overview header (name, goal, dates, progress)
  2. Health summary section (or skip if --group assignee)
  3. Tickets grouped by filter + grouping argument
  4. Health details footer
  5. Quick actions (if applicable)
```

## Edge Cases & Handling

### No Active Sprint

```
╔════════════════════════════════════════════════════════════════════╗
║ ⚠ NO ACTIVE SPRINT                                                 ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║ There is no active sprint in this board.                           ║
║                                                                    ║
║ Recent Sprints:                                                    ║
║   1. Sprint 23 (Completed) - 2026-03-10 to 2026-03-23 | 98 points ║
║   2. Sprint 22 (Completed) - 2026-02-24 to 2026-03-09 | 95 points ║
║   3. Sprint 21 (Completed) - 2026-02-10 to 2026-02-23 | 92 points ║
║                                                                    ║
║ Options:                                                           ║
║   • /sprint-tickets --board {board-id}  (try different board)     ║
║   • /jira-create-sprint                 (create new sprint)        ║
║   • /jira-sprint-velocity                (review historical data)  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Sprint Ending Soon (< 3 days)

```
╔════════════════════════════════════════════════════════════════════╗
║ ⏰ SPRINT ENDING SOON: 2 days remaining                             ║
║                                                                    ║
║ 🔴 9 points still in "To Do" or "In Progress"                      ║
║ 🟡 3 tickets unassigned                                            ║
║ 🟡 2 tickets blocked                                               ║
║                                                                    ║
║ Recommended actions:                                               ║
║   → Move non-critical work to next sprint                          ║
║   → Unblock PROJ-1235, PROJ-1242                                   ║
║   → Assign PROJ-1243, PROJ-1256, PROJ-1290                         ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Multiple Filter Combinations

```
Example: /sprint-tickets --assignee me --status "In Progress" --priority high

The command will:
  1. Filter to tickets assigned to current user
  2. Further filter to "In Progress" status
  3. Further filter to "high" or "highest" priority
  4. Display filtered results in the default grouping (by status)

Result display: "Showing 3 of 15 sprint tickets (filters applied)"
```

## JQL Reference for Common Patterns

```
Current sprint:
  sprint = SPRINT_ID

All active sprints on board:
  sprint in openSprints() AND board = BOARD_ID

Unstarted work:
  sprint = SPRINT_ID AND status = "To Do"

High priority work:
  sprint = SPRINT_ID AND priority >= High

Blocked items:
  sprint = SPRINT_ID AND (status = Blocked OR issueLink in blockedBy)

Overdue:
  sprint = SPRINT_ID AND duedate < now()

Your work:
  sprint = SPRINT_ID AND assignee = currentUser()

Team capacity:
  sprint = SPRINT_ID AND assignee in (user1, user2, user3)

Without story points:
  sprint = SPRINT_ID AND points is EMPTY

Bugs in sprint:
  sprint = SPRINT_ID AND type = Bug

High-value features:
  sprint = SPRINT_ID AND labels = high-value
```

## Memory System

The command stores in session memory:

```json
{
  "sprint-tickets": {
    "board_id": "12345",
    "board_name": "My Project Board",
    "project_key": "PROJ",
    "user_id": "user-123",
    "last_accessed": "2026-03-27T14:32:00Z",
    "version": "1.0"
  }
}
```

Access pattern:
- On first run: memory is empty, auto-detect and store
- On subsequent runs: load stored values, skip auto-detect
- `--reset-board`: clear all stored values, force auto-detect next run
- Storage persists across sessions within same conversation thread

## Performance Considerations

- Batch API calls: fetch all tickets in one search, then fetch details
- Cache ticket details to avoid re-fetching on format changes
- Limit comments fetched to last 3 per ticket
- Show progress indicator for large sprints (50+ tickets)
- Default to compact format; use --format detailed only when specified

## Error Handling

```
Network/API errors:
  ✗ "Failed to connect to Jira. Check your connection and try again."

Permission errors:
  ✗ "You don't have permission to view this board. Contact your admin."

Invalid filters:
  ⚠ "Status 'In Progress' not found. Available: To Do, In Progress, In Review, Done"

Ambiguous board selection:
  "Found 3 boards. Which one? (reply with number 1-3)"

Missing stored board:
  → Auto-detect and store

Malformed dates:
  → Use "N/A" for display
```

## Integration Notes

- Uses Atlassian MCP: `jira_search`, `jira_get_issue`, `jira_get_comments`,
  `jira_get_sprints_from_board`, `jira_get_agile_boards`
- Memory system stores board context across commands
- Compatible with other claude-workflow commands (sprint-planning, etc.)
- Supports filtering combinations (AND logic for multiple filters)
- Output format is optimized for terminal readability and copy-paste

## Related Commands

- `/sprint-planning` - Plan and adjust sprint scope (requires this data)
- `/ticket-details <key>` - Deep dive into single ticket
- `/jira-search` - Custom JQL queries
- `/team-capacity` - Team workload analysis
