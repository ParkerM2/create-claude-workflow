# Releasing claude-workflow

Step-by-step guide for publishing a new version of the claude-workflow plugin.

---

## Prerequisites

- Push access to both repos:
  - **Plugin**: [ParkerM2/create-claude-workflow](https://github.com/ParkerM2/create-claude-workflow)
  - **Marketplace**: [ParkerM2/claude-workflow-marketplace](https://github.com/ParkerM2/claude-workflow-marketplace)
- `gh` CLI authenticated

---

## Release Steps

### 1. Finalize Changes in the Plugin Repo

Ensure all feature work is merged to `master` on `create-claude-workflow`.

### 2. Bump the Plugin Version

Update the version in **both** files — they must match:

```bash
# .claude-plugin/plugin.json
{
  "version": "X.Y.Z"   # ← bump this
}
```

```bash
# CHANGELOG.md — add a new section at the top
## [X.Y.Z] — YYYY-MM-DD
### Added / Changed / Fixed
- ...
### Update
\`\`\`
/plugin update claude-workflow@claude-workflow-marketplace
\`\`\`
```

### 3. Commit and Push the Plugin Repo

```bash
git add .claude-plugin/plugin.json CHANGELOG.md
git commit -m "chore: Bump version to X.Y.Z"
git push origin master
```

### 4. Tag the Release (Optional but Recommended)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 5. Create a GitHub Release (Optional)

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "See CHANGELOG.md for details"
```

### 6. Update the Marketplace Repo

Clone or pull the marketplace repo, then update **both version fields** in `marketplace.json`:

```bash
git clone https://github.com/ParkerM2/claude-workflow-marketplace.git
cd claude-workflow-marketplace
```

Edit `.claude-plugin/marketplace.json`:

```json
{
  "metadata": {
    "version": "X.Y.Z"        // ← bump this
  },
  "plugins": [
    {
      "version": "X.Y.Z",     // ← bump this to match plugin.json
    }
  ]
}
```

**Both `metadata.version` and `plugins[0].version` must match the plugin repo's `plugin.json` version.**

### 7. Commit and Push the Marketplace Repo

```bash
git add .claude-plugin/marketplace.json
git commit -m "chore: Bump claude-workflow to X.Y.Z"
git push origin master
```

---

## How Users Receive Updates

Once the marketplace repo is pushed:

- **Auto-update**: Users with auto-update enabled will receive the new version when Claude Code refreshes marketplace data (typically on session start).
- **Manual update**: Users can run:
  ```
  /plugin update claude-workflow@claude-workflow-marketplace
  ```
- **Fresh install**: New users installing for the first time will get the latest version automatically.

The update flow is:

```
Marketplace repo pushed
  → Claude Code fetches marketplace.json on session start
  → Detects version bump (marketplace version > installed version)
  → Clones plugin repo at new version
  → Caches to ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/
  → New session loads updated plugin
```

---

## Version Sync Checklist

Before considering a release complete, verify all three match:

| Location | File | Field |
|----------|------|-------|
| Plugin repo | `.claude-plugin/plugin.json` | `"version"` |
| Plugin repo | `CHANGELOG.md` | `## [X.Y.Z]` header |
| Marketplace repo | `.claude-plugin/marketplace.json` | `metadata.version` AND `plugins[0].version` |

**If versions are out of sync, users may experience install failures or get stale versions.**

---

## Claude-Assisted Release

To have Claude handle a release, provide this prompt:

```
Release claude-workflow version X.Y.Z.

1. Read RELEASING.md for the full process
2. Bump version in .claude-plugin/plugin.json to X.Y.Z
3. Add a CHANGELOG.md entry for X.Y.Z with the changes from this branch
4. Commit and push to master on create-claude-workflow
5. Tag vX.Y.Z and create a GitHub release
6. Clone claude-workflow-marketplace, bump both version fields
   in .claude-plugin/marketplace.json to X.Y.Z, commit, push
```

---

## Repo Structure Reference

```
create-claude-workflow/          ← The plugin (what gets installed)
├── .claude-plugin/
│   └── plugin.json              ← version lives here
├── agents/
├── commands/
├── hooks/
├── prompts/
├── skills/
├── CHANGELOG.md
└── RELEASING.md                 ← this file

claude-workflow-marketplace/     ← The index (how users discover it)
├── .claude-plugin/
│   └── marketplace.json         ← version lives here (2 places)
└── README.md
```
