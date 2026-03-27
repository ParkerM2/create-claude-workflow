---
name: connect-atlassian
description: "Connect Jira + Confluence to Claude Code via sooperset/mcp-atlassian — guided API token setup with 72 tools for tickets, sprints, IKTs, and docs"
---

# /connect-atlassian — Jira + Confluence Integration

Connects your Atlassian Cloud (or Server/Data Center) account to Claude Code using the [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian) MCP server. Gives Claude access to 72 tools across Jira and Confluence.

---

## Prerequisites

- Atlassian Cloud account (Jira and/or Confluence)
- Python 3.10+ (for `uvx`)

---

## Step 1: Check Existing Configuration

Read `~/.claude/settings.json`. Check if `mcpServers.mcp-atlassian` already exists.

- **Already configured**: Display current config. Ask: "Atlassian is already connected. Update / Keep / Remove?"
- **Not configured**: Proceed to Step 2.

---

## Step 2: Generate API Token

Guide the user through API token creation:

```
To connect Jira and Confluence, you need an Atlassian API token.
This takes about 2 minutes and the token lasts up to 365 days.

1. Open: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name it "Claude Workflow" (or anything descriptive)
4. Set expiration to 365 days (maximum)
5. Click Create → Copy the token immediately (you can't see it again)
```

Use `AskUserQuestion` to collect the API token (user pastes via "Other" text input).

---

## Step 3: Collect Connection Details

Use `AskUserQuestion`:

1. **Atlassian site URL**: "What is your Atlassian site URL? (e.g., yourcompany.atlassian.net)"
2. **Email**: "What email do you use to log into Atlassian?"
3. **Products**: "Which Atlassian products do you use?"
   - Jira + Confluence (both)
   - Jira only
   - Confluence only

---

## Step 4: Install Prerequisites

```bash
# Check if uvx is available
uvx --version 2>/dev/null
```

If missing, offer to install:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Step 5: Configure Environment Variables

Instruct the user to add credentials to their shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.profile`):

```bash
# Add to your shell profile:
export JIRA_API_TOKEN="<your-api-token>"
export CONFLUENCE_API_TOKEN="<your-api-token>"  # Same token works for both
```

> The token is stored in environment variables, NOT in config files. This keeps secrets out of any file that might be committed to git.

---

## Step 6: Write MCP Server Config

Read `~/.claude/settings.json`, deep-merge the `mcpServers` section, write back (preserve all existing settings).

**Jira + Confluence config:**
```json
{
  "mcpServers": {
    "mcp-atlassian": {
      "command": "uvx",
      "args": ["mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://<site>.atlassian.net",
        "JIRA_USERNAME": "<email>",
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}",
        "CONFLUENCE_URL": "https://<site>.atlassian.net/wiki",
        "CONFLUENCE_USERNAME": "<email>",
        "CONFLUENCE_API_TOKEN": "${CONFLUENCE_API_TOKEN}"
      }
    }
  }
}
```

**Jira-only config** (omit Confluence env vars):
```json
{
  "mcpServers": {
    "mcp-atlassian": {
      "command": "uvx",
      "args": ["mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://<site>.atlassian.net",
        "JIRA_USERNAME": "<email>",
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
      }
    }
  }
}
```

---

## Step 7: Verify & Report

Inform the user:

```
Atlassian MCP server configured in ~/.claude/settings.json.
Restart Claude Code for the MCP server to activate.

After restart, Claude will have access to these Atlassian tools:
```

### Available Tools (72 total)

**Jira — Tickets & Issues**
| Tool | What It Does |
|------|-------------|
| `jira_search` | Search via JQL (e.g., "assignee = currentUser()") |
| `jira_get_issue` | Read full ticket details, description, acceptance criteria |
| `jira_create_issue` | Create new tickets |
| `jira_update_issue` | Update ticket fields |
| `jira_add_comment` | Comment on tickets |
| `jira_get_comments` | Read ticket comments |
| `jira_change_issue_status` | Transition status (To Do → In Progress → Done) |
| `jira_get_transitions` | List available status transitions |
| `jira_create_issue_link` | Link tickets (blocks, relates to, etc.) |
| `jira_link_to_epic` | Link stories to epics |

**Jira — Agile & Sprints**
| Tool | What It Does |
|------|-------------|
| `jira_get_agile_boards` | List Scrum/Kanban boards |
| `jira_get_sprints_from_board` | List sprints for a board |
| `jira_get_sprint_issues` | Get issues in a sprint |
| `jira_get_board_issues` | Get all issues on a board |

**Confluence — Pages & Docs**
| Tool | What It Does |
|------|-------------|
| `confluence_search` | Search via CQL across all spaces |
| `confluence_get_page` | Read full page content (IKTs, specs, etc.) |
| `confluence_create_page` | Create new pages |
| `confluence_update_page` | Update existing pages |
| `confluence_get_comments` | Read page comments |
| `confluence_add_comment` | Add comments to pages |
| `confluence_get_attachments` | List/download attachments |

### Useful JQL Patterns

```
# My open tickets
assignee = currentUser() AND status != Done

# Current sprint
sprint in openSprints() AND project = "PROJ"

# Blockers
priority = Blocker AND status != Done

# Recently updated
updated >= -1d AND project = "PROJ"

# Unassigned backlog
assignee is EMPTY AND sprint is EMPTY AND project = "PROJ"
```

### Useful CQL Patterns (Confluence)

```
# Search IKTs by text
text ~ "acceptance criteria" AND space = "DEV"

# Find architecture docs
label = "architecture" AND type = "page"

# Recently modified
lastModified > now("-7d") AND space = "TEAM"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "uvx not found" | Install uv: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| "401 Unauthorized" | API token expired or wrong email — regenerate at id.atlassian.com |
| "Connection refused" | Restart Claude Code after adding the MCP config |
| Tools not showing up | Check `~/.claude/settings.json` has the `mcpServers.mcp-atlassian` block |
| Want to limit tools | Add `"TOOLSETS": "jira_issues,confluence_pages"` to the env block |
| Server/Data Center | Use `JIRA_PERSONAL_TOKEN` instead of `JIRA_API_TOKEN` + `JIRA_USERNAME` |

---

## References

- [sooperset/mcp-atlassian (GitHub)](https://github.com/sooperset/mcp-atlassian) — 4,700+ stars
- [Full documentation](https://mcp-atlassian.soomiles.com)
- [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- [JQL Reference](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jql/)
- [CQL Reference](https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/)
