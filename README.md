# qwen-cli-advisor

A Qwen CLI plugin that uses ChatGPT as a silent advisor. Ask ChatGPT a question mid-task and get a second opinion — without leaving your terminal.

```
/advisor Should I use StateFlow or SharedFlow for this ViewModel?
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ChatGPT says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use StateFlow when the UI always needs the latest value (e.g. screen state).
Use SharedFlow for events that should be consumed once (e.g. navigation, toasts).
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How it works

- Uses the `@playwright/mcp` browser to open a **temporary ChatGPT chat** (not saved to history)
- Submits your question, waits for the full response, and returns it verbatim
- Chrome opens minimized in the background — no interaction needed after setup
- One-time login via `/advisor.setup`, then fully automatic

---

## Prerequisites

- [Qwen CLI](https://github.com/QwenLM/qwen-code) installed
- `@playwright/mcp` configured in Qwen CLI's `settings.json`
- Google Chrome installed
- A ChatGPT account (free or Plus)

---

## Installation

### 1. Copy the command files

Copy both files from `.qwen/commands/` into your project's `.qwen/commands/` folder (or your global `~/.qwen/commands/` if Qwen supports it):

```
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

In your `~/.qwen/settings.json`, make sure the `browser` MCP is configured to use a **persistent Chrome profile** (not headless):

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

> **Why not headless?** ChatGPT uses Cloudflare bot detection. A fresh headless browser gets blocked. Headed Chrome with a persistent profile passes Cloudflare on first launch, then the session cookies handle all subsequent visits.

### 5. Allow the runner in permissions

Add to the `permissions.allow` array in `~/.qwen/settings.json`:

```json
"Bash(node *)"
```

---

## Setup (one time)

Restart Qwen CLI after the config changes, then run:

```
/advisor.setup
```

This will:
1. Open Chrome and navigate to ChatGPT
2. If not logged in: show a Chrome window so you can log in manually
3. Once logged in: save the session and inject advisor guidance into your `QWEN.md`

You only need to do this once. The session persists in `~/.qwen/playwright-profile`.

---

## Usage

```
/advisor <your question>
```

**Examples:**

```
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
| `.qwen/commands/advisor.md` | The main `/advisor` command |
| `.qwen/commands/advisor.setup.md` | One-time onboarding command |
| `advisor-runner.js` → `~/.qwen/` | Standalone Playwright script — handles all browser interaction |
| `advisor-context.md` → `~/.qwen/` | Advisor guidance injected into QWEN.md during setup |

---

## Known limitations

- Chrome opens minimized in the taskbar during each advisor call (visible but not intrusive). Headless mode is blocked by Cloudflare on first launch.
- Each call starts a fresh Chrome process (~2–3 second overhead).
- Temporary chats are not saved — each `/advisor` call is stateless.
- If ChatGPT's DOM changes, the input/response selectors in `advisor-runner.js` may need updating.

---

## Roadmap

- [ ] Silent mode: keep Chrome running between calls to eliminate startup overhead
- [ ] Subagent isolation: run the advisor in a fully separate Qwen context
- [ ] Headless fallback after initial headed login

---

## License

MIT
