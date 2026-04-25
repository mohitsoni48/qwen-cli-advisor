# Open-Advisor

> Open-source `/advisor` slash command for any AI CLI — consult ChatGPT, Claude, Kimi, Qwen, Claude Code, Codex, Gemini, or any OpenRouter model without leaving your terminal.

Runs as a plugin inside **Qwen CLI, Claude Code, Codex CLI, Gemini CLI, or OpenCode**. Pick your host with `--ai <name>` at install time (speckit-style).

The advisor you consult can be any of: **ChatGPT, Claude, Kimi, Qwen** (web — Playwright), **Claude Code, Codex CLI, Gemini CLI** (local — child process), or **any model on OpenRouter** (HTTP — OpenAI-compatible API).

```
/advisor.select claude-code
/advisor Should I use StateFlow or SharedFlow for this ViewModel?
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Claude Code says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Claude Code responded (1247 chars)

Preview: Use StateFlow when the UI always needs the latest value (e.g. screen state).
Use SharedFlow for events that should be consumed once (e.g. navigation, toasts)…

Full response saved to: ~/.claude/advisor-last-response.md

Say "show advisor response" to load the full reply.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The full reply stays out of your main chat context unless you explicitly ask for it — keeps your session lean during long tasks.

---

## How it works

- **8 advisors total**, three transports:
  - **Web** (ChatGPT, Claude, Kimi, Qwen) — Playwright drives a real Chrome instance with a persistent profile; one login per advisor, sessions persist
  - **CLI** (Claude Code, Codex, Gemini) — `child_process.spawnSync` runs the local binary; uses each tool's existing credentials
  - **HTTP** (OpenRouter) — direct call to `openrouter.ai/api/v1/chat/completions`; pick any model OpenRouter exposes
- Switch any time with `/advisor.select`
- Every response is saved to `<host-dir>/advisor-last-response.md`; only a 200-char preview is shown inline

---

## Prerequisites

- Node.js 18+
- One of the supported host CLIs ([Qwen](https://github.com/QwenLM/qwen-code), [Claude Code](https://github.com/anthropics/claude-code), [Codex](https://www.npmjs.com/package/@openai/codex), [Gemini](https://www.npmjs.com/package/@google/gemini-cli), or OpenCode)
- **Google Chrome** installed (web advisors only — Playwright launches Chrome via `channel: 'chrome'`; bundled Chromium and other browsers are not used)
- An account on at least one advisor service

Should work on macOS, Linux, and Windows 11; the install flow is verified on Windows 11.

### Optional CLI advisor tools

Only needed if you want to *consult* one of these as your advisor (you don't need them just to host the plugin):

| Advisor | Install command | Auth |
|---------|----------------|------|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | Anthropic subscription |
| Codex CLI | `npm i -g @openai/codex` | OpenAI API key |
| Gemini CLI | `npm i -g @google/gemini-cli` | Google account |

---

## Installation

```bash
git clone https://github.com/mohitsoni48/open-advisor.git
cd open-advisor

node install.mjs --ai <host>
```

`<host>` is one of:

| `--ai` | Install dir | Commands subdir | Context file |
|--------|-------------|-----------------|--------------|
| `qwen` | `~/.qwen/` | `commands/` | `QWEN.md` |
| `claude` | `~/.claude/` | `commands/` | `CLAUDE.md` |
| `codex` | `~/.codex/` | `prompts/` | `AGENTS.md` |
| `gemini` | `~/.gemini/` | `commands/` | `GEMINI.md` |
| `opencode` | `~/.config/opencode/` | `command/` | `AGENTS.md` |
| `all` | every dir above | — | — |

For each selected host the installer:
- Renders and copies `/advisor`, `/advisor.select`, `/advisor.setup` into the host's commands subdir
- Copies `advisor-runner.js` and `advisor-context.md` into the host dir
- Writes the host's context file from the template, or appends an `## Advisor` section if one already exists
- For `--ai qwen` only: also installs MCP packages globally and wires them into `~/.qwen/settings.json` (`filesystem`, `sequential-thinking`, `memory`, `context7`, `web-search`, `browser`, `sqlite`, `github`, `code-runner`)

The runner derives its host dir from `__dirname` at runtime — no path strings baked into source, no escape-character pitfalls on Windows.

### Optional flags

```bash
--openrouter-key <KEY>     # save OpenRouter API key for the `openrouter` advisor
--openrouter-model <ID>    # e.g. anthropic/claude-3.5-sonnet (default openai/gpt-4o-mini)
--tavily-key <KEY>         # Tavily API key, Qwen MCP only
--github-token <TOKEN>     # GitHub token, Qwen MCP only
```

`node install.mjs --help` for the full list. Anything skipped can be set later by editing the host dir.

---

## Setup (one time per advisor)

After the installer finishes, **restart your CLI host**, then:

```
/advisor.select <name>    # chatgpt | claude | kimi | qwen | claude-code | codex | gemini | openrouter
/advisor.setup            # web advisors: browser login. CLI/HTTP: nothing to do.
```

What `/advisor.setup` does, by advisor type:

- **Web** (chatgpt/claude/kimi/qwen): opens Chrome at the advisor's URL so you can log in. Run `/advisor.setup` again afterward to confirm. The session is saved in `<host-dir>/playwright-profile/` and reused on every subsequent call.
- **CLI** (claude-code/codex/gemini): verifies the binary is on your `PATH`. No login needed.
- **HTTP** (openrouter): no setup — the runner reads `OPENROUTER_API_KEY` from your env, or `<host-dir>/advisor-openrouter.json` if you used `--openrouter-key` at install time.

