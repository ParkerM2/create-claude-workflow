---
description: "Bump plugin version, update changelog, commit, tag, push, and sync marketplace repo"
---

# /bump-version — Automated Release

Automates the full release process from RELEASING.md. Bumps version across all files, writes changelog, commits, tags, pushes, and updates the marketplace repo.

## Phase 1: Determine Version

1. Read the current version from `.claude-plugin/plugin.json` (the `"version"` field).
2. Ask the user which bump type to apply:
   - **Patch** (X.Y.Z → X.Y.Z+1) — bug fixes, minor tweaks
   - **Minor** (X.Y.Z → X.Y+1.0) — new features, non-breaking changes
   - **Major** (X.Y.Z → X+1.0.0) — breaking changes
   - **Custom** — user specifies exact version string
3. Compute the new version string.

## Phase 2: Generate Changelog Entry

1. Run `git log` to find all commits since the last version tag:
   ```bash
   # Find the latest version tag
   LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

   # Get commits since that tag (or all commits if no tag)
   if [ -n "$LAST_TAG" ]; then
     git log "${LAST_TAG}..HEAD" --oneline --no-merges
   else
     git log --oneline --no-merges -20
   fi
   ```
2. Categorize commits into **Added**, **Changed**, **Fixed**, **Removed** sections based on commit message prefixes:
   - `feat:` / `add:` → Added
   - `fix:` → Fixed
   - `refactor:` / `chore:` / `perf:` → Changed
   - `remove:` / `delete:` → Removed
   - Other → Changed
3. Draft a changelog entry using today's date and present it to the user for review.
4. User approves or edits the changelog entry.

## Phase 3: Apply Version Bump

Update the version in these files (all must match):

1. **`.claude-plugin/plugin.json`** — update the `"version"` field
2. **`CHANGELOG.md`** — prepend the new entry at the top (below the `# Changelog` header, above the previous version entry). Include the `### Update` block:
   ```markdown
   ### Update
   ```
   /plugin update claude-workflow@claude-workflow-marketplace
   ```
   ```
3. **`marketplace/.claude-plugin/marketplace.json`** — update BOTH `metadata.version` AND `plugins[0].version`

## Phase 4: Commit, Tag, and Push Plugin Repo

```bash
# Stage version files
git add .claude-plugin/plugin.json CHANGELOG.md marketplace/.claude-plugin/marketplace.json

# Commit
git commit -m "chore: bump version to <NEW_VERSION>"

# Tag
git tag v<NEW_VERSION>

# Push commit and tag
git push origin master
git push origin v<NEW_VERSION>
```

## Phase 5: Create GitHub Release

```bash
gh release create v<NEW_VERSION> --title "v<NEW_VERSION>" --notes "See CHANGELOG.md for details"
```

## Phase 6: Update Marketplace Repo

Use `gh api` to update the marketplace version on `ParkerM2/claude-workflow-marketplace` — no cloning needed:

```bash
VERSION="<NEW_VERSION>"
REPO="ParkerM2/claude-workflow-marketplace"
FILE_PATH=".claude-plugin/marketplace.json"

# Get current file content and SHA
CURRENT=$(gh api "repos/${REPO}/contents/${FILE_PATH}")
SHA=$(echo "$CURRENT" | jq -r '.sha')
CONTENT=$(echo "$CURRENT" | jq -r '.content' | base64 -d)

# Update both version fields
UPDATED=$(echo "$CONTENT" | jq \
  --arg v "$VERSION" \
  '.metadata.version = $v | .plugins[0].version = $v')

# Push the update
ENCODED=$(echo "$UPDATED" | base64 -w0)
gh api "repos/${REPO}/contents/${FILE_PATH}" \
  --method PUT \
  -f message="chore: Bump claude-workflow to ${VERSION}" \
  -f content="${ENCODED}" \
  -f sha="${SHA}"
```

## Phase 7: Verify

Run the version sync checklist:

1. Read `.claude-plugin/plugin.json` → confirm version is `<NEW_VERSION>`
2. Read `CHANGELOG.md` → confirm `## [<NEW_VERSION>]` header exists at top
3. Read `marketplace/.claude-plugin/marketplace.json` → confirm both version fields are `<NEW_VERSION>`
4. Verify the marketplace repo was updated:
   ```bash
   gh api "repos/ParkerM2/claude-workflow-marketplace/contents/.claude-plugin/marketplace.json" | jq -r '.content' | base64 -d | jq '.metadata.version, .plugins[0].version'
   ```
5. Report success with the new version number and update command:
   ```
   Released v<NEW_VERSION>
   Users can update: /plugin update claude-workflow@claude-workflow-marketplace
   ```

## Important Notes

- **Always ask for user confirmation** before pushing to remote repos (Phase 4 and Phase 6)
- If any step fails, stop and report the error — do not continue with partial state
- The marketplace repo is `ParkerM2/claude-workflow-marketplace` (separate from this plugin repo)
- Both `metadata.version` and `plugins[0].version` in marketplace.json must match
