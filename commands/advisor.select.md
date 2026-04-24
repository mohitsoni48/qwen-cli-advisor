---
description: Choose your active AI advisor (ChatGPT, Claude, Kimi, or Qwen). Run /advisor.setup after selecting to authenticate, then /advisor <question> to consult.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Let the user pick which AI acts as their advisor. The choice is saved to `advisor-active` in the `.qwen` folder of the user's home directory and read by `/advisor` on every call.

## Available Advisors

| # | Name | Service |
|---|------|---------|
| 1 | chatgpt | ChatGPT (OpenAI) |
| 2 | claude | Claude (Anthropic) |
| 3 | kimi | Kimi (Moonshot AI) |
| 4 | qwen | Qwen (Alibaba) |

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
> | # | Name | Service |
> |---|------|---------|
> | 1 | chatgpt | ChatGPT (OpenAI) |
> | 2 | claude | Claude (Anthropic) |
> | 3 | kimi | Kimi (Moonshot AI) |
> | 4 | qwen | Qwen (Alibaba) |
>
> Run `/advisor.select <name or number>` to activate one.
> Example: `/advisor.select claude`

Then stop.

Accept either the name or number. Map numbers to names:
- `1` → `chatgpt`
- `2` → `claude`
- `3` → `kimi`
- `4` → `qwen`

If the input doesn't match any entry, show the table and respond:
> "Unknown advisor. Choose from: chatgpt, claude, kimi, qwen."

Then stop.

---

### 2. Write active advisor

Use `filesystem.write_file` to write the advisor name (e.g. `claude`) to:

```
{QWEN_DIR}advisor-active
```

---

### 3. Check setup status

Use `filesystem.read_file` to check if the following file exists:

```
{QWEN_DIR}advisor-ready-<name>
```

**If it exists** — advisor is already authenticated. Respond:

> ✓ **\<Name\> is now your active advisor.**
> Run `/advisor <your question>` to start.

**If it does not exist** — advisor needs authentication. Respond:

> **\<Name\> selected.**
>
> You haven't logged in yet. Run `/advisor.setup` to open a Chrome window and log into \<Name\>.
> Once logged in, run `/advisor.setup` again to confirm — then you're ready.