---

## Usage

```
/advisor.select <name>
/advisor <your question>
```

**Examples:**

```
/advisor.select claude

/advisor In my Android ViewModel I need to combine a Room Flow with a SharedFlow from a Service. Should I use combine() or collectLatest?

/advisor Is it better to use a single Activity with multiple Fragments or multiple Activities for this flow?

/advisor I've been getting a NullPointerException in onResume but only on cold start. What should I check first?
```

Type **"show advisor response"** afterward to load the full reply into the chat (otherwise only the preview is shown).

### When to use it

- Before choosing between two non-obvious technical approaches
- When stuck on a bug after 2+ attempts
- Before a change that affects 5+ files or introduces a new pattern
- When the user asks "what do you think?" / "which is better?"

Skip it for trivial tasks (renames, formatting, single log lines) and for back-to-back turns on the same decision.

---

## Files installed per host

| Path (relative to host dir) | Purpose |
|---|---|
| `commands/advisor.md` (or `prompts/`, `command/`) | The `/advisor` slash command |
| `commands/advisor.select.md` | The `/advisor.select` slash command |
| `commands/advisor.setup.md` | The `/advisor.setup` slash command |
| `advisor-runner.js` | Standalone Playwright + spawn + HTTP script — handles every advisor type |
| `advisor-context.md` | Advisor guidance appended to the host's context file during setup |
| `advisor-active` | Plain-text file: name of the currently-selected advisor |
| `advisor-ready-<name>` | Empty marker file: this advisor is set up and ready |
| `advisor-last-response.md` | Full text of the most recent response (rewritten each call) |
| `advisor-openrouter.json` | OpenRouter API key + model (only if you configured one; chmod 0600 on POSIX) |
| `playwright-profile/` | Shared persistent Chrome profile for web advisors |

---

## Supported advisors

| Name | Service | Endpoint | Type | Notes |
|------|---------|----------|------|-------|
| `chatgpt` | OpenAI ChatGPT | chatgpt.com | Web | Uses temporary chat (not saved to history) |
| `claude` | Anthropic Claude | claude.ai/new | Web | Conversations saved to your history |
| `kimi` | Moonshot AI Kimi | kimi.com | Web | Conversations saved to your history |
| `qwen` | Alibaba Qwen | chat.qwen.ai | Web | Conversations saved to your history |
| `claude-code` | Anthropic Claude Code | `claude -p <q>` | CLI | Requires subscription; runs locally |
| `codex` | OpenAI Codex CLI | `codex exec <q>` | CLI | Requires API key; runs locally |
| `gemini` | Google Gemini CLI | `gemini -p <q>` | CLI | Requires Google account; runs locally |
| `openrouter` | Any model via OpenRouter | `openrouter.ai/api/v1` | HTTP | OpenAI-compatible; usage is billed |

---

## Privacy & trust

This is a tool that sends your code questions to third parties on your behalf. Be aware:

- **Web advisors** (ChatGPT/Claude/Kimi/Qwen): each call submits your question to the advisor's web UI. Responses may be retained per that service's policies. Only ChatGPT is invoked in temporary-chat mode; the other three save to your account history. Review each provider's ToS — automated browser interaction is in a grey area for some services. Use at your own risk.
- **CLI advisors**: questions go to whatever endpoint that CLI is configured to use (Anthropic, OpenAI, Google).
- **OpenRouter**: questions go to OpenRouter, which routes them to the model provider you selected. Usage is metered and billed per OpenRouter's pricing.
- **API keys** (`advisor-openrouter.json`, the runner's env vars) are stored in plaintext in your host dir. The installer sets mode `0600` on POSIX; on Windows protect the file with normal user-account permissions.
- **Responses** are saved to `<host-dir>/advisor-last-response.md` (rewritten each call) so the host AI can read them on demand.
- **No telemetry** is sent anywhere by this plugin itself.

---

## Known limitations

- **Web advisors:** Chrome opens minimized in the taskbar during each call (~2–3 second overhead). Headless mode is blocked by Cloudflare. Only ChatGPT supports temporary (unsaved) chats. If an advisor's DOM changes, the selectors in `advisor-runner.js` will need updating.
- **CLI advisors:** Run synchronously via `child_process.spawnSync` with a 90-second timeout. On Windows the runner uses `shell: true` to invoke npm-installed `.cmd` shims; arguments are still passed as an array (no string interpolation, so questions with quotes/spaces are safe).
- **OpenRouter:** Requires network + a valid API key. The runner does not stream — you wait for the full response (also bounded by the 90s timeout).
- **Profile sharing:** All web advisors share one Playwright profile (`<host-dir>/playwright-profile/`). Cookies are domain-scoped, so they don't interfere — but logging out of one advisor in that profile won't affect others.

---

## Roadmap

- [ ] Persistent Chrome between calls (eliminate startup overhead for web advisors)
- [ ] Subagent isolation (run the advisor in a fully separate context window)
- [ ] Streaming output for CLI and HTTP advisors
- [ ] Headless fallback after first headed login

---

## Contributing

Issues and PRs welcome. Useful one-line tests before opening a PR:

```bash
node --check install.mjs
node --check advisor-runner.js
```

For a full dry-run install into a temp dir (POSIX):

```bash
TMP=$(mktemp -d) && HOME="$TMP" USERPROFILE="$TMP" \
  node install.mjs --ai claude --openrouter-key '' < /dev/null
ls "$TMP/.claude/"
```

---

## License

[MIT](LICENSE)
