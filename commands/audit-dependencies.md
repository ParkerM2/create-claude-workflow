---
name: audit-dependencies
description: "CVE scanning, dependency health check, and auto-ticket creation for vulnerabilities"
---

# Audit Dependencies Workflow

Comprehensive dependency scanning for CVEs, outdated packages, license compliance, and staleness. Auto-creates Jira tickets for critical vulnerabilities with remediation guidance.

## Integration Points

- **Jira MCP**: Auto-create tickets for CVEs, link to tickets for tracking
- **GitHub Advisory Database**: CVE lookup via web search/APIs
- **Package Managers**: Native audit tools (npm, pip, cargo, etc.)
- **Memory**: Audit history, dependency tracking, remediation status
- **Slack MCP**: Vulnerability notifications

## Workflow Phases

### Phase 1: Project Detection (Type & Lock File Identification)

Identify project type and read dependency manifests:

1. **Detect Project Type**
   - Check for manifest files in priority order:
     - Node.js: `package.json` + `package-lock.json` or `yarn.lock`
     - Python: `requirements.txt`, `Pipfile`, `pyproject.toml` + `Pipfile.lock` or `poetry.lock`
     - Rust: `Cargo.toml` + `Cargo.lock`
     - Go: `go.mod` + `go.sum`
     - Java: `pom.xml` (Maven) + `pom.lock` or `build.gradle` + `gradle.lock`
     - Ruby: `Gemfile` + `Gemfile.lock`
     - PHP: `composer.json` + `composer.lock`
   - Store detected type: `memory/project-type.yaml`

2. **Read Lock Files**
   - Parse lock file for exact versions (not ranges from manifest)
   - Build dependency list:
     ```
     dependencies:
       express: 4.18.2 (direct)
       accepts: 1.3.8 (transitive)
       cookie: 0.5.0 (transitive)
     ```
   - Identify: direct vs. transitive (nested), pinned versions

3. **Monorepo Detection**
   - If multiple package files: `workspace/services/api/package.json`, `workspace/ui/package.json`
   - Scan all: `find . -name "package.json" -not -path "*/node_modules/*"`
   - Flag: "Monorepo detected; scanning N independent projects"
   - Process each separately or aggregate (configurable)

4. **Extract Metadata**
   - Project name, version, description
   - Dev vs. production dependencies (if available)
   - Private vs. public packages

**Error Handling:**
- No manifest found: Exit with "No supported dependency file detected. Supported: {list}"
- Corrupt lock file: Warn "Lock file invalid; parse error at line X. Audit may be incomplete."
- Monorepo analysis slow: Cache per-subproject results

**Verification Checklist:**
- [ ] Project type identified
- [ ] Manifest file found
- [ ] Lock file parsed successfully
- [ ] All dependencies extracted
- [ ] Direct/transitive classification complete

### Phase 2: Vulnerability Scan (CVE Detection)

Run native audit tools or manual lookups:

1. **Try Native Audit Tools First**
   ```
   Node.js: npm audit --json
   Python: pip-audit --format json
   Rust: cargo audit --json
   Go: go list -json -m all | nancy sleuth -
   Java (Maven): mvn org.owasp:dependency-check-maven:check
   Ruby: bundle audit check --json
   ```

   - Execute with timeout (60s); capture JSON output
   - Parse results into normalized format:
     ```
     vulnerabilities:
       - id: "CVE-2023-12345"
         package: "express"
         version: "4.18.2"
         fixed_in: "4.18.3"
         severity: "high"
         description: "Denial of Service vulnerability"
         cvss_score: 7.5
         cwe: "CWE-400"
     ```

2. **Fallback: Manual CVE Lookup**
   - If tools unavailable, for each dependency:
     - Query GitHub Advisory Database via web search
     - Search: `site:github.com/advisories {package} {version}`
     - Parse results: CVE ID, severity, description
   - Rate limit: Max 10 requests per minute
   - Cache results in memory

3. **Merge & Deduplicate**
   - Combine results from all tools
   - Remove duplicates (same CVE ID)
   - Preserve highest severity if conflicting reports

4. **Filter Out False Positives**
   - Ignore: CVEs in dev-only dependencies (if production audit)
   - Ignore: Fixed CVEs in newer installed version
   - Ignore: CVEs not affecting installed version (version constraint mismatch)

**Error Handling:**
- Tool not installed: Note in output; use fallback
- API rate limit hit: Use cached results; note "data may be stale"
- Network timeout: Warn "CVE lookup incomplete"; continue with offline data
- Tool returns error: Log error; continue with partial results

