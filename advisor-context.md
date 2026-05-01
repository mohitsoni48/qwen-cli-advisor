## Advisor — AI Second Opinion

You have access to `/advisor <question>` — a second AI running silently in the background. Use it the same way a senior engineer consults a colleague: before committing to a risky approach, when stuck, or when a decision has non-obvious trade-offs.

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
/advisor In the Scout Android app ViewModel, I need to merge Room ride data (Flow<List<Ride>>) with live GPS updates (SharedFlow<Location>). Should I use combine() or collectLatest?
```

```
/advisor I have a Cloudflare 403 from a Playwright browser navigating to chatgpt.com. I've tried adding headers and rotating user agents. The next option I see is switching to a persistent Chrome profile with --browser chrome. Is there a better approach I'm missing?
```

### Commands

| Command | Purpose |
|---------|---------|
| `/advisor.select` | Choose your active advisor from the configured list |
| `/advisor.setup` | One-time setup for the selected advisor |
| `/advisor <question>` | Consult the active advisor silently in the background |

### Setup (first time)

1. Run `/advisor.select <id>` to choose your advisor
2. Run `/advisor.setup` to verify config
3. Once set up, run `/advisor <question>` to consult
4. Full responses are saved to `~/.qwen/advisor/advisor-last-response.md`

To switch advisors later: run `/advisor.select <name>`.

### Architecture

The advisor runner (`~/.qwen/advisor/advisor.py`) is pure Python. It uses `curl` subprocess to avoid Python HTTP library hangs on Windows. Three advisor types:
- **model** — calls `modelProviders` from settings.json via curl
- **http** — direct HTTP POST to any OpenAI-compatible endpoint via curl
- **cli** — runs a local CLI tool as a child process
