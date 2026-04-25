'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

// The installer drops this script INSIDE the host directory
// (e.g. ~/.qwen/, ~/.claude/, ~/.codex/), so __dirname IS the host dir.
// No source-rewriting or path substitution needed — works on every OS.
// Override via env var if running the file from elsewhere.
const HOST_DIR = process.env.ADVISOR_HOST_DIR || __dirname;

const SHARED_PROFILE = path.join(HOST_DIR, 'playwright-profile');
const RESPONSE_FILE  = path.join(HOST_DIR, 'advisor-last-response.md');
const OPENROUTER_CFG = path.join(HOST_DIR, 'advisor-openrouter.json');
const TIMEOUT_MS = 90000;

// ─────────────────────────────────────────────────────────────────────
// Playwright resolution (lazy — only when a web advisor is used)
// ─────────────────────────────────────────────────────────────────────

function loadChromium() {
  try { return require('playwright-core').chromium; } catch { /* fall through */ }
  const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const candidate = path.join(npmRoot, '@playwright/mcp/node_modules/playwright-core');
  if (fs.existsSync(path.join(candidate, 'package.json'))) {
    return require(candidate).chromium;
  }
  throw new Error(
    'Could not find playwright-core. Install @playwright/mcp globally: npm install -g @playwright/mcp'
  );
}

// ─────────────────────────────────────────────────────────────────────
// Advisor definitions
// ─────────────────────────────────────────────────────────────────────