**Verification Checklist:**
- [ ] At least one audit method executed
- [ ] CVE list populated (or warned if empty)
- [ ] Severity scores assigned
- [ ] Duplicates removed
- [ ] False positives filtered

### Phase 3: Severity Classification & Mapping

Categorize CVEs by risk level:

1. **Severity Mapping**
   - CVSS v3.1 ranges:
     ```
     9.0-10.0  → CRITICAL (instant action required)
     7.0-8.9   → HIGH (patch within days)
     4.0-6.9   → MEDIUM (patch within 1-2 weeks)
     0.1-3.9   → LOW (patch in regular cycle)
     ```
   - Use CVSS score if available; fallback to tool classification

2. **Impact Assessment**
   - For each CVE, determine:
     - Attack vector: Network / Adjacent Network / Local / Physical
     - Attack complexity: Low / High
     - Privileges required: Yes / No
     - User interaction: Yes / No
     - Affected scope: Changed / Unchanged
   - Store full CVSS vector: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`

3. **Business Impact Estimation**
   - Critical CVEs: Rate as "emergency" (manual patch likely needed)
   - High: "urgent" (1-2 days to patch)
   - Medium: "standard" (routine update cycle)
   - Low: "informational" (FYI)

4. **Remediation Guidance**
   - For each CVE:
     - Affected version range
     - Fixed version(s)
     - Upgrade path: `3.2.1 → 3.2.5` or major bump? `3.2.1 → 4.0.0`?
     - Breaking changes in fixed version? (flag if major version)
     - Workarounds if patched version unavailable

**Verification Checklist:**
- [ ] CVSS scores assigned to all CVEs
- [ ] Severity categories assigned
- [ ] Impact vectors calculated
- [ ] Remediation paths identified
- [ ] Breaking changes flagged

### Phase 4: License Compliance Check

Identify licenses and flag issues:

1. **License Detection Per Dependency**
   ```bash
   for each dependency:
       - Read package metadata (package.json "license", requirements metadata)
       - Query registry (NPM, PyPI, crates.io, Maven Central)
       - Extract: license type(s) (Apache-2.0, MIT, GPL-3.0, etc.)
       - Handle: multiple licenses (OR/AND), unknown, proprietary
   ```

2. **License Classification**
   ```
   Permissive: MIT, Apache-2.0, BSD, ISC → ✅ OK for most projects
   Weak Copyleft: LGPL-2.1, LGPL-3.0 → ⚠️ Review for dynamic linking
   Strong Copyleft: GPL-2.0, GPL-3.0, AGPL-3.0 → ❌ Check commercial use policy
   Proprietary: Unlicensed, custom → ❌ Flag for legal review
   Unknown: No license specified → ⚠️ Assume proprietary until verified
   ```

3. **Project-Specific Policies**
   - Store in `memory/license-policy.yaml`:
     ```yaml
     commercial_project: true
     allowed_licenses:
       - MIT
       - Apache-2.0
       - BSD-*
     forbidden_licenses:
       - GPL-*
       - AGPL-*
     unknown_action: "block"  # block | warn | allow
     ```

4. **Flag Issues**
   - GPL in commercial project: `❌ GPL-3.0 in {package} — incompatible with commercial license`
   - Multiple licenses with conflict: Note both
   - Unknown license: `⚠️ {package} has no license — assume proprietary`
   - Deprecated license: `⚠️ {package} uses deprecated LGPL-2.0 (prefer LGPL-2.1+)`

**Error Handling:**
- Registry unavailable: Use cached license data (< 30 days old)
- No license field: Mark as "unknown"; note in report
- License parsing ambiguous: List all detected licenses; flag for review

**Verification Checklist:**
- [ ] License detected for all direct dependencies
- [ ] License categories assigned
- [ ] Policy compliance checked
- [ ] Violations flagged with severity

### Phase 5: Staleness Check (Version Currency)

Identify outdated packages:

1. **Query Latest Versions**
   - For each dependency, query registry for latest available version
   - Store installed vs. latest:
     ```
     express:
       installed: 4.18.2
       latest: 4.19.1
       behind_major: false  (major version matches)
       behind_minor: true   (missing 19.0 release)
       age: "3 months"
     ```

2. **Calculate Lag**
   ```
   installed_release_date = registry_metadata.published_at
   latest_release_date = registry_metadata.latest.published_at
   lag_days = latest_release_date - installed_release_date

   - <= 7 days: ✅ Current
   - 7-30 days: ℹ️ Minor lag
   - 30-90 days: ⚠️ Outdated (missing 1-2 patch releases)
   - > 90 days: ❌ Stale (major features/fixes missed)
   ```

3. **Major Version Check**
   ```
   installed_major = 4
   latest_major = 4
   if latest_major > installed_major:
       if behind_by >= 2:
           flag: "Multiple major versions behind"
           risk: "HIGH — likely to have dropped features/APIs"
   ```

4. **Abandon Detection**
   - If no release in 2+ years AND latest version exists:
     - Flag: `⚠️ {package} appears abandoned (last release {years} ago)`
     - Risk: No security patches for new vulnerabilities
     - Recommendation: Consider replacement package

5. **Deprecation Detection**
   - Check registry for deprecation notice
   - If deprecation found: `⚠️ {package} is deprecated — maintainer recommends: {replacement}`
   - Update severity based on recommended replacement availability

**Error Handling:**
- Registry unavailable: Skip staleness check; note "unable to verify latest versions"
- Version comparison fails: Manual review
- Deprecated with no replacement: Flag as "high risk"

**Verification Checklist:**
- [ ] Latest versions queried for all packages
- [ ] Version lag calculated
- [ ] Major version gaps identified
- [ ] Abandoned packages detected
- [ ] Deprecations noted

### Phase 6: Report Generation

Compile comprehensive audit report:

1. **Report Structure**
   ```
   AUDIT REPORT: {project-name} v{version}
   Generated: 2026-03-27 14:30:00Z
   Scanned: {N} dependencies ({M} direct, {K} transitive)

   ━━━ VULNERABILITIES (Summary) ━━━
   🔴 CRITICAL: {count}
   🟠 HIGH: {count}
   🟡 MEDIUM: {count}
   🔵 LOW: {count}

   ━━━ CRITICAL VULNERABILITIES ━━━
   [List each with details]

   ━━━ LICENSE COMPLIANCE ━━━
   [List violations]

   ━━━ OUTDATED PACKAGES ━━━
   [List stale/abandoned]

   ━━━ QUICK FIXES ━━━
   npm audit fix --force  (if applicable)
   npm update {packages} (if applicable)

   ━━━ RECOMMENDATIONS ━━━
   [Prioritized action items]
   ```

2. **Jira Ticket Auto-Creation** (Critical/High CVEs)
   - For each CRITICAL or HIGH CVE:
     - Call `jira_create_issue` with:
       ```
       Project: Security / DevOps (configurable)
       Type: "Bug"
       Title: "[SEC] {package}: {CVE-ID} {description}"
       Description: {markdown with CVE details, CVSS, remediation}
       Priority: "Critical" (for CRITICAL) or "High"
       Labels: ["security", "cve", "dependencies", "auto-created"]
       Due Date: 3 days (CRITICAL) or 7 days (HIGH)
       ```
     - Link ticket: Add GitHub PR or commit reference if auto-patch available

3. **Generate Markdown Report**
   - Save to: `audit-report-{date}.md`
   - Include: Full CVE list, remediation guides, license matrix
   - Markup: Severity colors, links to CVE databases, package repo links

4. **Store in Memory**
   - Save results to `memory/dependency-audits.yaml`:
     ```yaml
     audits:
       2026-03-27T14:30:00Z:
         project: myapp
         total_dependencies: 42
         vulnerabilities:
           critical: 1
           high: 3
           medium: 5
         tickets_created: [SEC-123, SEC-124, SEC-125]
     ```

**Error Handling:**
- Jira unavailable: Generate report only; note "tickets not created"
- Report size > 10MB: Split into multiple files
- CVE database unavailable: Generate report with partial data; note gaps

**Verification Checklist:**
- [ ] Report generated (Markdown and/or JSON)
- [ ] CVE details included for all findings
- [ ] Jira tickets created for CRITICAL/HIGH (or noted if Jira unavailable)
- [ ] Remediation steps provided
- [ ] Memory audit log updated
- [ ] Report saved to disk

### Phase 7: Slack Notification & Auto-Remediation

Notify team and optionally patch:

1. **Slack Summary Notification**
   ```
   🔍 Dependency Audit Complete
   Project: myapp v1.2.3

   🔴 CRITICAL: 1 CVE
   🟠 HIGH: 3 CVEs

   ⚡ Quick action: npm audit fix

   📋 Full report: [audit-report-2026-03-27.md]
   🎫 Tickets: [SEC-123, SEC-124, SEC-125]
   ```

2. **Auto-Fix Option** (`--fix` flag)
   - Attempt automatic remediation:
     ```bash
     npm audit fix --force  # or pip install -U {packages}
     ```
   - Safety checks:
     - Only fix minor/patch versions (not major)
     - Test that deps still build after fix
     - Create separate branch: `chore/dependency-audit-2026-03-27`
     - Commit changes with message: `chore: audit fix for {CVEs}`

3. **Create-Tickets Option** (`--create-tickets` / `--skip-tickets`)
   - Default: Prompt user
   - Flag to auto-create for CRITICAL/HIGH
   - Flag to skip and review manually first

4. **Block Merge? (CI Integration)**
   - If CRITICAL CVEs found and `--block` flag:
     - Fail CI check: "Dependency audit found critical vulnerabilities"
     - Block merge until tickets resolved
     - Allow override: `--override-audit` (with admin approval)

**Error Handling:**
- Auto-fix breaks build: Rollback; report which fixes failed
- Slack unavailable: Continue without notification
- Cannot create tickets: Note in report; provide manual instructions

**Verification Checklist:**
- [ ] Slack notification sent (if configured)
- [ ] Auto-fix applied (if --fix flag)
- [ ] Jira tickets created (if --create-tickets)
- [ ] CI status updated (if integrated)

## Configuration & Memory

### License Policy
Store in `memory/license-policy.yaml`:
```yaml
commercial_project: true
allowed_licenses:
  - MIT
  - Apache-2.0
  - BSD-*
