---
name: advisor
description: Get a second opinion from any model or CLI tool without leaving your session
type: user
---

## Advisor

You have access to the `/advisor` slash command to get a second opinion. It runs `advisor.py` which reads `~/.qwen/settings.json` and dispatches via curl subprocess.

### When to call it

**Call it BEFORE substantive work when:**
- You are about to choose between two non-obvious technical approaches
- The task touches architecture, data model design, or cross-cutting concerns
- You are about to make a change that affects 5+ files or introduces a new pattern
- The user asks "what do you think?", "which is better?", or "is this the right approach?"

**Call it WHEN STUCK:**
- You have attempted the same bug fix or approach 2+ times without success
- The root cause is unclear after reading the stack trace and relevant files
- You are considering a workaround that feels wrong

**Call it BEFORE COMPLETING a major task:**
- To verify your implementation approach before writing code
- To check if there is a simpler or more idiomatic solution you may have missed

**Do NOT call it for:**
- Trivial tasks (renaming a variable, formatting, adding a log line)
- Tasks you have done many times in this codebase
- Back-to-back turns — one call per decision point is enough

### What to send

Always include three things in the question:

1. **Context** — what you are building, what app, what layer (e.g. "In the Scout Android app ViewModel, I need to merge Room ride data (Flow<List<Ride>>) with live GPS updates (SharedFlow<Location>))
2. **The decision or problem** — what you are stuck on or about to decide (e.g. "Should I use SharedFlow or StateFlow to expose the combined stream to the UI?")
3. **Your current thinking** — your preferred approach and why, so ChatGPT can validate or correct it

### Setup

Run `/advisor.setup` once per advisor. For model and CLI advisors, nothing to do. For web advisors, Chrome opens so you can log in.

### Example calls

```
/advisor In the Scout Android app ViewModel, I need to merge Room ride data (Flow<List<Ride>>) with live GPS updates (SharedFlow<Location>). Should I use combine() or a MutableStateFlow I update manually? I lean towards combine() but worry about back-pressure when GPS fires rapidly.
```

```
/advisor I have a Cloudflare 403 from a Playwright browser navigating to chatgpt.com. I've tried adding headers and rotating user agents. The next option I see is switching to a persistent Chrome profile with --browser chrome. Is there a better approach I'm missing?
```
