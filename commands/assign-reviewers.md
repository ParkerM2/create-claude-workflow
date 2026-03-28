---
name: assign-reviewers
description: "Smart code review assignment with expertise mapping and load balancing"
---

# Assign Reviewers Workflow

Intelligently assign PR reviewers based on code expertise (git blame), review load balancing, and team availability. Supports auto-assignment with Slack notifications.

## Integration Points

- **GitHub MCP**: PR analysis, changed files, review assignment
- **Memory**: Team configuration, review load cache, expertise maps
- **Slack MCP**: Notifications and requests to reviewers
- **Git**: Historical blame data for expertise scoring

## Workflow Phases

### Phase 1: PR Analysis (Detection)

Identify the PR and extract changed files:

1. **PR Context Resolution**
   - Accept: PR number, PR URL, or auto-detect from current branch
   - Format accepted:
     - PR number: `42`
     - GitHub URL: `https://github.com/org/repo/pull/42`
     - Branch: auto-detect if current branch has open PR
   - Call GitHub API: `GET /repos/{owner}/{repo}/pulls/{pr_number}`
   - Extract: PR state (must be `open`), branch, title, creator

2. **Validate PR State**
   - If draft PR: Ask confirmation to assign reviews (offer `--draft` flag)
   - If closed/merged: Exit with "Cannot assign to closed PR"
   - If already has max reviewers (3+): Ask if should replace or add

3. **Extract Changed Files**
   - Call GitHub API: `GET /repos/{owner}/{repo}/pulls/{pr_number}/files`
   - Build file list with:
     - Path: `src/auth/login.ts`
     - Type: added/modified/deleted
     - Lines changed: additions + deletions
   - Filter: Ignore node_modules, vendor, lock files, generated code
   - Categorize by module: `auth/`, `api/`, `ui/`, `shared/`, etc.

4. **Flag Special Cases**
   - All deletions: May need fewer reviewers
   - Single file/small change: Suggest 1 reviewer
   - Large refactor (50+ files): Suggest expert-level reviewers only
   - Documentation only: Suggest docs owner
   - Test changes only: Suggest QA lead

**Verification Checklist:**
- [ ] PR exists and is open
- [ ] Changed files list populated
- [ ] File categories identified
- [ ] PR creator identified (exclude from reviewers)

### Phase 2: Expertise Mapping (Git History Analysis)

Build expertise scores from recent git history:

1. **Blame Analysis Per File**
   ```bash
   for each changed_file:
       git log --follow -5 --format="%an|%ae" -- {file}
       → extract last 5 authors
   ```
   - Prioritize:
     - Commits modifying same lines changed in PR (highest)
     - Recent commits to file (last 6 months)
     - Multiple contributions to same file (stickiness)

2. **Build Expertise Matrix**
   ```
   expertise[person] = {
     "src/auth/": 3,
     "src/api/": 2,
     "shared/utils/": 3,
     "tests/": 1
   }
   ```
   - Score per module: 1-5 scale
     - 5: Recent changes (< 1 month), multiple files
     - 4: Multiple changes (< 6 months)
     - 3: Some history (< 1 year)
     - 2: Infrequent (> 1 year ago)
     - 1: Minimal/one commit
   - Aggregate to overall score: `sum(scores) / len(categories)`

3. **Handle Edge Cases**
   - New files (no git history): Mark as "new" expertise
   - Deleted files: Include author in "knowledge loss" notification
   - Moved files: Follow git rename, use history
   - Auto-generated code: Skip blame, use code owners file

**Error Handling:**
- Git history unavailable: Use CODEOWNERS file
- No recent history: Mark as "needs fresh eyes" (suggest any team member)

**Verification Checklist:**
- [ ] Git blame succeeded for each file
- [ ] Expertise scores calculated
- [ ] PR creator excluded from mapping
- [ ] Expertise matrix populated

### Phase 3: Load Balancing (Review Queue Analysis)

Analyze current review load per team member:

