---
description: Consult your active AI advisor (ChatGPT, Claude, Kimi, or Qwen). Chrome opens minimized and closes when done — your session stays clean. Use /advisor.select to switch advisors.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Get a second opinion from whichever AI advisor is currently active.

## Advisor display names

| Name | Display |
|------|---------|
| chatgpt | ChatGPT |
| claude | Claude |
| kimi | Kimi |
| qwen | Qwen |

## Steps

### 0. Resolve paths

Determine the user's `.qwen` directory:
- **Windows:** run `Bash(echo %USERPROFILE%)`, then append `\.qwen\`
- **macOS/Linux:** run `Bash(echo $HOME)`, then append `/.qwen/`

Let `QWEN_DIR` = that resolved path. Use it for all file operations below.

---

### 1. Read active advisor

Use `filesystem.read_file` to read `{QWEN_DIR}advisor-active`.

- **If missing or empty:** respond:
  > "No advisor selected. Run `/advisor.select` to choose one (chatgpt, claude, kimi, qwen)."

  Then stop.

Let `ADVISOR_NAME` = the file contents (trimmed). Let `DISPLAY_NAME` = the display name from the table above.

---

### 2. Validate prerequisites

Use `filesystem.read_file` to check if `{QWEN_DIR}advisor-ready-{ADVISOR_NAME}` exists.

- **If missing:** respond:
  > "**\<DISPLAY_NAME\>** is not set up yet. Run `/advisor.setup` to log in."

  Then stop.

If `$ARGUMENTS` is empty: respond:
> "Usage: `/advisor <your question>`"

Then stop.

---

### 3. Run the advisor script

Execute the following shell command, replacing `<ADVISOR_NAME>` and `<question>` with the actual values:

```
node "{QWEN_DIR}advisor-runner.js" "<ADVISOR_NAME>" "<question>"
```

- Chrome starts minimized — the user will not see it take focus
- The script navigates to a fresh chat, submits the question, waits for the full response, saves it to disk, and prints a short confirmation + preview to stdout
- Capture stdout as `ADVISOR_RESPONSE`
- If the command exits with a non-zero code, capture stderr and report the error

---

### 4. Present the response

Present exactly what the script printed to stdout — the confirmation line, preview, and file path. Do NOT read the response file and do NOT echo or expand the full response into the conversation. This keeps the full response out of the main chat context.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 <DISPLAY_NAME> says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ADVISOR_RESPONSE — the confirmation + preview lines, verbatim]

Say "show advisor response" to load the full reply.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If the user then says "show advisor response" or "show full response", use `filesystem.read_file` to read `{QWEN_DIR}advisor-last-response.md` and display its contents.

---

## Error handling

| Error | Action |
|-------|--------|
| "Could not find input" | Tell user to run `/advisor.setup` again to re-authenticate |
| "No response received" | Tell user to retry — the advisor may have been slow |
| Script times out (>90s) | Report timeout, suggest retrying |
| Any other stderr | Show the error message verbatim |
