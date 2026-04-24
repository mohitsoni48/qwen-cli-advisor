## Advisor — AI Second Opinion

You have access to `/advisor <question>` — a second AI running silently in the background (ChatGPT, Claude, Kimi, or Qwen — whichever you selected). Use it the same way a senior engineer consults a colleague: before committing to a risky approach, when stuck, or when a decision has non-obvious trade-offs.

### When to call `/advisor`

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

1. **Context** — what you are building, what app, what layer (e.g. "In the Scout Android app, I am implementing a ViewModel that fetches ride history from Room and live GPS from a Service")
2. **The decision or problem** — what you are stuck on or about to decide (e.g. "Should I use SharedFlow or StateFlow to expose the combined stream to the UI?")
3. **Your current thinking** — your preferred approach and why, so the advisor can validate or correct it

**Example calls:**
```
/advisor In the Scout Android app ViewModel, I need to merge Room ride data (Flow<List<Ride>>) with live GPS updates (SharedFlow<Location>). Should I use combine() or a MutableStateFlow I update manually? I lean towards combine() but worry about back-pressure when GPS fires rapidly.
```

```
/advisor I have a Cloudflare 403 from a Playwright browser navigating to chatgpt.com. I've tried adding headers and rotating user agents. The next option I see is switching to a persistent Chrome profile with --browser chrome. Is there a better approach I'm missing?
```

### Commands

| Command | Purpose |
|---------|---------|
| `/advisor.select` | Choose your active advisor (chatgpt, claude, kimi, qwen) |
| `/advisor.setup` | One-time login for the selected advisor — run after selecting |
| `/advisor <question>` | Consult the active advisor silently in the background |

### Setup (first time)

1. Run `/advisor.select <name>` to choose your advisor
2. Run `/advisor.setup` — Chrome opens so you can log in
3. Once logged in, run `/advisor.setup` again to confirm
4. Run `/advisor <question>` — Chrome opens minimized and closes when done

To switch advisors later: run `/advisor.select <name>` then `/advisor.setup` if not yet logged in.
