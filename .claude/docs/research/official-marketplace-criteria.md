# Official Marketplace Acceptance Criteria

Research date: 2026-02-14
Source: `anthropics/claude-plugins-official` repo, Claude Code official docs

---

## 1. Submission Process

External PRs to `anthropics/claude-plugins-official` are **automatically closed** by CI.
The close-external-prs workflow checks if the PR author has `admin` or `write` permission;
all others are closed with a comment directing them to the submission form:

> https://docs.google.com/forms/d/e/1FAIpQLSdeFthxvjOXUjxg1i3KrOOkEPDJtn71XC-KjmQlxNP63xYydg/viewform

**There is no open PR-based submission path.** You must use the Google Form.

---

## 2. Repository Structure (claude-plugins-official)

```
claude-plugins-official/
├── .claude-plugin/
│   └── marketplace.json          # The marketplace catalog
├── .github/
│   ├── scripts/
│   │   └── validate-frontmatter.ts
│   └── workflows/
│       ├── close-external-prs.yml
│       └── validate-frontmatter.yml
├── plugins/                      # Internal (Anthropic-maintained) plugins
│   ├── example-plugin/
│   ├── commit-commands/
│   ├── pr-review-toolkit/
│   ├── feature-dev/
│   ├── code-review/
│   ├── code-simplifier/
│   ├── hookify/
│   ├── plugin-dev/
│   ├── playground/
│   ├── ralph-loop/
│   ├── security-guidance/
│   ├── frontend-design/
│   ├── agent-sdk-dev/
│   ├── claude-code-setup/
│   ├── claude-md-management/
│   ├── explanatory-output-style/
│   ├── learning-output-style/
│   ├── typescript-lsp/
│   ├── pyright-lsp/
│   ├── gopls-lsp/
│   ├── rust-analyzer-lsp/
│   ├── clangd-lsp/
│   ├── php-lsp/
│   ├── swift-lsp/
│   ├── kotlin-lsp/
│   ├── csharp-lsp/
│   ├── jdtls-lsp/
│   └── lua-lsp/
├── external_plugins/             # Third-party plugins
│   ├── greptile/
│   ├── serena/
│   ├── playwright/
│   ├── github/
│   ├── supabase/
│   ├── laravel-boost/
│   ├── asana/
│   ├── linear/
│   ├── gitlab/
│   ├── slack/
│   ├── stripe/
│   ├── firebase/
│   └── context7/
└── README.md
```

### Two types of external plugin entries

**Type A: Bundled in the repo** (source is relative path)
- Plugin files live in `external_plugins/<name>/`
- Marketplace entry: `"source": "./external_plugins/<name>"`
- Examples: greptile, playwright, github, supabase, stripe, asana, linear, slack, firebase, context7

**Type B: External reference only** (source is a URL/github object)
- No files in the repo; plugin lives in the vendor's own repository
- Marketplace entry uses object source:
  ```json
  "source": {
    "source": "url",
    "url": "https://github.com/vendor/repo.git"
  }
  ```
- Examples: atlassian, figma, Notion, sentry, vercel, pinecone, huggingface-skills, circleback, superpowers, posthog, coderabbit, sonatype-guide, firecrawl

---

