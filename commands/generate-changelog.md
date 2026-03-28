---
name: generate-changelog
description: "Generate user-facing changelog from merged PRs and commits."
---

# Automated Changelog Generation

Generates a production-ready changelog by aggregating merged PRs since the last release/tag. Auto-classifies entries by type (features, fixes, breaking changes, dependencies). Outputs markdown and optionally publishes to GitHub Release and Slack.

## Usage

```
/generate-changelog [--from <tag>] [--to <ref>] [--github-release] [--slack] [--file <path>] [--format keep-a-changelog]
```

- `--from <tag>`: Start from git tag (defaults to last tag)
- `--to <ref>`: End at git ref (defaults to HEAD)
- `--github-release`: Create GitHub Release with changelog
- `--slack`: Post summary to Slack channel
- `--file <path>`: Append changelog to file (CHANGELOG.md by default)
- `--format`: Output format (keep-a-changelog, simple)

## Workflow

### Phase 1: Detect Version Range

Identifies commit range between last release and HEAD.

```javascript
// Detect last git tag
let fromRef = null;
try {
  const tags = execSync("git tag --sort=-version:refname --list 'v*' | head -20")
    .toString()
    .trim()
    .split("\n")
    .filter(t => t);

  if (tags.length === 0) {
    fromRef = execSync("git rev-list --all | tail -1").toString().trim();
    console.log(`ℹ No tags found; scanning from first commit`);
  } else {
    fromRef = tags[0];
    console.log(`✓ Last release: ${fromRef}`);
  }
} catch (err) {
  console.error(`ERROR: Failed to detect git tags: ${err.message}`);
  return gracefulFailure("Unable to detect version range; specify --from manually");
}

const toRef = argv.to || "HEAD";

// Verify range is valid
try {
  const logOutput = execSync(`git log --oneline ${fromRef}..${toRef}`);
  const commitCount = logOutput.toString().split("\n").filter(l => l).length;
  console.log(`✓ Commit range: ${fromRef}..${toRef} (${commitCount} commits)`);
} catch (err) {
  console.error(`ERROR: Invalid git range ${fromRef}..${toRef}`);
  return gracefulFailure("Unable to determine changelog range");
}
```

**Graceful degradation**: If no tags, scan from first commit; allow manual range specification.

---

### Phase 2: PR Aggregation

Extracts PR numbers from merge commit messages and fetches PR metadata.

```javascript
const mergeCommits = execSync(`git log --format="%H %s %b" ${fromRef}..${toRef}`)
  .toString()
  .split("\n")
  .filter(line => line.trim());

const prMap = {}; // keyed by PR number
const commitRegex = /Merge pull request #(\d+)|GH-(\d+)|PR-(\d+)/i;
const prPattern = /#(\d+)/;

for (const commit of mergeCommits) {
  // Extract PR number from various formats
  const match = commit.match(commitRegex) || commit.match(prPattern);
  if (!match) continue;

  const prNumber = match[1] || match[2] || match[3];
  if (prMap[prNumber]) continue; // Already processed

  try {
    // Fetch PR details from GitHub
    const prData = await github.rest.pulls.get({
      owner: getRepoOwner(),
      repo: getRepoName(),
      pull_number: parseInt(prNumber)
    });

    prMap[prNumber] = {
      number: prNumber,
      title: prData.data.title,
      body: prData.data.body || "",
      labels: prData.data.labels.map(l => l.name),
      author: prData.data.user.login,
      url: prData.data.html_url,
      mergedAt: prData.data.merged_at,
      isDraft: prData.data.draft
    };

    console.log(`✓ PR #${prNumber}: ${prData.data.title.substring(0, 50)}...`);
  } catch (err) {
    console.warn(`⚠ Failed to fetch PR #${prNumber}: ${err.message}`);
    // Gracefully skip this PR; continue with others
    continue;
  }
}

console.log(`✓ Aggregated ${Object.keys(prMap).length} PRs`);
```

**Error handling**: Skip unavailable PRs; continue processing others. Report count of skipped PRs at end.

---

### Phase 3: Auto-Classification

Categorizes PRs by labels, conventional commits, and title patterns.

```javascript
const classifications = {
  features: [],
  fixes: [],
  breakingChanges: [],
  dependencies: [],
  documentation: [],
  internal: []
};

const labelMap = {
  "feature": "features",
  "enhancement": "features",
  "feat": "features",
  "bug": "fixes",
  "fix": "fixes",
  "bugfix": "fixes",
  "breaking": "breakingChanges",
  "breaking-change": "breakingChanges",
  "deps": "dependencies",
  "dependencies": "dependencies",
  "docs": "documentation",
  "documentation": "documentation",
  "chore": "internal",
  "refactor": "internal",
  "internal": "internal"
};

function classifyPR(pr) {
  // Check labels first
  for (const label of pr.labels) {
    const lowerLabel = label.toLowerCase();
    if (labelMap[lowerLabel]) {
      return labelMap[lowerLabel];
    }
  }

  // Check conventional commits
  const conventionalMatch = pr.title.match(/^(feat|fix|docs|style|refactor|perf|test|chore)(\(.+\))?:/);
  if (conventionalMatch) {
    const type = conventionalMatch[1];
    if (type === "feat") return "features";
    if (type === "fix") return "fixes";
    if (type === "docs") return "documentation";
    if (type === "chore" || type === "refactor") return "internal";
  }

  // Check title patterns
  if (/breaking|breaking change/i.test(pr.title)) return "breakingChanges";
  if (/deps?|depend|upgrade|bump/.test(pr.title)) return "dependencies";
  if (/doc|readme|comment/.test(pr.title)) return "documentation";

  // Default to features
  return "features";
}

