# Advisor Plugin — Build Plan

Goal: A Qwen CLI plugin (`/advisor`) that opens ChatGPT in a browser, starts a temporary chat, and uses it as an interactive advisor.

**Status:** Browser MCP is configured and available in Qwen CLI. Plugin file does not exist yet.

---

## Open Issues (tackle in order)

### Issue 0 — Qwen CLI restart required
**Finding:** Qwen CLI must be restarted after changing `settings.json` for the new browser config to take effect. The MCP server process keeps running with the old args until the session ends.

**Resolution:** User restarts Qwen CLI once. All subsequent sessions use the new config automatically.

---

### Issue 1 — Browser login: ephemeral vs. persistent profile
**Question:** Does Qwen's Playwright MCP use a fresh ephemeral browser profile (no cookies) or does it attach to / persist a named profile where the user is already logged into ChatGPT?

**Why it matters:** Ephemeral = ChatGPT login wall + Cloudflare bot detection on every invocation. If ephemeral, we need to either (a) point Playwright at the user's existing Chrome profile, or (b) handle login automation.

**Finding — Test 1:** Qwen defaulted to `web_fetch` (plain HTTP, got 403). `web_fetch` ≠ browser.

**Finding — Test 2:** Playwright browser IS working (real Chromium opened), but hit Cloudflare's "Just a moment..." bot detection challenge. Headless Chromium has a known fingerprint that Cloudflare blocks. Session state unknown — never got past the challenge screen.

**Root cause:** Playwright's default Chromium is identifiable as automation. Cloudflare blocks it before ChatGPT even loads.

**Options to bypass Cloudflare:**
- **(a) CDP attach to existing Chrome** — connect Playwright to the user's already-running Chrome via `--remote-debugging-port=9222`. Real browser fingerprint + existing ChatGPT cookies. Best option if Playwright MCP supports `connectOverCDP`.
- **(b) Stealth mode** — configure Playwright with stealth/anti-detection patches (`playwright-extra` + `puppeteer-extra-plugin-stealth`). Works if the Playwright MCP is a local server we can modify.
- **(c) Persistent user profile** — run Playwright with `--user-data-dir` pointing at a fresh profile, solve the Cloudflare challenge manually once, then cookies + profile fingerprint persist. Simpler than (a) or (b).

**Blocked on:** knowing which Playwright MCP package is configured (to determine what's configurable).

---

### Issue 2 — Browser state persistence across Qwen turns
**Question:** Within a single Qwen session, does the Playwright browser tab stay open between tool calls / turns?

**Why it matters:** "Multi-turn interaction" (the user types a follow-up `/advisor` question and continues the same ChatGPT conversation) only works if the tab survives across invocations. If it doesn't, every call starts a fresh chat.

**Resolution needed:** Quick test — navigate to a URL in one turn, invoke `/advisor` again next turn, check if the tab/URL is still there.

---

### Issue 3 — Interaction mode (pick one)
**Three candidates:**

- **(a) Multi-turn across invocations** — each `/advisor <question>` continues in the same open ChatGPT tab. Depends on Issue 2 being resolved favorably.
- **(b) In-session REPL** — single `/advisor` invocation; Qwen loops asking you for follow-ups, relays each to ChatGPT, until you say `done`. State is self-contained.
- **(c) Standalone script** — the slash command launches a Python/Node script that owns its own Playwright session with a real stdin/stdout loop. Cleanest for true interactive mode; sidesteps MCP state questions entirely.

**Resolution needed:** Owner picks the mode after Issues 1 & 2 are resolved.

---

### Issue 4 — Context injection
**Question:** When sending a question to ChatGPT, should the plugin automatically inject context from the current Qwen task (active file, error message, task description), or only relay what the user explicitly types?

**Options:**
- Explicit only — user types the full question, nothing added
- Auto-inject — plugin prepends current task context (e.g. active file path + contents, current error) before sending
- User-controlled — a flag like `/advisor --context <question>` to opt in

**Resolution needed:** Owner decides preferred UX.

---

### Issue 5 — ChatGPT "Temporary chat" mechanism
**Question:** How to reliably enable temporary chat mode in ChatGPT so conversations don't save to history.

**Known approaches:**
- URL parameter (needs verification: `chatgpt.com/?temporary-chat=true`)
- UI toggle near the chat title (DOM selector subject to change)

**Resolution needed:** Browser test to find the current DOM path for enabling temporary chat. Blocked on Issues 1 & 2.

---

### Issue 6 — Response completion detection
**Question:** ChatGPT streams responses. The plugin needs to know when the full response has arrived before extracting text.

**Approach:** Poll for the disappearance of the "Stop generating" button, or watch for a stable DOM state.

**Resolution needed:** Empirical test once browser access to ChatGPT is confirmed working.

---

## Decision Log

| Issue | Status | Decision |
|-------|--------|----------|
| 1 — Browser profile | **Resolved** | `--browser chrome` + no `--headless` = headed Chrome on Windows. Opens in background (taskbar), not foreground. Persistent profile at `~/.qwen/playwright-profile`. Login required once. |
| 2 — State persistence | **Resolved** | Chrome stays open in background throughout the Qwen session. Tabs persist across turns. |
| 3 — Interaction mode | **Resolved** | Dev mode: runs inline in main session with browser visible. Subagent approach deferred — caused Chrome profile lock conflict. Re-enable once ChatGPT interaction is stable. |
| 4 — Context injection | **Resolved** | Explicit only — user types the question. No auto-inject for now. |
| 5 — Temporary chat DOM | **Resolved** | `?temporary-chat=true` URL param works. Qwen navigates, finds input, submits. |
| 6 — Response completion | **Resolved** | Polling loop (snapshot every 3s, stop button gone = done) works in practice. |
