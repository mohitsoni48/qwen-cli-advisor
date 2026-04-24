# qwen-cli-advisor

A Qwen CLI plugin that uses a second AI as a silent advisor. Ask ChatGPT, Claude, Kimi, or Qwen a question mid-task and get a second opinion — without leaving your terminal.

```
/advisor.select claude
/advisor Should I use StateFlow or SharedFlow for this ViewModel?
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Claude says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use StateFlow when the UI always needs the latest value (e.g. screen state).
Use SharedFlow for events that should be consumed once (e.g. navigation, toasts).
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How it works

- Supports **ChatGPT, Claude, Kimi, and Qwen** as advisors — switch any time with `/advisor.select`
- Uses the `@playwright/mcp` browser to open a chat with the active advisor
- Submits your question, waits for the full response, and returns it verbatim
- Chrome opens minimized in the background — no interaction needed after setup
- One-time login per advisor via `/advisor.setup`, then fully automatic

---

## Prerequisites

- [Qwen CLI](https://github.com/QwenLM/qwen-code) installed
- `@playwright/mcp` configured in Qwen CLI's `settings.json`
- Google Chrome installed
- An account on at least one of: ChatGPT, Claude, Kimi, Qwen

---

## Installation

### 1. Copy the command files

Copy all files from `.qwen/commands/` into your project's `.qwen/commands/` folder (or your global `~/.qwen/commands/`):

```
.qwen/commands/advisor.select.md
.qwen/commands/advisor.setup.md
.qwen/commands/advisor.md
```

### 2. Copy the runner script

Copy `advisor-runner.js` to your global Qwen config directory:

```
~/.qwen/advisor-runner.js
```

On Windows: `C:\Users\<you>\.qwen\advisor-runner.js`

### 3. Copy the advisor context

Copy `advisor-context.md` to your global Qwen config directory:

```
~/.qwen/advisor-context.md
```

### 4. Configure the browser MCP

In your `~/.qwen/settings.json`, configure the `browser` MCP to use a **persistent Chrome profile** (not headless):

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

> **Why not headless?** ChatGPT uses Cloudflare bot detection. A fresh headless browser gets blocked. Headed Chrome with a persistent profile passes Cloudflare on first launch, then the session cookies handle all subsequent visits. All advisors share this profile — cookies are domain-scoped so they don't interfere with each other.

### 5. Allow the runner in permissions

Add to the `permissions.allow` array in `~/.qwen/settings.json`:

```json
"Bash(node *)"
```

---

## Setup (one time per advisor)

Restart Qwen CLI after the config changes, then:

```
/advisor.select chatgpt
/advisor.setup
```

This will:
1. Save your advisor choice
2. Open Chrome and navigate to the advisor's login page
3. If not logged in: show a Chrome window so you can log in manually
4. Once logged in: save the session and inject advisor guidance into your `QWEN.md`

Repeat for any other advisors you want to use. Each advisor only needs setup once — the session persists in `~/.qwen/playwright-profile`.

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
| `.qwen/commands/advisor.select.md` | Choose the active advisor |
| `.qwen/commands/advisor.setup.md` | One-time login for the selected advisor |
| `.qwen/commands/advisor.md` | The main `/advisor` command |
| `advisor-runner.js` → `~/.qwen/` | Standalone Playwright script — handles all browser interaction |
| `advisor-context.md` → `~/.qwen/` | Advisor guidance injected into QWEN.md during setup |

---

## Supported advisors

| Name | Service | Chat URL | Notes |
|------|---------|----------|-------|
| `chatgpt` | OpenAI ChatGPT | chatgpt.com | Temporary chat (not saved to history) |
| `claude` | Anthropic Claude | claude.ai/new | Conversations are saved to history |
| `kimi` | Moonshot AI Kimi | kimi.com | Conversations are saved to history |
| `qwen` | Alibaba Qwen | chat.qwen.ai | Conversations are saved to history |

---

## Known limitations

- Chrome opens minimized in the taskbar during each advisor call (visible but not intrusive). Headless mode is blocked by Cloudflare.
- Each call starts a fresh Chrome process (~2–3 second overhead).
- Only ChatGPT supports temporary (unsaved) chats. Other advisors save conversations to their history.
- If an advisor's DOM changes, the selectors in `advisor-runner.js` may need updating. Each advisor's selectors are clearly grouped in the `ADVISORS` config object at the top of the file.

---

## Roadmap

- [ ] Silent mode: keep Chrome running between calls to eliminate startup overhead
- [ ] Subagent isolation: run the advisor in a fully separate Qwen context
- [ ] Headless fallback after initial headed login

---

## License

MIT
