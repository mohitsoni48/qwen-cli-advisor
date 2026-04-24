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

### 1. Read active advisor

Use `filesystem.read_file` to read `C:\Users\Owner\.qwen\advisor-active`.

- **If missing or empty:** respond:
  > "No advisor selected. Run `/advisor.select` to choose one (chatgpt, claude, kimi, qwen)."

  Then stop.

Let `ADVISOR_NAME` = the file contents (trimmed). Let `DISPLAY_NAME` = the display name from the table above.

---

### 2. Validate prerequisites

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-ready-<ADVISOR_NAME>` exists.

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
node "C:\Users\Owner\.qwen\advisor-runner.js" "<ADVISOR_NAME>" "<question>"
```

- Chrome starts minimized — the user will not see it take focus
- The script navigates to a fresh chat, submits the question, waits for the full response, and prints it to stdout
- Capture stdout as `ADVISOR_RESPONSE`
- If the command exits with a non-zero code, capture stderr and report the error

---

### 4. Present the response

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 <DISPLAY_NAME> says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ADVISOR_RESPONSE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Return the response verbatim. Do not summarise or add commentary.

---

## Error handling

| Error | Action |
|-------|--------|
| "Could not find input" | Tell user to run `/advisor.setup` again to re-authenticate |
| "No response received" | Tell user to retry — the advisor may have been slow |
| Script times out (>90s) | Report timeout, suggest retrying |
| Any other stderr | Show the error message verbatim |
