---
description: One-time setup for the active advisor. Verifies config is correct. Run /advisor.select first.
---

## Goal

Verify the currently-selected advisor is configured correctly and mark it as ready.

## Steps

### 1. Read active advisor

Read `{HOST_DIR}advisor-active` and trim whitespace.

- **If missing or empty:** respond:
  > "No advisor selected. Run `/advisor.select` first to choose one."

  Then stop.

Let `ADVISOR_ID` = the file contents (trimmed).

---

### 2. Check if already set up

Check if `{HOST_DIR}advisor-ready-{ADVISOR_ID}` exists.

- **If it exists:** respond:
  > "**{ADVISOR_ID}** is already set up. Run `/advisor <question>` to start."

  Then stop.

---

### 3. Look up advisor config

Read `{HOST_DIR}../settings.json` (or `~/.qwen/settings.json`) and find the advisor entry matching `ADVISOR_ID` in the `advisors` array.

- **If not found:** respond:
  > "Unknown advisor '{ADVISOR_ID}'. Available: {list of ids from settings.json}"

  Then stop.

Let `ADVISOR_TYPE` = the advisor's `type` field (model, http, or cli).

---

### 4. Verify config by type

**model:** Check that `modelProviders` contains an entry matching `advisor.id`. If found, proceed to step 5.

**http:** Check that `envKey` has a corresponding key in `settings.json.env`. If the key is missing or empty, respond:
  > "API key missing. Set {envKey} in settings.json.env"

**cli:** Check that the `bin` field (e.g. "claude") is installed on PATH. Run `Bash(where <bin>)` or `Bash(command -v <bin>)`. If not found, respond with install instructions.

---

### 5. Save setup flag

Write `ready` to `{HOST_DIR}advisor-ready-{ADVISOR_ID}`.

---

### 6. Confirm

Respond:

> **{ADVISOR_ID}** is ready.
> Run `/advisor <question>` to start.