## 3. marketplace.json Schema (Top-Level)

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-plugins-official",
  "description": "...",
  "owner": {
    "name": "Anthropic",
    "email": "support@anthropic.com"
  },
  "plugins": [ ... ]
}
```

### Required top-level fields

| Field     | Type   | Description                                    |
|-----------|--------|------------------------------------------------|
| `name`    | string | Marketplace identifier, kebab-case, no spaces  |
| `owner`   | object | `{ name: string, email?: string }`             |
| `plugins` | array  | List of plugin entries                         |

### Optional top-level fields

| Field                  | Type   | Description                            |
|------------------------|--------|----------------------------------------|
| `$schema`              | string | JSON schema reference                  |
| `description`          | string | Brief marketplace description          |
| `metadata.description` | string | Alternative description location       |
| `metadata.version`     | string | Marketplace version                    |
| `metadata.pluginRoot`  | string | Base dir prepended to relative sources |

### Reserved marketplace names (cannot be used by third parties)

- `claude-code-marketplace`
- `claude-code-plugins`
- `claude-plugins-official`
- `anthropic-marketplace`
- `anthropic-plugins`
- `agent-skills`
- `life-sciences`
- Names that impersonate official marketplaces (e.g., `official-claude-plugins`)

---

## 4. Plugin Entry Schema (in marketplace.json plugins array)

### Required fields per entry

| Field    | Type             | Description                                |
|----------|------------------|--------------------------------------------|
| `name`   | string           | Plugin identifier, kebab-case, no spaces   |
| `source` | string or object | Where to fetch the plugin (see below)      |

### Optional fields per entry

| Field         | Type    | Description                                              |
|---------------|---------|----------------------------------------------------------|
| `description` | string  | Brief plugin description                                 |
| `version`     | string  | Semantic version (MAJOR.MINOR.PATCH)                     |
| `author`      | object  | `{ name: string, email?: string, url?: string }`         |
| `homepage`    | string  | Plugin homepage / documentation URL                      |
| `repository`  | string  | Source code repository URL                                |
| `license`     | string  | SPDX license identifier (MIT, Apache-2.0, etc.)          |
| `keywords`    | array   | Tags for discovery                                       |
| `category`    | string  | Organization category                                    |
| `tags`        | array   | Additional tags (e.g., `["community-managed"]`)          |
| `strict`      | boolean | Default true. When false, marketplace defines everything |
| `commands`    | string/array  | Custom paths to command files/directories          |
| `agents`      | string/array  | Custom paths to agent files                        |
| `hooks`       | string/object | Custom hooks config or path                        |
| `mcpServers`  | string/object | MCP server configs or path                         |
| `lspServers`  | string/object | LSP server configs or path                         |

### Source formats

**Relative path** (for bundled plugins):
```json
"source": "./external_plugins/my-plugin"
```

**URL source** (for externally-hosted plugins):
```json
"source": {
  "source": "url",
  "url": "https://github.com/vendor/repo.git"
}
```

**GitHub source**:
```json
"source": {
  "source": "github",
  "repo": "owner/repo",
  "ref": "v2.0.0",
  "sha": "a1b2c3d4..."
}
```

### Category values observed in the official marketplace

- `development`
- `productivity`
- `security`
- `testing`
- `database`
- `design`
- `monitoring`
- `deployment`
- `learning`

---

## 5. Plugin Directory Structure (Required for bundled plugins)

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata (required file, name is only required field)
├── .mcp.json              # MCP server configuration (optional)
├── .lsp.json              # LSP server configuration (optional)
├── commands/              # Slash commands (optional, legacy -- prefer skills/)
│   └── my-command.md
├── agents/                # Agent definitions (optional)
│   └── my-agent.md
├── skills/                # Skill definitions (optional)
│   └── my-skill/
│       └── SKILL.md
├── hooks/                 # Hook configurations (optional)
│   └── hooks.json
├── scripts/               # Hook and utility scripts (optional)
├── README.md              # Documentation
├── LICENSE                # License file
└── CHANGELOG.md           # Version history (optional)
```

**Critical**: Components (commands/, agents/, skills/, hooks/) go at the plugin root,
NOT inside `.claude-plugin/`. Only `plugin.json` goes in `.claude-plugin/`.

---

## 6. plugin.json Schema (Inside .claude-plugin/)

### Minimal example (from official plugins like commit-commands):
```json
{
  "name": "commit-commands",
  "description": "Streamline your git workflow with simple commands",
  "author": {
    "name": "Anthropic",
    "email": "support@anthropic.com"
  }
}
```

### Full example (from stripe):
```json
{
  "name": "stripe",
  "description": "Stripe development plugin for Claude",
  "version": "0.1.0",
  "author": {
    "name": "Stripe",
    "url": "https://stripe.com"
  },
  "homepage": "https://docs.stripe.com",
  "repository": "https://github.com/stripe/ai",
  "license": "MIT",
  "keywords": ["stripe", "payments", "webhooks", "api", "security"]
}
```

### Required field

| Field  | Type   | Description                               |
|--------|--------|-------------------------------------------|
| `name` | string | Unique identifier, kebab-case, no spaces  |

### Optional metadata fields

| Field         | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `version`     | string | Semantic version (MAJOR.MINOR.PATCH) |
| `description` | string | Brief plugin description             |
| `author`      | object | Author info (name, email?, url?)     |
| `homepage`    | string | Documentation URL                    |
| `repository`  | string | Source code URL                      |
| `license`     | string | SPDX license identifier              |
| `keywords`    | array  | Discovery tags                       |

### Optional component path fields

| Field          | Type           | Description                         |
|----------------|----------------|-------------------------------------|
| `commands`     | string/array   | Additional command files/dirs       |
| `agents`       | string/array   | Additional agent files              |
| `skills`       | string/array   | Additional skill directories        |
| `hooks`        | string/object  | Hook config paths or inline config  |
| `mcpServers`   | string/object  | MCP config paths or inline config   |
| `outputStyles` | string/array   | Additional output style files/dirs  |
| `lspServers`   | string/object  | LSP server configs                  |

---

## 7. Frontmatter Validation (CI Enforcement)

The `validate-frontmatter.yml` workflow runs on PRs that touch:
- `**/agents/*.md`
- `**/skills/*/SKILL.md`
- `**/commands/*.md`

### Agent frontmatter requirements
```yaml
---
name: agent-name          # REQUIRED, string
description: What it does # REQUIRED, string
---
```

### Skill (SKILL.md) frontmatter requirements
```yaml
---
description: What it does  # REQUIRED (or "when_to_use" as alternative)
---
```

### Command frontmatter requirements
```yaml
---
description: What it does  # REQUIRED, string
---
```

---

## 8. Naming Conventions

- **Plugin names**: kebab-case, no spaces (e.g., `commit-commands`, `pr-review-toolkit`)
- **Marketplace names**: kebab-case, no spaces
- **Agent filenames**: kebab-case `.md` files in `agents/` directory
- **Command filenames**: kebab-case `.md` files in `commands/` directory
- **Skill directories**: kebab-case directory names under `skills/`, each containing `SKILL.md`
- **Namespacing**: In the UI, components are namespaced as `plugin-name:component-name`