forbidden_licenses:
  - GPL-*
  - AGPL-*
unknown_action: "warn"  # block | warn | allow
```

### Project Type & History
Store in `memory/project-metadata.yaml`:
```yaml
project_type: nodejs
dependencies_count: 127
last_audit: 2026-03-27T14:30:00Z
last_critical_count: 1
trending: "stable"
```

### Audit Log
Store in `memory/dependency-audits.yaml`:
```yaml
audits:
  2026-03-27T14:30:00Z:
    vulnerabilities: {critical: 1, high: 3, medium: 5}
    tickets_created: [SEC-123, SEC-124]
```

## Usage Examples

```bash
# Run full audit with all checks
/audit-dependencies

# Scan and auto-create Jira tickets for CRITICAL/HIGH
/audit-dependencies --create-tickets

# Skip ticket creation, review first
/audit-dependencies --skip-tickets

# Auto-fix minor/patch versions
/audit-dependencies --fix

# Auto-fix and create tickets
/audit-dependencies --fix --create-tickets

# Audit with custom license policy
/audit-dependencies --policy commercial

# Generate report only, no notifications
/audit-dependencies --report-only

# Check specific package history
/audit-dependencies --package express

# Force refresh from registry (ignore cache)
/audit-dependencies --refresh
```

## Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| No manifest found | Exit: "No supported dependency file detected" |
| Lock file corrupt | Warn; parse manifest as fallback |
| Audit tool missing | Use manual CVE lookup (slower) |
| CVE database down | Use last known results (< 30d); note in report |
| Jira unavailable | Generate report only; note tickets not created |
| Auto-fix breaks build | Rollback; list failing fixes; suggest manual review |
| Slack not configured | Skip notification; generate report normally |
| Monorepo (N projects) | Process each independently; aggregate summary |

## Output Format

Success:
```
✅ Audit complete: 127 dependencies scanned

