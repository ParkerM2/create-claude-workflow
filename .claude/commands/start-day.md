---
name: start-day
description: "Morning briefing: end-of-day recap, missed notifications, today's sprint work, and smart prioritization. Requires memory setup (Jira project key + board ID). Works standalone with git/tasks, better with Slack/Jira/GitHub."
argument-hint: "[--force-refresh | --skip-setup]"
---

# /start-day

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).

Get a comprehensive morning briefing: what you shipped yesterday, what you missed overnight, what's due today, and how to prioritize it all.

## Usage

```bash
/start-day                    # Standard briefing
/start-day --force-refresh    # Bypass cache, pull fresh data from all sources
/start-day --skip-setup       # Skip first-run config if no memory exists
```

## How It Works

```
┌────────────────────────────────────────────────────────────────┐
│                    /START-DAY BRIEFING                            │
├────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                     │
│  ✓ Git log to find yesterday's commits                         │
│  ✓ Load tasks from TASKS.md                                    │
│  ✓ Recent progress files                                        │
├────────────────────────────────────────────────────────────────┤
│  ENHANCED (with task tracker)                                  │
│  + Current sprint tickets with descriptions                    │
│  + Assigned comments/mentions in Jira                          │
│  + Status changes by others overnight                           │
├────────────────────────────────────────────────────────────────┤
│  PREMIUM (with all tools)                                      │
│  + Slack: Mentions, DMs, high-priority channel messages        │
│  + GitHub: PR reviews, CI failures, new comments              │
│  + Jira: Blockers, dependency updates, team activity          │
└────────────────────────────────────────────────────────────────┘
```

## The Briefing (in order)

### 1. **End-of-Day Recap** (What You Shipped)
Summary of yesterday's work:
- Latest commits from git log
- Tasks marked complete in TASKS.md
- Activity from Jira (issues closed, PRs merged)
- Files modified (from git)

### 2. **Missed Notifications** (What Needs Your Attention)
Overnight activity prioritized by urgency:
- **🔴 Blockers:** Issues blocking your work, dependencies you own marked blocker
- **🟠 Mentions:** Slack/Jira mentions, direct messages, tags in comments
- **🟡 Status Changes:** Tickets assigned to you that changed status (not by you)
- **🔵 Requests:** PR reviews waiting, code comments needing response