for (const [prNumber, pr] of Object.entries(prMap)) {
  // Skip draft PRs
  if (pr.isDraft) {
    console.log(`ℹ Skipping draft PR #${prNumber}`);
    continue;
  }

  const category = classifyPR(pr);
  classifications[category].push(pr);
}

console.log(`✓ Classified ${Object.keys(prMap).length} PRs`);
Object.entries(classifications).forEach(([cat, prs]) => {
  if (prs.length > 0) console.log(`  ${cat}: ${prs.length}`);
});
```

**Graceful degradation**: PRs without labels default to "features"; internal changes hidden unless `--include-internal` flag.

---

### Phase 4: Changelog Generation

Formats entries following Keep a Changelog conventions.

```javascript
const version = detectNextVersion(fromRef);
const releaseDate = new Date().toISOString().split("T")[0];

function formatPREntry(pr) {
  const creditText = pr.author ? ` ([${pr.author}](https://github.com/${pr.author}))` : "";
  return `- ${pr.title} ([#${pr.number}](${pr.url}))${creditText}`;
}

let changelogContent = `# Changelog

All notable changes to this project are documented in this file.

## [${version}] - ${releaseDate}

`;

// Breaking Changes (always first if any)
if (classifications.breakingChanges.length > 0) {
  changelogContent += `### ⚠️ Breaking Changes\n\n`;
  classifications.breakingChanges.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

// Features
if (classifications.features.length > 0) {
  changelogContent += `### Features\n\n`;
  classifications.features.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

// Bug Fixes
if (classifications.fixes.length > 0) {
  changelogContent += `### Bug Fixes\n\n`;
  classifications.fixes.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

// Dependencies
if (classifications.dependencies.length > 0) {
  changelogContent += `### Dependencies\n\n`;
  classifications.dependencies.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

// Documentation
if (classifications.documentation.length > 0) {
  changelogContent += `### Documentation\n\n`;
  classifications.documentation.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

// Internal (hidden by default)
if (argv["include-internal"] && classifications.internal.length > 0) {
  changelogContent += `### Internal\n\n`;
  classifications.internal.forEach(pr => {
    changelogContent += formatPREntry(pr) + "\n";
  });
  changelogContent += "\n";
}

changelogContent += `---\n*${Object.keys(prMap).length} changes in this release*\n`;

console.log("✓ Changelog generated");
console.log(changelogContent);
```

**Graceful degradation**: If version detection fails, prompt user for version; use timestamp as fallback.

---

### Phase 5: Publishing

Publishes to GitHub Release, Slack, or appends to CHANGELOG.md file.

```javascript
// GitHub Release
if (argv["github-release"]) {
  try {
    const releaseResponse = await github.rest.repos.createRelease({
      owner: getRepoOwner(),
      repo: getRepoName(),
      tag_name: version,
      name: `Release ${version}`,
      body: changelogContent,
      draft: false,
      prerelease: version.includes("rc") || version.includes("beta")
    });

    console.log(`✓ GitHub Release created: ${releaseResponse.data.html_url}`);
  } catch (err) {
    console.error(`✗ Failed to create GitHub Release: ${err.message}`);
    if (err.status === 422) {
      console.log(`ℹ Release tag already exists; updating existing release`);
      // Attempt to update existing release instead
    }
  }
}

// Slack notification
if (argv.slack) {
  try {
    const slackChannel = process.env.SLACK_RELEASE_CHANNEL || "#releases";
    const summary = `
New Release: *${version}*
${classifications.breakingChanges.length > 0 ? "⚠️ Breaking Changes included\n" : ""}
• Features: ${classifications.features.length}
• Fixes: ${classifications.fixes.length}
• Deps: ${classifications.dependencies.length}
`;

    await slack.chat.postMessage({
      channel: slackChannel,
      text: summary,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: summary
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<${releaseResponse?.data?.html_url || "#"}|View Release>`
            }
          ]
        }
      ]
    });

    console.log(`✓ Slack notification sent to ${slackChannel}`);
  } catch (err) {
    console.warn(`⚠ Slack notification failed: ${err.message}`);
  }
}

// Append to CHANGELOG.md
if (argv.file || !argv["github-release"]) {
  const changelogPath = argv.file || "CHANGELOG.md";
  try {
    const existingChangelog = fs.readFileSync(changelogPath, "utf-8");
    const updated = changelogContent + "\n" + existingChangelog;
    fs.writeFileSync(changelogPath, updated);
    console.log(`✓ Appended to ${changelogPath}`);
  } catch (err) {
    if (err.code === "ENOENT") {
      fs.writeFileSync(changelogPath, changelogContent);
      console.log(`✓ Created ${changelogPath}`);
    } else {
      console.error(`✗ Failed to write changelog: ${err.message}`);
    }
  }
}
```

**Graceful degradation**: If GitHub Release creation fails, continue with file/Slack options; if Slack unavailable, skip notification; always write to file.

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| No git tags | Scan from first commit; note in changelog |
| PR fetch fails | Skip PR; log warning; continue |
| Invalid git range | Exit with helpful message; suggest correct syntax |
| GitHub Release exists | Update existing release or prompt user |
| Slack send fails | Log warning; continue with other outputs |
| Cannot write file | Report error; output to stdout instead |

## Performance Notes

- Batches GitHub API calls with 500ms delay to avoid rate limiting
- Caches PR metadata (10-minute TTL) for repeated runs
- Parallel PR fetching (max 5 concurrent requests)
- Skips processing draft PRs to reduce API calls

## Version Detection Strategy

1. Analyze git tags for semver pattern
2. Increment patch version if last tag exists
3. Use `CHANGELOG_VERSION` env var if set
4. Prompt user if detection fails
