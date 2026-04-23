---
description: One-time onboarding for /advisor. Logs into ChatGPT in the advisor's dedicated Chrome profile and injects advisor guidance into QWEN.md. Run once before using /advisor.
handoffs:
  - label: Start advising
    agent: advisor
    prompt: I am ready to use the advisor.
---

## Goal

Set up the ChatGPT advisor session. Uses a dedicated Chrome profile (`advisor-profile`) separate from the main browser — so the advisor never conflicts with other browser activity.

## Steps

### 1. Check if already set up

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-ready` exists.

- **If the file exists**: Respond with:
  > "Advisor is already set up. Run `/advisor <your question>` to consult ChatGPT."
  Then stop.
- **If it does not exist**: Continue.

---

### 2. Verify the runner script exists

Use `filesystem.read_file` to check if `C:\Users\Owner\.qwen\advisor-runner.js` exists.

- **If it does not exist**: Respond with:
  > "The advisor runner script is missing. Please re-install the advisor plugin files."
  Then stop.

---

### 3. Navigate to ChatGPT

Use the browser tool to navigate to `https://chatgpt.com`.

Take a snapshot of the page.

---

### 4. Detect login state

Inspect the snapshot for "Log in" or "Sign up" text.

#### Not logged in:

Respond with:
> **Advisor Setup — Action Required**
>
> A Chrome window has opened for the advisor (check your Windows taskbar).
>
> To complete setup:
> 1. Click the **Chrome icon in your taskbar** to bring it to the front
> 2. **Log into ChatGPT** with your account
> 3. Once you see the chat interface, come back and run `/advisor.setup` again
>
> This is a one-time step — the session is saved permanently.

Then stop.

#### Logged in:

Continue to Step 5.

---

### 5. Save setup flag

Use `filesystem.write_file` to write `ready` to `C:\Users\Owner\.qwen\advisor-ready`.

---

### 6. Inject advisor guidance into QWEN.md

Use `filesystem.read_file` to read `C:\Users\Owner\.qwen\QWEN.md`.

Search for `## Advisor — ChatGPT Second Opinion` in the content.

- **If found**: Skip this step (already injected).
- **If not found**:
  1. Read `C:\Users\Owner\.qwen\advisor-context.md`
  2. Append its contents to QWEN.md (add a blank line separator before it)
  3. Also append these two rows to the Slash Commands table in QWEN.md:
     ```
     | `/advisor.setup` | One-time ChatGPT login — run before first `/advisor` use |
     | `/advisor <question>` | Get a second opinion from ChatGPT on any decision or blocker |
     ```

---

### 7. Confirm

Respond with:
> **Advisor Setup Complete**
>
> ChatGPT is logged in and the advisor profile is saved. Chrome will run minimized in the background during advisor calls — you won't see it.
>
> Run `/advisor <your question>` to consult ChatGPT at any time.
