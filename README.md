# Open-Advisor

> Open-source `/advisor` slash command for any AI CLI — consult models or CLI tools without leaving your session.

Runs as a plugin inside **Qwen Code**. Pick your advisor from the `advisors` array in `~/.qwen/settings.json`.

```
/advisor.select nvidia-deepseek
/advisor Should I use StateFlow or SharedFlow for this ViewModel?
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MiniMax M2.7 (NVIDIA) says:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ MiniMax M2.7 (NVIDIA) responded (1247 chars)

Preview: Use StateFlow when the UI always needs the latest value (e.g. screen state).
Use SharedFlow for events that should be consumed once (e.g. navigation, toasts)…

Full response saved to: ~/.qwen/advisor/advisor-last-response.md

Say "show advisor response" to load the full reply.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## How it works

- **3 advisor types**, pure Python runner — no Node.js, no browser, no AI interpretation:
  - **model** — calls `modelProviders` from `settings.json` via curl subprocess (OpenAI-compatible API)
  - **cli** — runs a local CLI tool (`claude`, `gemini`, etc.) via child process
  - **http** — direct HTTP call to any OpenAI-compatible endpoint via curl subprocess
- Switch any time with `/advisor.select`
- Every response is saved to `<host-dir>/advisor-last-response.md`; only a 200-char preview is shown inline

---

## Prerequisites

- Python 3.10+
- Qwen Code (the host CLI)
- One of the advisor services (NVIDIA API, OpenRouter, local CLI tools, etc.)

Verified on Windows 11; should work on macOS and Linux.

### Optional CLI advisor tools

Only needed if you want to *consult* one of these as your advisor:

| Advisor | Install command | Auth |
|---------|----------------|------|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | Anthropic subscription |
| Gemini CLI | `npm i -g @google/gemini-cli` | Google account |

---

## Installation

```bash
git clone https://github.com/mohitsoni48/open-advisor.git
cd open-advisor

node install.mjs --ai <host>
```

`<host>` is one of:

| `--ai` | Install dir | Commands subdir | Context file |
|--------|-------------|-----------------|--------------|
| `qwen` | `~/.qwen/advisor/` | `commands/` | `QWEN.md` |
| `all` | every host above | — | — |

For each selected host the installer:
- Renders and copies `/advisor`, `/advisor.select`, `/advisor.setup` into the host's commands subdir
- Copies `advisor.py` and `advisor-active` into the host dir
- Writes the host's context file from the template, or appends an `## Advisor` section if one already exists

The runner derives its host dir from `~/.qwen/advisor/` at runtime — no path strings baked into source.

---

## Configuration

Edit `~/.qwen/settings.json` — the `advisors` array defines all available advisors:

```json
{
  "advisors": [
    {
      "id": "nvidia-deepseek",
      "name": "MiniMax M2.7 (NVIDIA)",
      "type": "http",
      "baseUrl": "https://integrate.api.nvidia.com/v1",
      "envKey": "NVAPI_KEY",
      "model": "minimaxai/minimax-m2.7",
      "generationConfig": {
        "temperature": 0.7,
        "top_p": 0.95,
        "max_tokens": 16384
      }
    },
    {
      "id": "claude-code",
      "name": "Claude Code",
      "type": "cli",
      "bin": "claude",
      "args": ["-p", "{{QUESTION}}", "--dangerously-skip-permissions"]
    },
    {
      "id": "qwen3.6-35b-a3b",
      "name": "Qwen 3.6 35B MoE",
      "type": "model"
    }
  ],
  "env": {
    "NVAPI_KEY": "nvapi-<your-key>",
    "LM_KEY": "sk-lm-<your-key>"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "qwen3.6-35b-a3b@?",
        "baseUrl": "http://localhost:1234/v1/",
        "envKey": "LM_KEY"
      }
    ]
  }
}
```

### Advisor types

| Type | How it works | Config fields |
|------|-------------|---------------|
| `model` | Calls `modelProviders` entry matching `id` via curl | `id` |
| `http` | Direct HTTP POST to any OpenAI-compatible endpoint | `baseUrl`, `envKey`, `model`, `generationConfig` |
| `cli` | Runs a local CLI tool as a child process | `bin`, `args` (supports `{{QUESTION}}` placeholder) |

---

## Usage

```
/advisor.select <name>
/advisor <your question>
```

**Examples:**

```
/advisor.select nvidia-deepseek

/advisor In my Android ViewModel I need to combine a Room Flow with a SharedFlow from a Service. Should I use combine() or collectLatest?

/advisor Is it better to use a single Activity with multiple Fragments or multiple Activities for this flow?
```

Type **"show advisor response"** afterward to load the full reply into the chat.

---

## Files installed per host

| Path (relative to host dir) | Purpose |
|---|---|
| `commands/advisor.md` | The `/advisor` slash command |
| `commands/advisor.select.md` | The `/advisor.select` slash command |
| `commands/advisor.setup.md` | The `/advisor.setup` slash command |
| `advisor.py` | Pure Python runner — dispatches model/cli/http |
| `advisor-active` | Plain-text file: name of the currently-selected advisor |
| `advisor-last-response.md` | Full text of the most recent response (rewritten each call) |
| `advisor-context.md` | Advisor guidance appended to the host's context file |

---

## Known limitations

- **Python HTTP libraries hang on Windows** — the runner uses `curl` subprocess instead of urllib/httpx/openai SDK
- **CLI advisors**: Run synchronously with a 180-second timeout. On Windows the runner uses `shell: true` for npm shims.
- **HTTP advisors**: Requires network + a valid API key. The runner does not stream.

---

## License

[MIT](LICENSE)
