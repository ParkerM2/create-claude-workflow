---
type: performance-log
version: 2
append_only: true
---

# Agent Performance Log

> Track QA outcomes, issue patterns, and agent effectiveness across features. The QA reviewer appends an entry after each QA report. The Team Leader reviews the log after each feature completes to identify improvement opportunities.

---

## Log Location

```
the progress directory/agent-performance-log.md
```

This is a single, append-only file that accumulates entries across features.

---

## Entry Format

After each QA report (PASS or FAIL), the QA reviewer appends one entry:

<qa-entry>

```markdown
### <ISO timestamp> — <feature-name> / Task #<N>

| Field | Value |
|-------|-------|
| Feature | <feature-name> |
| Task | #<N>: <task name> |
| Agent Role | <role> (e.g., component-engineer) |
| Agent Name | <spawned agent name> |
| Complexity | LOW / MEDIUM / HIGH |
| QA Round | <round> of <max> |
| Verdict | PASS / FAIL |
| Issues Found | <count> |

**Issue Categories** (if any):
- [ ] Type safety — <count>
- [ ] Code structure — <count>
- [ ] Architecture — <count>
- [ ] Error handling — <count>
- [ ] Security — <count>
- [ ] Naming — <count>
- [ ] Missing tests — <count>
- [ ] Documentation — <count>
- [ ] Scope violation — <count>
- [ ] Other — <count>

**Notes**: <brief summary of significant findings or patterns>
```

</qa-entry>

---

## Complexity Assessment

The QA reviewer estimates task complexity based on:

| Complexity | Criteria |
|------------|----------|
| LOW | 1–2 files changed, single concern, no cross-module dependencies |
| MEDIUM | 3–5 files changed, 2+ concerns, some cross-module interaction |
| HIGH | 6+ files changed, multiple concerns, significant cross-module impact |

---

## Team Leader Review Protocol

After a feature completes, the Team Leader reads the performance log and checks:

1. **QA round counts** — Which agents needed multiple rounds? Why?
2. **Issue categories** — Are certain issue types recurring across features?
3. **Agent patterns** — Does a specific agent role consistently produce certain issue types?
4. **Complexity correlation** — Do HIGH complexity tasks fail QA more often?

### Action Items

Based on the review:

| Pattern Observed | Action |
|-----------------|--------|
| Agent X fails QA for type safety repeatedly | Add type safety rule to agent X's definition |
| Scope violations are common | Tighten scope sections, add explicit exclusions |
| HIGH tasks fail more than LOW | Split HIGH tasks into smaller pieces |
| Same issue category across agents | Add a project-wide rule to `the project rules file` |
| Agent consistently passes round 1 | Consider `fast` mode for that agent's tasks |

---

## Example Log

<qa-entry>

```markdown
### 2025-01-15T14:32:00Z — user-settings / Task #1

| Field | Value |
|-------|-------|
| Feature | user-settings |
| Task | #1: Define settings types and schemas |
| Agent Role | schema-designer |
| Agent Name | schema-agent |
| Complexity | LOW |
| QA Round | 1 of 3 |
| Verdict | PASS |
| Issues Found | 0 |

**Notes**: Clean pass, well-scoped task.
```

</qa-entry>

<qa-entry>

```markdown
### 2025-01-15T15:45:00Z — user-settings / Task #3

| Field | Value |
|-------|-------|
| Feature | user-settings |
| Task | #3: Create settings API handlers |
| Agent Role | api-engineer |
| Agent Name | api-agent |
| Complexity | MEDIUM |
| QA Round | 1 of 3 |
| Verdict | FAIL |
| Issues Found | 3 |

**Issue Categories**:
- [ ] Error handling — 2
- [ ] Type safety — 1

**Notes**: Missing error handling on validation failures. No try-catch on database calls.
```

</qa-entry>

<qa-entry>

```markdown
### 2025-01-15T16:20:00Z — user-settings / Task #3

| Field | Value |
|-------|-------|
| Feature | user-settings |
| Task | #3: Create settings API handlers |
| Agent Role | api-engineer |
| Agent Name | api-agent |
| Complexity | MEDIUM |
| QA Round | 2 of 3 |
| Verdict | PASS |
| Issues Found | 0 |

**Notes**: All error handling issues resolved. Added comprehensive try-catch blocks.
```

</qa-entry>