---

## 9. Version Format

- Semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`, `2.1.0`, `0.1.0`)
- Pre-release versions allowed: `2.0.0-beta.1`
- Start at `1.0.0` for first stable release
- Version can be set in `plugin.json` OR in the marketplace entry; `plugin.json` takes priority
- Many official plugins **omit version entirely** -- it is optional

---

## 10. Licensing

- License field uses SPDX identifiers: `MIT`, `Apache-2.0`, etc.
- Not strictly required (many official plugins omit it)
- External plugins like Stripe include `"license": "MIT"`
- Recommended to include for open-source plugins

---

## 11. Quality and Security Standards

From the README:
> External plugins must meet quality and security standards for approval.

Specific standards observed from analyzing the repo:

1. **Frontmatter validation** -- agents, skills, and commands must have valid YAML frontmatter
2. **Valid JSON** -- plugin.json and marketplace.json must parse correctly
3. **Proper directory structure** -- components at root level, not inside `.claude-plugin/`
4. **No path traversal** -- source paths cannot contain `..`
5. **No duplicate plugin names** -- each name must be unique within the marketplace
6. **Kebab-case naming** -- all identifiers use kebab-case
7. **Submission via Google Form** -- external contributions reviewed by Anthropic team

---

## 12. Observed Patterns in External Plugins

### Bundled external plugins (in external_plugins/ dir) typically contain:
```
external_plugins/name/
├── .claude-plugin/
│   └── plugin.json
└── .mcp.json
```

Most bundled external plugins are **MCP server wrappers** -- they provide an `.mcp.json`
configuration and a minimal `plugin.json`. Some also include commands and skills (e.g., stripe).

### URL-referenced external plugins contain nothing in the repo:
Just an entry in marketplace.json with `"source": { "source": "url", "url": "..." }`.
The plugin content lives entirely in the vendor's own repository.

---

## 13. Homepage Field Conventions

For bundled plugins (internal or external), the `homepage` field in the marketplace entry
typically points to `claude-plugins-public` (a separate public repo):

```
https://github.com/anthropics/claude-plugins-public/tree/main/plugins/<name>
```

or for external plugins in this repo:

```
https://github.com/anthropics/claude-plugins-public/tree/main/external_plugins/<name>
```

For URL-referenced plugins, the homepage points to the vendor's own repo.

---

## 14. Tags

The `tags` field is used sparingly. The only observed tag value is:
- `"community-managed"` -- used for serena and context7

---

## 15. Complete Acceptance Criteria Checklist

### For submitting to the official marketplace:

- [ ] **Submit via Google Form** (not via PR): https://docs.google.com/forms/d/e/1FAIpQLSdeFthxvjOXUjxg1i3KrOOkEPDJtn71XC-KjmQlxNP63xYydg/viewform
- [ ] **Plugin has `.claude-plugin/plugin.json`** with at minimum a `name` field
- [ ] **Plugin name is kebab-case** with no spaces
- [ ] **Plugin name is unique** (not already in the marketplace)
- [ ] **Directory structure is correct**: components at root, only plugin.json in .claude-plugin/
- [ ] **All agent .md files** have frontmatter with `name` and `description`
- [ ] **All skill SKILL.md files** have frontmatter with `description` (or `when_to_use`)
- [ ] **All command .md files** have frontmatter with `description`
- [ ] **JSON files parse correctly** (plugin.json, .mcp.json, hooks.json)
- [ ] **No path traversal** (`..`) in any source paths
- [ ] **`${CLAUDE_PLUGIN_ROOT}`** used for all paths in hooks and MCP configs
- [ ] **All paths relative**, starting with `./`
- [ ] **Hook scripts are executable** (chmod +x)
- [ ] **Version is semver** if specified (MAJOR.MINOR.PATCH)
- [ ] **Description is clear and concise** explaining what the plugin does
- [ ] **README.md included** with documentation

### Recommended but not strictly required:

- [ ] `author` field with name (and optionally email/url)
- [ ] `homepage` field linking to documentation
- [ ] `license` field with SPDX identifier
- [ ] `keywords` array for discoverability
- [ ] `category` field for marketplace organization
- [ ] `CHANGELOG.md` for version history

### For self-hosted marketplace listing (alternative to official):

If submitting to the official marketplace is not feasible, you can:
1. Create your own marketplace repository
2. Host a `.claude-plugin/marketplace.json`
3. Users add it with `/plugin marketplace add owner/repo`
4. This approach gives full control and immediate availability

---

## 16. Source References

- Repository: https://github.com/anthropics/claude-plugins-official
- Plugins reference: https://code.claude.com/docs/en/plugins-reference
- Marketplaces guide: https://code.claude.com/docs/en/plugin-marketplaces
- Discovery guide: https://code.claude.com/docs/en/discover-plugins
- Submission form: https://docs.google.com/forms/d/e/1FAIpQLSdeFthxvjOXUjxg1i3KrOOkEPDJtn71XC-KjmQlxNP63xYydg/viewform
