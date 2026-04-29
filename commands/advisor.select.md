---
description: Select which advisor to use. Plain script — reads input, writes advisor-active.
---

## Goal

Write the selected advisor id to `{HOST_DIR}advisor-active`.

## Steps

### 1. Read available advisors

Read `{HOST_DIR}settings.json` (or `~/.qwen/settings.json`). Parse the `advisors` array.

### 2. Parse input

If `$ARGUMENTS` is empty, list the available advisors and ask the user to run `/advisor.select <id>`.

If `$ARGUMENTS` is provided, trim it and use as the advisor id.

### 3. Validate

Check if the advisor id exists in the `advisors` array. If not, respond:
> "Unknown advisor. Available: {list of ids}"

### 4. Write

Write the advisor id to `{HOST_DIR}advisor-active`.

### 5. Confirm

Respond:
> ✓ **{advisor name}** is now your active advisor.
> Run `/advisor <your question>` to start.