🔴 CRITICAL: 1 CVE (requires immediate action)
🟠 HIGH: 3 CVEs (patch within 7 days)
🟡 MEDIUM: 5 CVEs (routine update)
🔵 LOW: 2 CVEs (informational)

⚠️ License warnings: 2 GPL packages in commercial project

📊 Staleness:
   - 3 packages are 1 major version behind
   - 1 package abandoned (no release in 2 years)

🎫 Created tickets: SEC-123, SEC-124, SEC-125
📋 Full report: audit-report-2026-03-27.md
```

Partial Success:
```
⚠️ Audit incomplete (audit tool failed)

✅ CVE lookup via manual search: 4 vulnerabilities found
❌ License check skipped (registry unavailable)
⚠️ Staleness check incomplete

Action: Run /audit-dependencies --refresh when registry available
```

## Integration Notes

- **CI/CD**: Block merge on CRITICAL CVEs (configurable)
- **GitHub**: Create security advisory issues or PRs with auto-fixes
- **Slack**: Post daily/weekly audit summaries
- **Jira**: Track CVE remediation tickets through workflow
- **Memory**: Audit history enables trend analysis and anomaly detection

## Testing Checklist

- [ ] Detects all 6+ project types correctly
- [ ] Lock file parsing accurate
- [ ] CVE severity classification matches CVSS
- [ ] License violations flagged for commercial projects
- [ ] Abandoned package detection works
- [ ] Jira ticket creation includes all required fields
- [ ] Auto-fix doesn't break builds (tested)
- [ ] Monorepo scanning handles multiple manifests
- [ ] Slack notifications include actionable info
- [ ] Report generation handles large dependency trees (1000+)
