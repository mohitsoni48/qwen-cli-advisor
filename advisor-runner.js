'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Resolve playwright-core from npm global root (same location as @playwright/mcp)
function resolvePlaywrightCore() {
  try { return require.resolve('playwright-core'); } catch { /* fall through */ }
  // Fallback: derive from this file's expected sibling path in the global node_modules tree
  const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const candidate = path.join(npmRoot, '@playwright/mcp/node_modules/playwright-core');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  throw new Error(
    'Could not find playwright-core. Install @playwright/mcp globally: npm install -g @playwright/mcp'
  );
}

const { chromium } = require(resolvePlaywrightCore());

const QWEN_DIR = path.join(os.homedir(), '.qwen');
// All web-based advisors share one profile — setup browser (browser MCP) also uses this
// profile, so logins from /advisor.setup carry through to the runner.
const SHARED_PROFILE = path.join(QWEN_DIR, 'playwright-profile');
const RESPONSE_FILE = path.join(QWEN_DIR, 'advisor-last-response.md');
const TIMEOUT_MS = 90000;

const ADVISORS = {
  chatgpt: {
    displayName: 'ChatGPT',
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
    // /new always starts a fresh conversation
    url: 'https://claude.ai/new',
    inputSelectors: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    stopSelector: [
      'button[aria-label="Stop Response"]',
      'button[aria-label*="Stop"]',
      '[data-testid*="stop"]',
    ].join(', '),
    responseSelectors: [
      '.font-claude-message',
      '[data-testid="conversation-turn-content"]',
      '[class*="message"] [class*="prose"]',
      'article',
    ],
  },
  kimi: {
    displayName: 'Kimi',
    url: 'https://www.kimi.com/',
    inputSelectors: [
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    stopSelector: [
      '[class*="stop"]',
      'button[aria-label*="Stop"]',
      '[data-testid*="stop"]',
    ].join(', '),
    responseSelectors: [
      '[class*="segment-content"]',
      '[class*="message-content"]',
      '[class*="answer-text"]',
      '[class*="chat-message"]',
    ],
  },
  qwen: {
    displayName: 'Qwen',
    url: 'https://chat.qwen.ai/',
    inputSelectors: [
      'textarea',
      'div[contenteditable="true"]',
    ],
    stopSelector: [
      '[class*="stop"]',
      'button[aria-label*="Stop"]',
      '[data-testid*="stop"]',
    ].join(', '),
    responseSelectors: [
      '[class*="markdown-body"]',
      '[class*="message-content"]',
      '[data-role="assistant"]',
      '[class*="assistant"] [class*="content"]',
    ],
  },

  // CLI-based advisors — run locally, no browser needed
  'claude-code': {
    displayName: 'Claude Code',
    type: 'cli',
    buildCmd: (q) => `claude -p "${q}" --dangerously-skip-permissions`,
  },
  codex: {
    displayName: 'Codex CLI',
    type: 'cli',
    buildCmd: (q) => `codex exec --skip-git-repo-check "${q}"`,
  },
  gemini: {
    displayName: 'Gemini CLI',
    type: 'cli',
    // -p takes the prompt immediately; flags go after
    buildCmd: (q) => `gemini -p "${q}" --skip-trust --approval-mode yolo`,
  },
};

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

(async () => {
  // ── CLI-based advisors (no browser) ───────────────────────────────
  if (config.type === 'cli') {
    try {
      const fullCmd = config.buildCmd(question);
      const result = execSync(fullCmd, {
        cwd: process.env.QWEN_WORK_DIR || process.cwd(),
        timeout: TIMEOUT_MS,
        encoding: 'utf8',
      });

      const response = (result || '').trim();

      if (!response) {
        process.stderr.write(`ERROR: No response received from ${config.displayName}.\n`);
        process.exit(1);
      }

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
    } catch (err) {
      const msg = err.stdout ? err.stdout.toString() : err.message;
      process.stderr.write(`ERROR: ${config.displayName} failed — ${msg.trim()}\n`);
      process.exit(1);
    }
    return;
  }

  // ── Browser-based advisors (Playwright) ──────────────────────────
  const context = await chromium.launchPersistentContext(SHARED_PROFILE, {
    channel: 'chrome',
    headless: false,
    args: ['--start-minimized'],
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto(config.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Find the chat input box
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
    if (tagName === 'textarea') {
      await inputEl.fill(question);
    } else {
      await inputEl.type(question);
    }

    await page.keyboard.press('Enter');

    // Wait for response to start (stop button appears), then finish (disappears)
    await page.waitForSelector(config.stopSelector, { timeout: 15000 }).catch(() => {});
    await page.waitForSelector(config.stopSelector, { state: 'hidden', timeout: TIMEOUT_MS }).catch(() => {});

    await page.waitForTimeout(800);

    // Extract the last assistant response
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

    const response = text.trim();

    // Write full response to file — keeps it out of the main chat context.
    fs.writeFileSync(RESPONSE_FILE, response, 'utf8');

    // Output only a brief preview to stdout so the caller can confirm relevance
    // without injecting the full response into the conversation context.
    const PREVIEW_LEN = 200;
    const preview = response.length > PREVIEW_LEN
      ? response.slice(0, PREVIEW_LEN).trimEnd() + '…'
      : response;

    process.stdout.write(
      `✓ ${config.displayName} responded (${response.length} chars)\n\n` +
      `Preview: ${preview}\n\n` +
      `Full response saved to: ${RESPONSE_FILE}\n`
    );

  } finally {
    await context.close();
  }
})().catch(err => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
