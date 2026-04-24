---
description: One-time login for the active advisor. Reads which advisor is selected, opens its login page in Chrome, and saves the session permanently. Run /advisor.select first.
handoffs:
  - label: Start advising
    agent: advisor
    prompt: I am ready to use the advisor.
---

## Goal

Authenticate the currently-selected advisor and mark it as ready for use.

## Advisor URLs

| Name | URL | Login indicator |
|------|-----|----------------|
| chatgpt | https://chatgpt.com | "Log in" or "Sign up" |
| claude | https://claude.ai | "Sign in" or "Log in" |
| kimi | https://www.kimi.com | "Log in" or "Sign in" |
| qwen | https://chat.qwen.ai | "Log in" or "Sign up" |

## Steps

### 1. Read active advisor

Use `filesystem.read_file` to read `C:\Users\Owner\.qwen\advisor-active`.

- **If the file is missing or empty:** respond:
  > "No advisor selected. Run `/advisor.select` first to choose one."

  Then stop.

Let `ADVISOR_NAME` = the file contents (trimmed, lowercase). Let `ADVISOR_URL` = the URL from the table above.

---

### 2. Check if already set up

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-ready-<ADVISOR_NAME>` exists.

- **If it exists:** respond:
  > "**\<ADVISOR_NAME\>** is already set up. Run `/advisor <question>` to start."

  Then stop.

---

### 3. Verify runner script

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-runner.js` exists.

- **If missing:** respond:
  > "The advisor runner script is missing. Copy `advisor-runner.js` to `C:\Users\Owner\.qwen\`."

  Then stop.

---

### 4. Navigate to advisor login page

Use the browser tool to navigate to `ADVISOR_URL`.

Take a snapshot of the page.

---

### 5. Detect login state

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

#### Logged in — continue to Step 6.

---

### 6. Save setup flag

Use `filesystem.write_file` to write `ready` to:

```
C:\Users\Owner\.qwen\advisor-ready-<ADVISOR_NAME>
```

---

### 7. Inject advisor guidance into QWEN.md (first setup only)

Use `filesystem.read_file` to read `C:\Users\Owner\.qwen\QWEN.md`.

Search for `## Advisor` in the content.

- **If found:** skip this step (already injected).
- **If not found:**
  1. Read `C:\Users\Owner\.qwen\advisor-context.md`
  2. Append its contents to QWEN.md with a blank line separator before it
  3. Also append these rows to the Slash Commands table in QWEN.md:
     ```
     | `/advisor.select` | Choose your active AI advisor (ChatGPT, Claude, Kimi, Qwen) |
     | `/advisor.setup` | One-time login for the selected advisor |
     | `/advisor <question>` | Get a second opinion from your active advisor |
     ```

---

### 8. Confirm

Respond:

> **\<ADVISOR_NAME\> Setup Complete**
>
> \<ADVISOR_NAME\> is logged in and the session is saved. Chrome will open minimized during advisor calls.
>
> Run `/advisor <your question>` to start.
