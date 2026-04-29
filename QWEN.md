# QWEN.md — Advisor Project Context

## Project Overview

**Open-Advisor** is an open-source slash command plugin that lets any AI CLI (Qwen Code, Claude Code, Codex CLI, Gemini CLI, or OpenCode) consult a second AI as an advisor. It supports 8 advisor types across three transports:

- **Web** (ChatGPT, Claude, Kimi, Qwen) — Playwright drives a real Chrome instance with a persistent profile; one login per advisor, sessions persist
- **CLI** (Claude Code, Codex CLI, Gemini CLI) — `child_process.spawnSync` runs the local binary; uses each tool's existing credentials
- **HTTP** (OpenRouter, Ollama) — direct call to any OpenAI-compatible endpoint; pick any model the service exposes
- **Custom HTTP** (any `custom-*`) — reads config from `~/.qwen/settings.json` under `customAdvisors`; mirrors Qwen's `modelProviders` generationConfig pattern (temperature, top_p, extra_body, contextWindowSize)

The selected advisor is stored in `advisor-active`. Setup status is tracked via `advisor-ready-<name>` marker files. Every response is saved to `advisor-last-response.md`; only a 200-char preview is shown inline.

## Key Files

| File | Purpose |
|------|---------|
| `advisor.py` | Pure Python runner — uses `curl` subprocess; reads `settings.json`; writes to `advisor-last-response.md` |
| `install.mjs` | Multi-host installer — deploys commands + runner into host CLI dirs (`~/.qwen/`, `~/.claude/`, etc.) |
| `commands/advisor.md` | Slash command template for `/advisor` |
| `commands/advisor.select.md` | Slash command template for `/advisor.select` |
| `commands/advisor.setup.md` | Slash command template for `/advisor.setup` |
| `advisor-context.md` | Guidance text appended to host context file during setup |
| `templates/CONTEXT.md` | Template for host context files (QWEN.md, CLAUDE.md, etc.) |
| `.playwright-mcp/` | Playwright MCP configuration (used when installed for Qwen) |

## How It Works

1. **Selection** — `/advisor.select <name>` writes the chosen advisor name to `advisor-active`
2. **Setup** — `/advisor.setup` verifies config is correct (API keys, CLI binaries)
3. **Consult** — `/advisor <question>` invokes `python advisor.py <advisorName> <question>`
4. **Output** — Runner prints a short confirmation + preview to stdout, saves full response to `advisor-last-response.md`
5. **Preview** — The host CLI shows the preview inline; user types "show advisor response" for the full text

### Runner Architecture (`advisor.py`)

- Pure Python — uses `curl` subprocess with `--data-binary @tempfile` (Python HTTP libraries hang on Windows)
- Reads `settings.json` (advisors array) to find the selected advisor config
- Resolves API key from `settings.json.env` using the advisor's `envKey`
- Dispatches via `curl` subprocess — all operations bounded by 180s timeout
- Saves the full response to `advisor-last-response.md`
- Prints a short confirmation + preview to stdout
- Supports URL auto-detection: if `baseUrl` ends with `/chat`, skips appending `/chat/completions` (for Ollama `/api/chat`)
- Response parsing handles both OpenAI (`choices[0].message.content`) and Ollama (`message.content`) formats

### Install Flow (`install.mjs`)

- Accepts `--ai <host>` (qwen/claude/codex/gemini/opencode/all)
- Creates host dir + commands subdir, copies command templates (rendered with `{{HOST_DIR}}`)
- Copies `advisor.py` to the host dir
- Writes or appends Advisor section to host context file
- Qwen-only: installs 9 MCP packages globally, wires them into `settings.json`, registers as extension
- Optional: saves OpenRouter key (`--openrouter-key`), Tavily key, GitHub token

## Building and Running

This is a **plugin/installer project** — no build step required.

```bash
# Install for a host CLI
node install.mjs --ai qwen

# Install with optional credentials
node install.mjs --ai qwen --openrouter-key KEY --tavily-key KEY --github-token TOKEN

# Install for all supported hosts
node install.mjs --ai all

# Test the runner directly
python advisor.py chatgpt "What is StateFlow vs SharedFlow?"
python advisor.py openrouter "Explain combine() in Kotlin"
python advisor.py ollama-qwen3.5:397b "Review this Android architecture"
python advisor.py custom-nvidia-deepseek "Hello"  # custom HTTP from settings.json
```

## Development Conventions

- **Python 3** — `advisor.py` uses `subprocess.run(['curl', ...])` with temp file payloads
- **Zero Python dependencies** — `advisor.py` only uses stdlib (json, os, sys, subprocess, time, shlex)
- **No baked-in paths** — runner derives host dir from `~/.qwen/advisor` with optional `ADVISOR_HOST_DIR` env override
- **Windows-first** — `curl` subprocess avoids Python HTTP library hangs on Windows
- **Idempotent install** — backs up `settings.json`, checks for existing Advisor sections, skips already-installed MCPs
- **MIT licensed**

## Qwen Code Source (for reference)

If skeptical about how Qwen handles slash commands, settings, or context:
- **Fork**: `C:\Users\Owner\Desktop\Work\qwen-code-fork\qwen-code`

## Known Constraints

- Chrome must be installed (not bundled Chromium) for web advisors
- Persistent profile at `<host-dir>/playwright-profile/` gets locked if another Chrome instance holds it
- Web advisors open Chrome minimized (~2–3s overhead); headless blocked by Cloudflare
- CLI advisors: 180s timeout, `curl` subprocess (synchronous)
- HTTP advisors: 180s timeout, `curl` subprocess (synchronous)
- Custom HTTP: config stored in `~/.qwen/settings.json` under `customAdvisors`; no streaming (synchronous only); bounded by 180s timeout; advisor name format is `custom-<id>` where `<id>` matches the `id` field in settings.json