1. **Fetch Open Review Requests**
   - Query GitHub: `GET /repos/{owner}/{repo}/pulls` with state=open
   - For each PR: extract requested reviewers
   - Count per person: `open_reviews[person] = count`
   - Also check: assigned issues, on-call status (from memory)

2. **Load Scoring**
   ```
   load_score[person] = (
       open_reviews_count * 0.6 +
       open_issues_count * 0.2 +
       on_call_penalty * 0.2
   )
   inverse_load = 1 / (1 + load_score)  # Normalize to 0-1
   ```

3. **Recent Review Velocity**
   - Query last 7 days: How many reviews completed per person?
   - Adjust: Faster reviewers can take more load
   - Track in memory: `memory/review-velocity.yaml`

4. **Availability Flags**
   - PTO/OOO markers: Set load_score = ∞ (exclude)
   - Time zone: Prefer same-zone reviewers if urgent (PR created night-time)
   - Business hours: Don't overload during standups/meetings

**Error Handling:**
- GitHub API unavailable: Use cached load from memory (< 1 hour old)
- No team members available: Fallback to CODEOWNERS

**Verification Checklist:**
- [ ] Open reviews counted per person
- [ ] Load scores calculated
- [ ] Availability flags applied
- [ ] Inverse load normalized to 0-1 range

### Phase 4: Team Configuration (First-Run Setup)

Load or initialize team configuration:

1. **Load Team Config**
   - Check `memory/team-config.md`:
     ```yaml
     team:
       - name: Alice Chen
         github: achen
         jira: achen
         expertise:
           - backend
           - auth
           - database
         availability: available
         timezone: America/Los_Angeles
       - name: Bob Smith
         github: bsmith
         jira: bsmith
         expertise:
           - frontend
           - ui
           - testing
         availability: pto_until 2026-03-30
     ```

2. **First-Run Setup (if missing config)**
   - Prompt user: "Team configuration not found. Set up now? [y/n]"
   - Interactive questions:
     - Team members: `Who are the code reviewers? (comma-separated GitHub usernames)`
     - Expertise areas: `{person}'s primary expertise? (comma-separated)`
     - Availability: `Anyone OOO or on PTO?`
   - Generate YAML and save to memory

3. **CODEOWNERS Parsing**
   - If `.github/CODEOWNERS` exists:
     - Parse file ownership mapping
     - Extract team members and code regions
     - Use as fallback for expertise assignment
   - Format:
     ```
     src/auth/       @achen @bsmith
     src/ui/         @charlie @diana
     ```

4. **Validate Config**
   - All GitHub usernames exist in GitHub org
   - All team members linked to repos
   - No conflicts in expertise areas

**Error Handling:**
- Config missing: Prompt setup; offer template
- Invalid usernames: Suggest corrections from GitHub org
- No team members: Cannot proceed; exit with setup instructions

**Verification Checklist:**
- [ ] Team config loaded or created
- [ ] All team members have GitHub usernames
- [ ] CODEOWNERS file parsed (if exists)
- [ ] No conflicting assignments

### Phase 5: Scoring Algorithm (Weighted Ranking)

Calculate composite reviewer scores:

1. **Weight Configuration** (customizable)
   ```yaml
   weights:
     expertise: 0.5      # How relevant to changed files
     load: 0.3           # Current review queue
     availability: 0.15  # OOO/PTO status
     recent_review: 0.05 # Recently reviewed this person's code
   ```

2. **Score Calculation Per Person**
   ```
   if person is_unavailable (OOO/PTO):
       final_score = 0
   else:
       expertise_score = avg(expertise[person][category] for each file category)
       load_inverse = 1 / (1 + load_score[person])
       availability_bonus = 1.0 (or 0.8 if timezone mismatch)
       recent_bonus = 0.95 (slight penalty if reviewed same person recently)

       final_score = (
           expertise_score * weights.expertise +
           load_inverse * weights.load +
           availability_bonus * weights.availability +
           recent_bonus * weights.recent_review
       )
   ```

