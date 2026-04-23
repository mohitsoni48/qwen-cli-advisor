'use strict';

const path = require('path');
const { chromium } = require(
  'C:/Users/Owner/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core'
);

const USER_DATA_DIR = path.join('C:', 'Users', 'Owner', '.qwen', 'playwright-profile');
const TIMEOUT_MS = 90000;

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  process.stderr.write('Usage: node advisor-runner.js <question>\n');
  process.exit(1);
}

(async () => {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    args: ['--start-minimized'],
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto('https://chatgpt.com/?temporary-chat=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Find input box — try known selectors in order
    const inputSelectors = [
      '#prompt-textarea',
      '[data-id="prompt-textarea"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
    ];

    let inputEl = null;
    for (const sel of inputSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        inputEl = page.locator(sel).first();
        break;
      } catch { /* try next */ }
    }

    if (!inputEl) {
      process.stderr.write('ERROR: Could not find ChatGPT input. Run /advisor.setup to re-authenticate.\n');
      process.exit(1);
    }

    await inputEl.click();

    // Use type() for contenteditable divs, fill() for textarea
    const tagName = await inputEl.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'textarea') {
      await inputEl.fill(question);
    } else {
      await inputEl.type(question);
    }

    await page.keyboard.press('Enter');

    // Wait for response to start (stop button appears)
    const stopSelector = '[data-testid="stop-button"], button[aria-label*="Stop"]';
    await page.waitForSelector(stopSelector, { timeout: 15000 }).catch(() => {});

    // Wait for response to finish (stop button disappears)
    await page.waitForSelector(stopSelector, { state: 'hidden', timeout: TIMEOUT_MS }).catch(() => {});

    // Small settle delay
    await page.waitForTimeout(800);

    // Extract last assistant message
    const messages = page.locator('[data-message-author-role="assistant"]');
    const count = await messages.count();

    if (count === 0) {
      process.stderr.write('ERROR: No response received from ChatGPT.\n');
      process.exit(1);
    }

    const text = await messages.nth(count - 1).innerText();
    process.stdout.write(text.trim() + '\n');

  } finally {
    await context.close();
  }
})().catch(err => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
