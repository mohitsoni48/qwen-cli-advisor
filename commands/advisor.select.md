---
description: Choose your active AI advisor (ChatGPT, Claude, Kimi, Qwen, Claude Code, Codex CLI, or Gemini CLI). Run /advisor.setup after selecting web-based advisors to authenticate. CLI advisors need no setup — just select and go.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Let the user pick which AI acts as their advisor. The choice is saved to `advisor-active` in the `.qwen` folder of the user's home directory and read by `/advisor` on every call.

## Available Advisors

| # | Name | Service | Type |
|---|------|---------|------|
| 1 | chatgpt | ChatGPT (OpenAI) | Web |
| 2 | claude | Claude (Anthropic) | Web |
| 3 | kimi | Kimi (Moonshot AI) | Web |
| 4 | qwen | Qwen (Alibaba) | Web |
| 5 | claude-code | Claude Code (Anthropic) | CLI |
| 6 | codex | Codex CLI (OpenAI) | CLI |
| 7 | gemini | Gemini CLI (Google) | CLI |

## Steps

### 0. Resolve paths

Determine the user's `.qwen` directory:
- **Windows:** run `Bash(echo %USERPROFILE%)`, then append `\.qwen\`
- **macOS/Linux:** run `Bash(echo $HOME)`, then append `/.qwen/`

Let `QWEN_DIR` = that resolved path. Use it for all file operations below.

---

### 1. Parse selection

If `$ARGUMENTS` is empty, display the table above and respond:

> **Select your advisor:**
>
> | # | Name | Service | Type |
> |---|------|---------|------|
> | 1 | chatgpt | ChatGPT (OpenAI) | Web |
> | 2 | claude | Claude (Anthropic) | Web |
> | 3 | kimi | Kimi (Moonshot AI) | Web |
> | 4 | qwen | Qwen (Alibaba) | Web |
> | 5 | claude-code | Claude Code (Anthropic) | CLI |
> | 6 | codex | Codex CLI (OpenAI) | CLI |
> | 7 | gemini | Gemini CLI (Google) | CLI |
>
> Run `/advisor.select <name or number>` to activate one.
> Example: `/advisor.select claude-code`

Then stop.

Accept either the name or number. Map numbers to names:
- `1` → `chatgpt`
- `2` → `claude`
- `3` → `kimi`
- `4` → `qwen`
- `5` → `claude-code`
- `6` → `codex`
- `7` → `gemini`

If the input doesn't match any entry, show the table and respond:
> "Unknown advisor. Choose from: chatgpt, claude, kimi, qwen, claude-code, codex, gemini."

Then stop.

---

### 2. Write active advisor

Use `filesystem.write_file` to write the advisor name (e.g. `claude-code`) to:

```
{QWEN_DIR}advisor-active
```

---

### 3. Check setup status

Use `filesystem.read_file` to check if the following file exists:

```
{QWEN_DIR}advisor-ready-<name>
```

**If it exists** — advisor is already authenticated (or CLI-based, no auth needed). Respond:

> ✓ **\<Name\> is now your active advisor.**
> Run `/advisor <your question>` to start.

**If it does not exist:**

- **For web-based advisors only** (chatgpt, claude, kimi, qwen): respond:
  > "**\<Name\>** selected."
  >
  > You haven't logged in yet. Run `/advisor.setup` to open a Chrome window and log into **\<Name\>**.
  > Once logged in, run `/advisor.setup` again to confirm — then you're ready.

- **For CLI-based advisors** (claude-code, codex, gemini): respond:
  > "**\<Name\>** selected."
  >
  > No setup needed — CLI advisors run locally and use your existing credentials.
  > Run `/advisor <your question>` to start immediately.
