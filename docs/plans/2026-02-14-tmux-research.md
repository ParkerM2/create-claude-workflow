# tmux Integration Research — Findings Summary

**Date**: 2026-02-14
**Status**: Research complete, informing tracker design

---

## Communication Primitives (Ranked by Fitness)

| Primitive | Use Case | Reliability | Recommendation |
|-----------|----------|-------------|----------------|
| `wait-for` / `-S` | Synchronization signals | High | Essential for coordination |
| `wait-for -L` / `-U` | Mutual exclusion (locks) | High | Progress file protection |
| File-based (JSON) | Structured data exchange | High | Primary data channel |
| `pipe-pane -O` | Continuous output logging | High | Central logging |
| `set-buffer` / `show-buffer` | Small message passing | Medium | Pair with `wait-for` |
| `pipe-pane -I` | Programmatic input to agents | Medium | Orchestrator commands |
| `capture-pane` | Monitoring, debugging | Medium | Dashboard/logging only |
| `send-keys` | Launch agents, inject commands | Low | Launching only |

## Core Message-Passing Pattern

Buffer + wait-for gives a complete message-passing system:

```bash
# Agent (worker): write result then signal
tmux set-buffer -b task-3-result '{"status":"complete","files":["src/api.ts"]}'
tmux wait-for -S task-3-done

# Orchestrator: wait then read
tmux wait-for task-3-done
tmux show-buffer -b task-3-result
```

## Existing Projects

| Project | Description | Key Insight |
|---------|-------------|-------------|
| [Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator) | Three-tier hierarchy via MCP tools | Real-time status dashboards |
| [NTM](https://github.com/Dicklesworthstone/ntm) | TUI for Claude/Codex/Gemini across panes | Conflict tracking, Agent Mail |
| [Multi-Agent Shogun](https://github.com/yohey-w/multi-agent-shogun) | YAML file-based coordination | Zero orchestration overhead |
| [tmux-agents](https://github.com/super-agent-ai/tmux-agents) | 10-50 agents with Kanban board | VS Code integration |
| [AWS CLI Agent Orchestrator](https://github.com/awslabs/cli-agent-orchestrator) | MCP server routes by terminal ID | `CAO_TERMINAL_ID` env var per agent |
| [Enhanced Tmux Orchestrator](https://github.com/chajus1/enhanced-tmux-orchestrator) | Combines Tmux-Orchestrator + Claude Flow | Leadership hierarchy |

## tmux MCP Servers

| Project | Description |
|---------|-------------|
| [lox/tmux-mcp-server](https://github.com/lox/tmux-mcp-server) | Tools: start_session, send_commands, view_session |
| [jonrad/tmux-mcp](https://github.com/jonrad/tmux-mcp) | Python-based libtmux wrapper |
| [nickgnd/tmux-mcp](https://github.com/nickgnd/tmux-mcp) | Claude Desktop reads/controls tmux |

## Claude Code Native Support

- `teammateMode: "tmux"` already exists in Claude Code settings
- Spawns teammates in tmux split panes automatically
- Known issues:
  - [#23615](https://github.com/anthropics/claude-code/issues/23615): Splits current pane (breaks layout), should use new windows
  - [#24292](https://github.com/anthropics/claude-code/issues/24292): Doesn't reliably create panes in iTerm2
  - Not supported in VS Code terminal, Windows Terminal, or Ghostty

## tmux vs In-Process Subagents

| Aspect | Task tool (subagents) | tmux panes |
|--------|----------------------|------------|
| Crash isolation | Shared fate with parent | Independent processes |
| User visibility | Hidden | Visible in panes |
| Token cost | Lower (shared session) | Higher (separate contexts) |
| Communication | Structured (SendMessage) | Primitives (buffers, files) |
| Session persistence | Lost on disconnect | Survives disconnect |
| Windows support | Yes | Requires WSL |

## Design Recommendations

### Now: Abstract the Communication Layer

1. **Standardize message format**: JSON with `type`, `agent_id`, `task_id`, `status`, `payload`
2. **Define signal points**: task start/complete, QA pass/fail, blocker, merge ready
3. **Use progress file as shared state**: Protected by locks in tmux world

### Now: File-Based Communication Protocol

```
.claude/tracker/
  features/<name>/
    events.jsonl          # Structured event log (all agents append)
    status.txt            # One-line status bar cache
    raw/                  # pipe-pane captures (tmux layer creates these)
      <agent-name>.log
```

This pattern works today with in-process agents AND translates directly to tmux.

### Later: tmux Integration Layer

1. Replace `Task` tool with `tmux new-window` + `send-keys`
2. Replace `SendMessage` with buffer + `wait-for` pattern
3. Add `pipe-pane` for centralized logging
4. Add dashboard window with aggregated status

### Windows Note

tmux requires WSL2 on Windows. Design the abstraction so tmux is an **optional backend** — Windows users use in-process mode, macOS/Linux users can opt into tmux mode.

## Key Blog Posts & Guides

- [Kaushik Gopal: Forking subagents with tmux](https://kau.sh/blog/agent-forking/)
- [Javier Aguilar: Scaling Claude Code Agent Teams in tmux](https://www.javieraguilar.ai/en/blog/claude-code-agent-teams)
- [Addy Osmani: Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Scuti AI: Combining tmux and Claude](https://scuti.asia/combining-tmux-and-claude-to-build-an-automated-ai-agent-system-for-mac-linux/)
- [Ranveer Sequeira: Gemini CLI + tmux Multi-Agent Workflow](https://ranveersequeira.medium.com/building-full-stack-applications-with-gemini-cli-tmux-a-repo-first-multi-agent-workflow-27c082ea5d83)
