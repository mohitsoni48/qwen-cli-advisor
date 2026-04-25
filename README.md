# qwen-cli-advisor

A Qwen CLI plugin that uses a second AI as a silent advisor. Ask ChatGPT, Claude, Kimi, Qwen, Claude Code, Codex CLI, or Gemini CLI a question mid-task and get a second opinion — without leaving your terminal.

```
/advisor.select claude-code
/advisor Should I use StateFlow or SharedFlow for this ViewModel?
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Claude Code says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use StateFlow when the UI always needs the latest value (e.g. screen state).
Use SharedFlow for events that should be consumed once (e.g. navigation, toasts).
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How it works

- Supports **ChatGPT, Claude, Kimi, Qwen** as web-based advisors (via Playwright browser automation) and **Claude Code, Codex CLI, Gemini CLI** as local CLI advisors (via `child_process.execSync`)
- Switch any time with `/advisor.select` — 7 advisors total
- For web-based advisors: Chrome opens minimized in the background. Submits your question, waits for the full response, saves it to disk, and returns a preview.
- For CLI advisors: runs silently via terminal command. No browser overhead. Uses existing CLI credentials.
- One-time login per web advisor via `/advisor.setup`. CLI advisors need no setup — just select and go.

---

## Prerequisites

- [Qwen CLI](https://github.com/QwenLM/qwen-code) installed
- Node.js 18+
- Google Chrome installed (for web-based advisors only)
- An account on at least one of: ChatGPT, Claude, Kimi, Qwen, Claude Code, Codex, Gemini

### Optional CLI tools

| Advisor | Install command | Requires |
|---------|----------------|----------|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | Anthropic subscription |
| Codex CLI | `npm i -g @openai/codex-cli` | OpenAI API key |
| Gemini CLI | `npm i -g @google/gemini-cli` | Google account |

Install only the ones you want to use. Web-based advisors work without any extra installs.

---

## Installation

Clone the repo and run the installer — it handles everything automatically:

```bash
git clone https://github.com/mohitsoni48/qwen-cli-advisor.git
cd qwen-cli-advisor
node install.mjs
```

The installer will:
- Install all 9 MCP packages globally (`filesystem`, `sequential-thinking`, `memory`, `context7`, `web-search`, `browser`, `sqlite`, `github`, `code-runner`)
- Copy `/advisor`, `/advisor.select`, `/advisor.setup` commands to `~/.qwen/commands/`
- Copy `advisor-runner.js` and `advisor-context.md` to `~/.qwen/`
- Merge MCP config into `~/.qwen/settings.json` (backs up your existing file first)
- Write `~/.qwen/QWEN.md` from template, or AI-merge with your existing one if you already have it

You'll be prompted for an optional Tavily API key (for the `web-search` MCP) and GitHub token (for the `github` MCP). Both can be skipped and added later.

> **QWEN.md merge:** If you already have a `~/.qwen/QWEN.md`, the installer calls a local OpenAI-compatible endpoint (e.g. LM Studio at `localhost:1234`) to intelligently merge it with the advisor template. You can point it at any OpenAI-compatible API. If the AI call fails, it falls back to appending the advisor section.

---

### Manual installation (optional)

If you prefer to install manually instead of running the script:

<details>
<summary>Show manual steps</summary>

**1. Install the browser MCP** (required for advisor):
```bash
npm install -g @playwright/mcp
```

**2. Copy command files** to `~/.qwen/commands/`:
```
.qwen/commands/advisor.select.md
.qwen/commands/advisor.setup.md
.qwen/commands/advisor.md
```

**3. Copy support files** to `~/.qwen/`:
```
advisor-runner.js
advisor-context.md
```

**4. Configure the browser MCP** in `~/.qwen/settings.json`:
```json
"browser": {
  "command": "node",
  "args": [
    "/path/to/node_modules/@playwright/mcp/cli.js",
    "--browser", "chrome",
    "--user-data-dir", "/path/to/.qwen/playwright-profile"
  ],
  "trust": true
}
```

> **Why not headless?** ChatGPT uses Cloudflare bot detection. A fresh headless browser gets blocked. Headed Chrome with a persistent profile passes Cloudflare on first launch, then session cookies handle all subsequent visits. All advisors share this profile — cookies are domain-scoped so they don't interfere with each other.

**5. Add permission** to `~/.qwen/settings.json`:
```json
"Bash(node *)"
```

</details>

---

## Setup (one time per advisor)

Restart Qwen CLI after the config changes, then:

```
/advisor.select <name>    # choose from: chatgpt, claude, kimi, qwen, claude-code, codex, gemini
/advisor.setup            # web advisors only — browser login; CLI needs no setup
```

This will:
1. Save your advisor choice
2. **Web-based** (chatgpt/claude/kimi/qwen): open Chrome so you can log in manually
3. **CLI-based** (claude-code/codex/gemini): verify the tool is installed and authenticated
4. Once logged in (web) or verified (CLI): save the session and inject advisor guidance into your `QWEN.md`

Repeat for any other advisors you want to use. Web advisors only need setup once — the session persists in `~/.qwen/playwright-profile`. CLI advisors need no setup beyond having the tool installed.

---

## Usage

```
/advisor.select <name>    # choose advisor: chatgpt, claude, kimi, qwen
/advisor <your question>  # consult the active advisor
```

**Examples:**

```
/advisor.select claude