3. **Rank Reviewers**
   - Sort by final_score descending
   - Top 2-3 candidates become suggestions
   - Include reasoning breakdown per candidate

4. **Conflict Detection**
   - If PR author would normally rank high: Exclude
   - If same author reviewed recent PRs: De-prioritize (rotation)
   - If self-review detected: Mandatory alert

**Error Handling:**
- All reviewers unavailable: Alert user; suggest extending to backup teams
- Insufficient expertise: Flag "Needs fresh eyes"; include any available reviewer
- No ranking possible: Use CODEOWNERS or random assignment (not ideal)

**Verification Checklist:**
- [ ] Weights configured (use defaults if not)
- [ ] Scores calculated for all available team members
- [ ] PR creator excluded
- [ ] Top 2-3 candidates identified
- [ ] Reasoning provided for each candidate

### Phase 6: Assignment (Suggestion & Auto-Execution)

Present options and assign:

1. **Suggestion Display**
   ```
   Recommended reviewers for PR#42 "Add auth middleware":

   1. Alice Chen (@achen)
      Expertise: auth (5/5), backend (4/5), core (3/5)
      Load: 2 open reviews (low)
      Score: 0.87 ⭐
      Last reviewed your code: 2 days ago
      → Run: /assign-reviewers --assign @achen --count 1

   2. Bob Smith (@bsmith)
      Expertise: backend (4/5), testing (3/5), auth (2/5)
      Load: 5 open reviews (moderate)
      Score: 0.72
      → Run: /assign-reviewers --assign @bsmith --count 2

   3. Charlie Davis (@cdavis)
      Expertise: testing (5/5), auth (2/5), frontend (1/5)
      Load: 1 open review (low)
      Score: 0.65
      Availability: Timezone mismatch (UTC+8)
   ```

2. **Auto-Assignment** (`--auto` flag)
   - Assign top 2 reviewers automatically
   - Call GitHub API: `POST /repos/{owner}/{repo}/pulls/{pr_number}/requested_reviewers`
   - Add both usernames in single request

3. **Slack Notification**
   - If Slack connected, send DM to reviewers:
     ```
     👀 Code review requested: PR#42 "Add auth middleware"
     Review reason: Expertise in auth module
     Your expertise: auth (5/5)
     Current load: 2 open reviews
     ➡️ Review: {pr_url}
     ```
   - Include in PR thread: Auto-mention reviewers with reasoning

4. **Memory Update**
   - Store assignment in `memory/review-assignments.yaml`:
     ```yaml
     PR#42:
       assignees: [achen, bsmith]
       assigned_at: 2026-03-27T14:30:00Z
       scores:
         achen: 0.87
         bsmith: 0.72
       reasoning:
         achen: "Expertise in auth module (5/5), low load"
         bsmith: "Backup reviewer, testing expertise"
     ```

**Error Handling:**
- GitHub API fails: Store pending assignment in memory; retry on next run
- Slack unavailable: Assign reviewers without notifications (user will see GitHub notification)
- Auto-assign but API rejects: Explain why (e.g., max reviewers reached); offer manual instructions

**Verification Checklist:**
- [ ] Top candidates identified and scored
- [ ] Reviewers assigned in GitHub (or pending if auto)
- [ ] Slack notifications sent (if connected)
- [ ] Memory record created
- [ ] No duplicate assignments

### Phase 7: Slack Integration (Optional)

Send targeted Slack notifications:

1. **Reviewer Request**
   - DM to each assigned reviewer with PR details and expertise match
   - Include: PR title, description excerpt, changed files summary, expertise reasoning

2. **PR Channel Announcement** (if configured)
   - Post in #code-reviews or team channel:
     ```
     🔄 New PR: #42 "Add auth middleware"
     Reviewers: @achen, @bsmith
     Changed: src/auth/*, tests/auth/*
     Size: 500 lines added, 100 deleted
     ```