### 3. **Today's Layout** (What's Due)
Current sprint tickets separated by status:
- **In Progress:** Tickets you're actively working on (ready to resume)
- **To-Do:** High-priority unstarted work (today's targets)
- **Waiting:** Work blocked or in review (no action needed yet)

### 4. **Smart Prioritization** (How to Spend Your Day)
Recommended order:
1. **Unblock others** — Fix blockers you own
2. **Urgent requests** — Handle P0 work and high-priority asks
3. **Sprint commitments** — Continue in-progress work
4. **New work** — Pick from today's to-do in sprint order

---

## First Run Setup

If no memory is found (first time using `/start-day`):

### Step 1: Discover Jira Config

Ask the user:
```
I need to find your Jira board and project to fetch your sprint.

1. What's your Jira project key? (e.g., MYPROJ, PLAT, INFRA)
2. What's your Jira board ID? (number, e.g., 42)
   → Find it in the board URL: jira.company.com/secure/RapidBoard.jspa?rapidView=BOARD_ID

Alternatively, I can search your Jira instance for boards assigned to you.
```

### Step 2: Save to Memory

Once you have project key + board ID, save to `memory/start-day-config.md`:

```markdown
# /start-day Config

## Jira
- Project Key: MYPROJ
- Board ID: 42
- Board Name: Platform Team

## Preferences
- Time zone: America/Los_Angeles
- Preferred sprint view: My Issues Only
- Include done items: false
```

Also update `CLAUDE.md` with quick reference:
```markdown
## Project
- Jira: **MYPROJ** (board #42)
```

### Step 3: Continue with Briefing

Once configured, proceed with standard briefing flow.

---

## Execution (Standard Flow)

### Phase 1: Load Memory & Check Connectors

1. **Load memory:**
   - Read `memory/start-day-config.md` (if exists)
   - Read `CLAUDE.md` for context
   - Read `TASKS.md`

2. **Check available MCP tools:**
   - Jira available? (project key + board ID required)
   - Slack available? (optional)
   - GitHub available? (optional)
   - Confluence available? (optional)

3. **Note gaps:**
   ```
   ✓ Git     (always available)
   ✓ TASKS.md (found)
   ✓ Jira    (found config)
   ✗ Slack   (not connected)
   ✗ GitHub  (not connected)
   ```

### Phase 2: Build Yesterday's Recap

Query git for commits in the last 24 hours:

```bash
git log --all --author="$(git config user.name)" \
  --since="24 hours ago" \
  --oneline
```

Parse output for:
- Commit messages (work done)
- Files touched (context)
- Branch names (features in flight)

Supplement with Jira (if available):

**JQL Query:**
```jql
project = MYPROJ
AND updated >= -1d
AND (status = Done OR status in (Closed, Merged, Shipped))
AND assignee = currentUser()
```

Extract:
- Issues closed (with descriptions)
- Points or effort completed
- Any key deployments

**From TASKS.md:**
- Check for items marked `[x]` (completed)
- Look at recent activity notes

**Format recap concisely:**
```
## Yesterday's Recap

**Shipped:**
- [MYPROJ-123] Fix critical bug in auth flow (2 hours)
- [MYPROJ-124] Update database indexes for perf (code review passed)
- 3 commits to feature/redesign

**Completed Tasks:**
- Set up staging environment for tomorrow's demo
- Updated team on Phoenix timeline

**Timeline:** 9:15am–5:30pm (2 breaks)
```

### Phase 3: Scan for Missed Notifications

#### 3a. Jira: Assigned Issues with Recent Activity

**JQL Query:**
```jql
project = MYPROJ
AND assignee = currentUser()
AND (
  status NOT IN (Done, Closed)
  OR updated >= -24h
)
```

For each issue:
- Check for comments since last check (if available in memory)
- Flag as "Comment Awaiting Response" if someone tagged you
- Check for status changes (moved to blocked, reopened, etc.)
- Note if dependency blocked you overnight

**Flag blockers:**
```jql
project = MYPROJ
AND (
  issuetype = Blocker
  OR status = Blocked
  OR resolution = Cannot Reproduce
)
AND assignee = currentUser()
```

#### 3b. Jira: Comments & Mentions

**JQL Query:**
```jql
project = MYPROJ
AND (
  comment >= -24h
  AND comment by currentUser() = false
)
AND (
  assignee = currentUser()
  OR watchers = currentUser()
)
```

Extract comments mentioning you or asking for response. Flag by urgency.

#### 3c. Slack (if available)

Search patterns:
```
1. Direct messages (DM unread count)
2. Mentions: @{username} in last 24h
3. High-priority channels: #incidents, #urgent, #blockers, #launches
4. Threads you're in that have new replies
```

Present as:
- **Unread DMs:** X messages
- **Mentions:** List by channel + author
- **Urgent channel activity:** #incidents (3 messages), #blockers (1)

#### 3d. GitHub (if available)

Search for:
```
1. PR reviews requested (assignee = @me, draft = false)
2. PR comments on your PRs (author = @me, comment.createdAt > 24h ago)
3. CI failures on your recent branches
4. Merge conflicts on in-flight PRs
```

Format:
```
## GitHub Notifications

**Waiting for you:**
- [PR #123] feat: dashboard redesign (review requested 2h ago)
- [PR #456] refactor: API layer (2 comments since you opened)

**Failures:**
- CI failing on feature/redesign (3 failed checks)
```

#### 3e. Confluence (optional)

If team uses Confluence, check for:
- New comments on docs you authored
- Mentions in recent docs
- Updates to docs you watch

### Phase 4: Load Today's Sprint Work

**Get current sprint:**

```jql
board = {BOARD_ID}
AND sprint in openSprints()
```

Parse response for sprint name + end date.

**Get your work in sprint:**

```jql
project = MYPROJ
AND sprint in openSprints()
AND assignee = currentUser()
AND status NOT IN (Done, Closed)
ORDER BY rank ASC
```

**Also fetch unstarted high-priority work:**

```jql
project = MYPROJ
AND sprint in openSprints()
AND status IN ("To Do", "Ready")
AND priority IN (Highest, High)
AND assignee is EMPTY
ORDER BY priority DESC, rank ASC
LIMIT 5
```

**For each ticket, fetch:**
- Issue key, title, description
- Status, priority, points
- Assignee (if not you), blockers
- Recent comment activity (hint about context)

### Phase 5: Structure the Briefing Output

```markdown
# 🌅 Morning Briefing — {Date}

## Yesterday's Recap

**Shipped:**
- [MYPROJ-123] Fix critical bug in auth (2 hours, merged)
- [MYPROJ-124] Update database indexes (code review passed)
- 3 commits to feature/redesign

**Completed Tasks:**
- Set up staging environment for tomorrow's demo
- Updated team on Phoenix timeline

---

## 🔴 Blockers & Urgent (3 items)

**Your blockers:**
1. [MYPROJ-105] *Waiting on API response from backend*
   - Status: Blocked, assigned to you
   - Notes: You set to blocked 2d ago, no progress

**Mention/questions for you:**
1. Slack: @you in #platform "when will auth fix ship?"
2. [MYPROJ-123] Comment from @sarah: "does this need database migration?"

**Team blockers affecting your work:**
1. [MYPROJ-150] Backend API not ready (assigned to @james)
   - You're waiting on this for [MYPROJ-124]

---

## 🔵 Notifications (5 items)

**PR Reviews Waiting:**
- [PR #123] feat: dashboard (review requested 2h ago by @maya)

**GitHub Mentions:**
- 1 new comment on your [PR #456] refactor: API

**Status Changes (by others):**
- [MYPROJ-125] moved from "In Progress" → "Ready for Review" by @dev
- [MYPROJ-130] reopened by @qa (failed tests)

---

## Today's Work (Current Sprint: Sprint 42, ends Friday)

### In Progress (3 items — resume these)

1. **[MYPROJ-124]** Update database indexes for perf
   - Priority: High | Status: In Review | Est: 5pts
   - Assigned: you | Last comment: 3h ago by @sarah
   - Action: Address review comments, re-request review

2. **[MYPROJ-130]** Fix failing E2E tests
   - Priority: Medium | Status: In Progress | Est: 3pts
   - Assigned: you | Reopened yesterday, 2 comments
   - Action: Check comment thread, plan fix

3. **[MYPROJ-115]** Refactor checkout flow
   - Priority: Medium | Status: In Progress | Est: 8pts
   - Assigned: you | 60% done, no blockers
   - Action: Continue work

### To-Do Today (5 items — pick in order)

1. **[MYPROJ-125]** Add password reset to auth
   - Priority: High | Est: 5pts | Assigned: you
   - Context: Blocker for Q2 launch

2. **[MYPROJ-126]** Update API docs
   - Priority: Medium | Est: 3pts | Assigned: you

3. **[MYPROJ-127]** Code review for @maya
   - Priority: Medium | Est: 2pts | No assignee yet
   - Context: Part of dashboard redesign

4. **[MYPROJ-128]** Investigate cache performance
   - Priority: Medium | Est: 5pts | Assigned: you

5. **[MYPROJ-129]** Setup monitoring for new API
   - Priority: Low | Est: 3pts | Assigned: you

### Waiting / Blocked (2 items — no action needed)

1. **[MYPROJ-105]** Update payment processor
   - Blocked on: [MYPROJ-150] Backend API (due Friday)
   - Assigned: you | Owned blocker: @james

2. **[MYPROJ-110]** Mobile app release
   - Blocked on: [MYPROJ-130] E2E tests
   - Assigned: @dev | You can help unblock

---

## 📋 Recommended Order for Today

1. **Unblock others** — Address review comments on [MYPROJ-124] (30 min)
2. **Fix urgent test failures** — [MYPROJ-130] (2-3 hours)
3. **High-priority sprint** — [MYPROJ-125] password reset (5 hours)
4. **Resume long-term** — [MYPROJ-115] checkout flow (3-4 hours)
5. **Buffer** — Code review or smaller tasks if ahead

---

## ⚡ Quick Context

**Current sprint:** Sprint 42 (Platform Team) • Ends Friday EOD
**Capacity:** 21 points committed, 13 remaining
**Blocker status:** 1 owned by you, 1 blocking you
**Your throughput yesterday:** 2 issues closed, 3 commits

---

## 🔧 Control

- `/start-day --force-refresh` — Pull fresh data from all sources
- `/productivity:update` — Sync sprint changes
- `/status` — Check overall progress
```

---

## Graceful Degradation

### If no Jira config found (first run):

1. Offer setup: "I found TASKS.md but no Jira config. Set it up? (2 min)"
2. If user declines: Use git log + TASKS.md only (still useful)
3. If user accepts: Run setup flow, save config, re-run briefing

### If Jira unavailable:

1. Skip Jira sections
2. Rely on: git log, TASKS.md, any local progress files
3. Note: "Jira not connected — showing git + local tasks only"

### If Slack unavailable:

1. Skip Slack notifications
2. Note: "Slack not available — checking Jira only"

### If GitHub unavailable:

1. Skip PR/commit sections
2. Rely on: git log local (no remote PR info)
3. Note: "GitHub not connected — local commits shown only"

---

## Memory Integration

### What Gets Saved

**memory/start-day-config.md:**
- Jira project key
- Jira board ID
- User's timezone (for "yesterday" calculation)
- Cached sprint info (refreshed daily)
- Last briefing timestamp (to avoid re-running)

**CLAUDE.md additions:**
```markdown
## Jira
- **Project Key:** MYPROJ
- **Board ID:** 42
- **Board:** Platform Team

## Work Preferences
- Sprint view: My Issues Only
- Briefing time: 9am
- Include done: false
```

### What Gets Cached

- Last briefing timestamp (don't re-run within 2 hours)
- Commit hash of latest pull (avoid redundant git queries)
- Slack message count (to detect "new" mentions)
- Jira sprint ID (to detect sprint change)

Use `--force-refresh` to bust cache.

---

## Configuration Prompts

If `memory/start-day-config.md` doesn't exist, ask:

```
Setting up /start-day for you.

1. **Jira project key?**
   (e.g., MYPROJ, PLAT, INFRA — find in your ticket keys)

2. **Jira board ID?**
   (number in URL: jira.company.com/...rapidView={ID})

3. **Your timezone?**
   (for calculating "yesterday" correctly)

4. **Include completed items in today's layout?**
   (shows what you finished in sprint)
```

Save answers to `memory/start-day-config.md`. Update `CLAUDE.md` with quick ref.

---

## Filtering Options

After first-run setup, user can customize via `memory/start-day-config.md`:

```markdown
## Filters

### Show
- include_done_items: false          # Don't show completed tickets
- include_low_priority: false         # Hide Low/Trivial priority
- include_waiting_items: true         # Show blocked items (useful context)
- include_team_blockers: true         # Show blockers blocking teammates

### Slack Channels (if connected)
- high_priority_channels:
  - "#incidents"
  - "#blockers"
  - "#urgent"
- exclude_channels:
  - "#random"
  - "#general"

### Sprint View
- show_sprint_velocity: true          # Daily velocity chart
- show_capacity_vs_committed: true    # Burndown hint
- show_estimated_close_time: true     # When will sprint finish?
```

---

## Smart Prioritization Logic

The recommended order is calculated:

1. **Score blockers:** Issues with `status = Blocked` or `blocker = true` assigned to user → Priority 1
2. **Score urgent:** Issues with `priority = Highest` or in a "launch" epic → Priority 2
3. **Score active:** Issues already in "In Progress" → Priority 3 (resume before starting new)
4. **Score sprint position:** Use Jira board rank (left-to-right) → Tiebreaker
5. **Score by estimate:** Smaller estimates first (quick wins) → Secondary tiebreaker

Present this order to user with reasoning:
```
Recommended Order (based on blocker status, priority, sprint rank):

1. [MYPROJ-124] Address review comments (unblocks others) — 30 min
   └ Reasoning: In review, blocking deployments

2. [MYPROJ-130] Fix E2E tests (high priority, reopened) — 2-3 hours
   └ Reasoning: Critical for sprint goal, blockers mobile release
```

---

## Caching & Performance

Cache for 2 hours to avoid hammering Jira on repeated runs.

Cache busts automatically when:
- User runs with `--force-refresh`
- More than 2 hours have passed
- Sprint changes (detected by sprint ID)
- New commits detected (git log diff)

Show cache status:
```
Using cached data from 45 min ago.
Run `/start-day --force-refresh` for live data.
```

---

## Error Handling

**If Jira connection fails:**
```
⚠ Couldn't reach Jira. Falling back to git + local tasks.

Check your connection, then run:
/start-day --force-refresh
```

**If git fails:**
```
⚠ Git not available. Showing TASKS.md only.
```

**If config is outdated:**
```
⚠ Jira config is 30 days old. Verify it's still correct:
- Project: MYPROJ (check: was this renamed?)
- Board: #42 (check: still on this board?)

Update via: memory/start-day-config.md
```

---

## Tips for Daily Use

1. **Run every morning** — Best at 9am before standup
2. **Use notifications to triage** — Address blockers first
3. **Reference the recommended order** — It's calculated to maximize flow
4. **Check for overnight changes** — Especially status changes you didn't make
5. **Keep memory fresh** — Run `/productivity:update` weekly to catch new projects/people
6. **Recalibrate priorities** — If sprint goals changed, update config

---

## Related Commands

- `/productivity:update` — Sync sprint changes, fill memory gaps
- `/productivity:status` — Check overall project progress
- `/productivity:track` — Log time, update task status
- `/standup` (Engineering plugin) — Format Yesterday/Today/Blockers for team

---

## Notes

- First run asks for config; subsequent runs are fast
- All Jira JQL queries use server-side filtering (efficient)
- Gracefully degrades when connectors missing
- Respects user's timezone for "24h ago" calculations
- Cached sprint info auto-refreshes when sprint changes
- Formatting is conversational, not a wall of text