/advisor In my Android ViewModel I need to combine a Room Flow with a SharedFlow from a Service. Should I use combine() or collectLatest?

/advisor Is it better to use a single Activity with multiple Fragments or multiple Activities for this flow?

/advisor I've been getting a NullPointerException in onResume but only on cold start. What should I check first?
```

### When to use it

- Before choosing between two technical approaches
- When stuck on a bug after 2+ attempts
- Before making a decision that touches architecture or multiple files
- When you want a second opinion on a plan

---

## Files

| File | Purpose |
|------|---------|
| `.qwen/commands/advisor.select.md` | Choose the active advisor (7 options) |
| `.qwen/commands/advisor.setup.md` | One-time login for web advisors; verify CLI tools |
| `.qwen/commands/advisor.md` | The main `/advisor` command |
| `advisor-runner.js` → `~/.qwen/` | Standalone Playwright + child_process script — handles all browser and CLI interaction |
| `advisor-context.md` → `~/.qwen/` | Advisor guidance injected into QWEN.md during setup |

---

## Supported advisors

| Name | Service | Chat URL / CLI Command | Type | Notes |
|------|---------|------------------------|------|-------|
| `chatgpt` | OpenAI ChatGPT | chatgpt.com | Web | Temporary chat (not saved to history) |
| `claude` | Anthropic Claude | claude.ai/new | Web | Conversations are saved to history |
| `kimi` | Moonshot AI Kimi | kimi.com | Web | Conversations are saved to history |
| `qwen` | Alibaba Qwen | chat.qwen.ai | Web | Conversations are saved to history |
| `claude-code` | Anthropic Claude Code | `claude -p <question>` | CLI | Requires subscription; runs locally |
| `codex` | OpenAI Codex CLI | `codex exec <question>` | CLI | Requires API key; runs locally |
| `gemini` | Google Gemini CLI | `gemini -p <question>` | CLI | Requires Google account; runs locally |

---

## Known limitations

- **Web advisors:** Chrome opens minimized in the taskbar during each call (~2–3 second overhead). Headless mode is blocked by Cloudflare. Only ChatGPT supports temporary (unsaved) chats. If an advisor's DOM changes, selectors in `advisor-runner.js` may need updating.
- **CLI advisors:** Run synchronously via `child_process.execSync`. No browser overhead but depend on the CLI tool being installed and authenticated. Claude Code may take a moment to initialize its session. Output is captured from stdout — very long responses are truncated at 200 chars in the preview (full response saved to disk).
- All advisors share one Playwright profile (`~/.qwen/playwright-profile`) for web-based logins. CLI tools use their own credential stores.

---

## Roadmap

- [ ] Silent mode: keep Chrome running between calls to eliminate startup overhead (web advisors)
- [ ] Subagent isolation: run the advisor in a fully separate Qwen context
- [ ] Headless fallback after initial headed login
- [ ] Streaming output for CLI advisors (real-time response display)

---

## License

MIT