3. **Interactive Assignment** (optional)
   - Include buttons: "Accept Review", "Defer", "Need Help"
   - Track responses in memory

## Configuration & Memory

### Team Configuration
Store in `memory/team-config.md` (YAML):
```yaml
team:
  - name: Alice Chen
    github: achen
    jira: achen
    expertise: [backend, auth, database]
    availability: available
    timezone: America/Los_Angeles
    review_capacity: 3  # max open reviews
```

### Review Assignment History
Store in `memory/review-assignments.yaml`:
```yaml
PR#42:
  assignees: [achen, bsmith]
  assigned_at: 2026-03-27T14:30:00Z
  scores: {achen: 0.87, bsmith: 0.72}
  completed: false
```

### Review Velocity
Store in `memory/review-velocity.yaml`:
```yaml
achen:
  reviews_completed_7d: 8
  avg_time_to_review: "4 hours"
  currently_reviewing: 2
```

## Usage Examples

```bash
# Analyze and suggest reviewers for current PR
/assign-reviewers

# Suggest for specific PR
/assign-reviewers 42
/assign-reviewers https://github.com/org/repo/pull/42

# Auto-assign top 2 reviewers
/assign-reviewers --auto

# Auto-assign specific reviewer
/assign-reviewers --assign @achen --count 1

# Skip load balancing, use expertise only
/assign-reviewers --expertise-only

# Show detailed scoring breakdown
/assign-reviewers --verbose

# Set up team configuration
/assign-reviewers --setup-team

# Show review velocity report
/assign-reviewers --velocity-report
```

## Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Team config missing | Prompt interactive setup; use CODEOWNERS as fallback |
| Git history unavailable | Use CODEOWNERS file; note "limited expertise data" |
| No available reviewers | Alert user; suggest expanding team or extending deadline |
| GitHub API limit | Use cached data (< 1 hour); queue assignment for retry |
| Load data stale | Use last known; note "load data is {age} old" |
| All reviewers unavailable | Flag: suggest OOO rotation or escalate to lead |
| PR has 3+ reviewers | Ask: replace lowest-scored or add anyway |

## Output Format

Success:
```
✅ Assigned reviewers to PR#42

🥇 Alice Chen (@achen) — 0.87 score
   Expertise: auth (5/5), backend (4/5)
   Load: 2 open reviews
   📨 Slack notification sent

🥈 Bob Smith (@bsmith) — 0.72 score
   Expertise: backend (4/5), testing (3/5)
   Load: 5 open reviews
   📨 Slack notification sent
```

Partial Success:
```
⚠️ Assigned 1 of 2 suggested reviewers

✅ Alice Chen (@achen) assigned
❌ Bob Smith (@bsmith) — GitHub API error
   Action: Retry or assign manually via GitHub UI
```

No Reviewers:
```
❌ Cannot assign reviewers

Reason: All team members unavailable (OOO/PTO until 2026-03-30)
Suggestions:
1. Wait for team members to return
2. Assign external reviewer manually
3. Escalate to tech lead
```

## Integration Notes

- **CODEOWNERS Integration**: Automatically parsed; used as fallback
- **GitHub Status Checks**: Can integrate as "review assignment" status
- **CI/CD**: Review completion can gate merge (with workflow rules)
- **Slack Workflow**: Can trigger on PR#s in Slack threads
- **Time Zone Awareness**: Consider reviewer location; prefer awake reviewers for urgent reviews

## Testing Checklist

- [ ] PR detection works for PR number, URL, and branch
- [ ] Expertise scoring correctly weights multiple files
- [ ] Load balancing prevents overloading reviewers
- [ ] Availability flags (PTO) properly exclude team members
- [ ] Auto-assignment requests go to GitHub API correctly
- [ ] Slack notifications include reasoning
- [ ] Memory records track assignments for audit
- [ ] CODEOWNERS fallback works when config missing
- [ ] Edge case: single-file PR suggests only 1 reviewer
- [ ] Edge case: all reviewers OOO displays clear message
