---
description: Consult ChatGPT as a silent advisor. Runs a standalone Playwright script in the background — Chrome opens minimized, your session stays clean.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Get a second opinion from ChatGPT. A dedicated Node.js script handles all browser interaction independently — Chrome starts minimized, does its work, and closes. Nothing appears in your current session context.

## Steps

### 1. Validate prerequisites

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-ready` exists.

- If missing: respond with:
  > "Advisor is not set up yet. Run `/advisor.setup` first."
  Then stop.

If `$ARGUMENTS` is empty: respond with:
> "Usage: `/advisor <your question>`"
Then stop.

---

### 2. Run the advisor script

Execute the following shell command, replacing `<question>` with the literal text from `$ARGUMENTS`:

```
node "C:\Users\Owner\.qwen\advisor-runner.js" "<question>"
```

- Chrome will start minimized — the user will not see it
- The script navigates to a temporary ChatGPT chat, submits the question, waits for the full response, and prints it to stdout
- Capture stdout as `ADVISOR_RESPONSE`
- If the command exits with a non-zero code, capture stderr and report the error to the user

---

### 3. Present the response

Display the result:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ChatGPT says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ADVISOR_RESPONSE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Return the response verbatim. Do not summarise or add commentary.

---

## Error handling

| Error | Action |
|-------|--------|
| "Could not find ChatGPT input" | Tell user to run `/advisor.setup` again to re-authenticate |
| "No response received" | Tell user to retry — ChatGPT may have been slow |
| Script times out (>90s) | Report timeout, suggest retrying |
| Any other stderr output | Show the error message verbatim |