const ADVISORS = {
  chatgpt: {
    displayName: 'ChatGPT',
    type: 'web',
    url: 'https://chatgpt.com/?temporary-chat=true',
    inputSelectors: [
      '#prompt-textarea',
      '[data-id="prompt-textarea"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
    ],
    stopSelector: '[data-testid="stop-button"], button[aria-label*="Stop"]',
    responseSelectors: ['[data-message-author-role="assistant"]'],
  },
  claude: {
    displayName: 'Claude',
    type: 'web',
    url: 'https://claude.ai/new',
    inputSelectors: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    stopSelector: 'button[aria-label="Stop Response"], button[aria-label*="Stop"], [data-testid*="stop"]',
    responseSelectors: [
      '.font-claude-message',
      '[data-testid="conversation-turn-content"]',
      '[class*="message"] [class*="prose"]',
      'article',
    ],
  },
  kimi: {
    displayName: 'Kimi',
    type: 'web',
    url: 'https://www.kimi.com/',
    inputSelectors: [
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    stopSelector: '[class*="stop"], button[aria-label*="Stop"], [data-testid*="stop"]',
    responseSelectors: [
      '[class*="segment-content"]',
      '[class*="message-content"]',
      '[class*="answer-text"]',
      '[class*="chat-message"]',
    ],
  },
  qwen: {
    displayName: 'Qwen',
    type: 'web',
    url: 'https://chat.qwen.ai/',
    inputSelectors: ['textarea', 'div[contenteditable="true"]'],
    stopSelector: '[class*="stop"], button[aria-label*="Stop"], [data-testid*="stop"]',
    responseSelectors: [
      '[class*="markdown-body"]',
      '[class*="message-content"]',
      '[data-role="assistant"]',
      '[class*="assistant"] [class*="content"]',
    ],
  },

  // CLI-based advisors — argv arrays (no shell, no quoting bugs)
  'claude-code': {
    displayName: 'Claude Code',
    type: 'cli',
    bin: 'claude',
    buildArgs: (q) => ['-p', q, '--dangerously-skip-permissions'],
  },
  codex: {
    displayName: 'Codex CLI',
    type: 'cli',
    bin: 'codex',
    buildArgs: (q) => ['exec', '--skip-git-repo-check', q],
  },
  gemini: {
    displayName: 'Gemini CLI',
    type: 'cli',
    bin: 'gemini',
    buildArgs: (q) => ['-p', q, '--skip-trust', '--approval-mode', 'yolo'],
  },

  // HTTP advisors — OpenAI-compatible endpoints
  openrouter: {
    displayName: 'OpenRouter',
    type: 'http',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openai/gpt-4o-mini',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    configFile: OPENROUTER_CFG,
  },
};

// ─────────────────────────────────────────────────────────────────────
// CLI entry
// ─────────────────────────────────────────────────────────────────────

const advisorName = process.argv[2];
const question = process.argv.slice(3).join(' ').trim();

if (!advisorName || !ADVISORS[advisorName]) {
  const names = Object.keys(ADVISORS).join(', ');
  process.stderr.write(`Usage: node advisor-runner.js <advisor> <question>\nAvailable advisors: ${names}\n`);
  process.exit(1);
}
if (!question) {
  process.stderr.write(`Usage: node advisor-runner.js ${advisorName} <question>\n`);
  process.exit(1);
}

const config = ADVISORS[advisorName];

// ─────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────

function emitResponse(response) {
  fs.writeFileSync(RESPONSE_FILE, response, 'utf8');
  const PREVIEW_LEN = 200;
  const preview = response.length > PREVIEW_LEN
    ? response.slice(0, PREVIEW_LEN).trimEnd() + '…'
    : response;
  process.stdout.write(
    `✓ ${config.displayName} responded (${response.length} chars)\n\n` +
    `Preview: ${preview}\n\n` +
    `Full response saved to: ${RESPONSE_FILE}\n`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Runners by type
// ─────────────────────────────────────────────────────────────────────

function runCli() {
  const args = config.buildArgs(question);
  // On Windows, npm-installed CLIs are .cmd shims that need shell=true.
  // shell=true with arg array is safe — Node passes args to cmd.exe via /d /s /c
  // and handles quoting (so questions with quotes/spaces still work).
  const result = spawnSync(config.bin, args, {
    cwd: process.env.ADVISOR_WORK_DIR || process.env.QWEN_WORK_DIR || process.cwd(),
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write(`ERROR: ${config.bin} is not installed or not on PATH.\n`);
      process.exit(1);
    }
    process.stderr.write(`ERROR: ${config.displayName} failed — ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`ERROR: ${config.displayName} exited ${result.status} — ${(result.stderr || result.stdout || '').trim()}\n`);
    process.exit(1);
  }
  const response = (result.stdout || '').trim();
  if (!response) {
    process.stderr.write(`ERROR: No response received from ${config.displayName}.\n`);
    process.exit(1);
  }
  emitResponse(response);
}

async function runHttp() {
  let apiKey = process.env[config.apiKeyEnv];
  let model = process.env.OPENROUTER_MODEL || config.defaultModel;

  if (fs.existsSync(config.configFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(config.configFile, 'utf8'));
      apiKey = apiKey || cfg.apiKey;
      model = cfg.model || model;
    } catch { /* ignore malformed file */ }
  }

  if (!apiKey) {
    process.stderr.write(
      `ERROR: ${config.displayName} requires an API key. ` +
      `Set ${config.apiKeyEnv} env var or write ` +
      `${config.configFile} with {"apiKey":"...","model":"..."}.\n`
    );
    process.exit(1);
  }

  let res;
  try {
    res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: question }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    process.stderr.write(`ERROR: ${config.displayName} request failed — ${e.message}\n`);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    process.stderr.write(`ERROR: ${config.displayName} HTTP ${res.status} — ${body.slice(0, 300)}\n`);
    process.exit(1);
  }

  const data = await res.json();
  const response = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!response) {
    process.stderr.write(`ERROR: Empty response from ${config.displayName} (model ${model}).\n`);
    process.exit(1);
  }
  emitResponse(response);
}

async function runWeb() {
  const chromium = loadChromium();
  const context = await chromium.launchPersistentContext(SHARED_PROFILE, {
    channel: 'chrome',
    headless: false,
    args: ['--start-minimized'],
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let inputEl = null;
    for (const sel of config.inputSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        inputEl = page.locator(sel).first();
        break;
      } catch { /* try next */ }
    }
    if (!inputEl) {
      process.stderr.write(
        `ERROR: Could not find ${config.displayName} input. ` +
        `Run /advisor.select ${advisorName} then /advisor.setup to re-authenticate.\n`
      );
      process.exit(1);
    }

    await inputEl.click();
    const tagName = await inputEl.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'textarea') await inputEl.fill(question);
    else await inputEl.type(question);
    await page.keyboard.press('Enter');

    await page.waitForSelector(config.stopSelector, { timeout: 15000 }).catch(() => {});
    await page.waitForSelector(config.stopSelector, { state: 'hidden', timeout: TIMEOUT_MS }).catch(() => {});
    await page.waitForTimeout(800);

    let text = null;
    for (const sel of config.responseSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      if (count > 0) {
        text = await els.nth(count - 1).innerText();
        break;
      }
    }
    if (!text) {
      process.stderr.write(`ERROR: No response received from ${config.displayName}.\n`);
      process.exit(1);
    }
    emitResponse(text.trim());
  } finally {
    await context.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────

(async () => {
  if (config.type === 'cli')  return runCli();
  if (config.type === 'http') return runHttp();
  return runWeb();
})().catch(err => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
