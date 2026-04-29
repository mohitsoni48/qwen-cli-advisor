---
description: One-time setup for the active advisor. Web-based advisors need a browser login; CLI advisors just verify the tool is installed and authenticated. Run /advisor.select first.
handoffs:
  - label: Start advising
    agent: advisor
    prompt: I am ready to use the advisor.
---

## Goal

Authenticate the currently-selected advisor and mark it as ready for use.

## Advisor URLs (web-based only)

| Name | URL | Login indicator |
|------|-----|----------------|
| chatgpt | https://chatgpt.com | "Log in" or "Sign up" |
| claude | https://claude.ai | "Sign in" or "Log in" |
| kimi | https://www.kimi.com | "Log in" or "Sign in" |
| qwen | https://chat.qwen.ai | "Log in" or "Sign up" |

## Steps

### 0. Resolve paths

```
HOST_DIR = {{HOST_DIR}}
```

Use it for all file operations below.

---

### 1. Read active advisor

Use `filesystem.read_file` to read `{HOST_DIR}advisor-active`.

- **If the file is missing or empty:** respond:
  > "No advisor selected. Run `/advisor.select` first to choose one."

  Then stop.

Let `ADVISOR_NAME` = the file contents (trimmed, lowercase). Let `ADVISOR_URL` = the URL from the table above (or null for CLI advisors).

---

### 2. Check if already set up

Use `filesystem.read_file` to check if `{HOST_DIR}advisor-ready-{ADVISOR_NAME}` exists.

- **If it exists:** respond:
  > "**\<ADVISOR_NAME\>** is already set up. Run `/advisor <question>` to start."

  Then stop.

---

### 3. CLI-based advisors — verify installation

For `claude-code`, `codex`, or `gemini`: no browser login needed. Just verify the tool works:

Run `Bash(where claude)` (or `where codex` / `where gemini`). If found, write `{HOST_DIR}advisor-ready-{ADVISOR_NAME}` with content `ready` and respond:

> **\<ADVISOR_NAME\>** is ready.
>
> No browser login needed — it uses your existing CLI credentials.
> Run `/advisor <your question>` to start.

If the tool is not found, respond:
> "**\<ADVISOR_NAME\>** is not installed."
>
> Install it first:
> - Claude Code: `npm i -g @anthropic-ai/claude-code` (requires Anthropic subscription)
> - Codex CLI: `npm i -g @openai/codex` (requires OpenAI API key)
> - Gemini CLI: `npm i -g @google/gemini-cli` (requires Google account)

Then stop.

---

### 2b. Custom HTTP advisors — verify config

For `custom-http` (or any `custom-*` advisor): read `{HOST_DIR}settings.json` (or `~/.qwen/settings.json`) and check that `customAdvisors` contains an entry with matching `id`.

Use `filesystem.read_file` to read `~/.qwen/settings.json`.

Parse the JSON and check for `settings.customAdvisors` array with an entry whose `id` matches the advisor name (stripped of `custom-` prefix).

**If found:** write `{HOST_DIR}advisor-ready-{ADVISOR_NAME}` with content `ready` and respond:

> **\<ADVISOR_NAME\>** is ready.
>
> HTTP advisor configured in `settings.json` — uses your API key.
> Run `/advisor <your question>` to start.

**If not found:** respond:

> "**\<ADVISOR_NAME\>** is not configured."
>
> Add it to `settings.json` under the `customAdvisors` array with these fields:
> - `id` — lookup key (e.g. `nvidia-deepseek`)
> - `name` — display name
> - `baseUrl` — e.g. `https://integrate.api.nvidia.com/v1`
> - `envKey` — reference to a key in `settings.json.env` (e.g. `NVAPI_KEY`)
> - `model` — model name
> - `generationConfig` (optional) — `temperature`, `top_p`, `extra_body`, `contextWindowSize`
>
> Then run `/advisor.setup` again.

Then stop.

---

### 4. Web-based advisors — browser login

For chatgpt, claude, kimi, qwen:

#### Check runner script exists

Check if `{HOST_DIR}advisor.py` exists using `filesystem.read_file`.

**If missing**, respond:
> "The advisor runner script is missing. Run `node install.mjs --ai <host>` from the advisor repo to complete setup."

Then stop.

---

### 5. Navigate to advisor login page

Use the browser tool to navigate to `ADVISOR_URL`.

Take a snapshot of the page.

---

### 6. Detect login state

Inspect the snapshot for login indicators: "Log in", "Sign in", "Sign up", "Get started", "Continue with Google".

#### Not logged in — show instructions:

> **Advisor Setup — Action Required**
>
> A Chrome window has opened for **\<ADVISOR_NAME\>** (check your Windows taskbar).
>
> To complete setup:
> 1. Click the Chrome icon in your taskbar to bring it to the front
> 2. Log into **\<ADVISOR_NAME\>** with your account
> 3. Once you see the chat interface, come back and run `/advisor.setup` again
>
> This is a one-time step — the session is saved permanently.

Then stop.

#### Logged in — continue to Step 7.

---

### 7. Save setup flag

Use `filesystem.write_file` to write `ready` to:

```
{HOST_DIR}advisor-ready-{ADVISOR_NAME}
```

---

### 8. Inject advisor guidance into QWEN.md (first setup only)

Use `filesystem.read_file` to read `{HOST_DIR}QWEN.md`.

Search for `## Advisor` in the content.

- **If found:** skip this step (already injected).
- **If not found:**
  1. Read `{HOST_DIR}advisor-context.md`
  2. Append its contents to QWEN.md with a blank line separator before it
  3. Also append these rows to the Slash Commands table in QWEN.md:
     ```
     | `/advisor.select` | Choose your active AI advisor (ChatGPT, Claude, Kimi, Qwen, Claude Code, Codex CLI, Gemini CLI) |
     | `/advisor.setup` | One-time login for web advisors; verify CLI tools |
     | `/advisor <question>` | Get a second opinion from your active advisor |
     ```

---

### 9. Confirm

Respond:

> **\<ADVISOR_NAME\>** Setup Complete
>
> \<ADVISOR_NAME\> is ready to use. Run `/advisor <your question>` to start.
