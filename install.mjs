#!/usr/bin/env node
/**
 * Qwen CLI Advisor — Installer
 * https://github.com/mohitsoni48/qwen-cli-advisor
 *
 * Sets up:
 *   - 9 MCP servers in ~/.qwen/settings.json
 *   - /advisor, /advisor.select, /advisor.setup commands
 *   - advisor-runner.js + advisor-context.md in ~/.qwen/
 *   - QWEN.md (creates from template or AI-merges with existing)
 *
 * Requires Node.js 18+
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const QWEN_DIR = join(HOME, '.qwen');
const COMMANDS_DIR = join(QWEN_DIR, 'commands');
const IS_WIN = platform() === 'win32';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, silent = false) {
  return execSync(cmd, {
    stdio: silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
  }).trim();
}

function tryRun(cmd) {
  try { return run(cmd, true); } catch { return null; }
}

const log = (msg = '') => process.stdout.write(msg + '\n');
const ok   = (msg)    => log(`  ✓ ${msg}`);
const warn = (msg)    => log(`  ⚠ ${msg}`);
const fail = (msg)    => log(`  ✗ ${msg}`);

async function ask(question, defaultVal = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve =>
    rl.question(
      `  ${question}${defaultVal ? ` [${defaultVal}]` : ''}: `,
      answer => { rl.close(); resolve(answer.trim() || defaultVal); }
    )
  );
}

// ---------------------------------------------------------------------------
// MCP package definitions
// ---------------------------------------------------------------------------

const MCP_PACKAGES = [
  { pkg: '@modelcontextprotocol/server-filesystem',      entry: 'dist/index.js'      },
  { pkg: '@modelcontextprotocol/server-sequential-thinking', entry: 'dist/index.js'  },
  { pkg: '@modelcontextprotocol/server-memory',          entry: 'dist/index.js'      },
  { pkg: '@upstash/context7-mcp',                        entry: 'dist/index.js'      },
  { pkg: 'tavily-mcp',                                   entry: 'build/index.js'     },
  { pkg: '@playwright/mcp',                              entry: 'cli.js'             },
  { pkg: 'mcp-sqlite',                                   entry: 'mcp-sqlite-server.js' },
  { pkg: 'github-mcp-server',                            entry: 'dist/index.js'      },
  { pkg: 'mcp-server-code-runner',                       entry: 'dist/cli.js'        },
];

// ---------------------------------------------------------------------------
// AI merge
// ---------------------------------------------------------------------------

async function aiMerge(existing, template, endpoint, model, apiKey) {
  const base = endpoint.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a technical editor. Merge two QWEN.md files into one coherent document. ' +
            'Preserve all content from both files. When sections overlap, combine them logically. ' +
            'If an advisor section already exists, keep it as-is rather than duplicating. ' +
            'Return only the merged Markdown — no explanation, no code fence.',
        },
        {
          role: 'user',
          content:
            `EXISTING QWEN.md:\n\`\`\`\n${existing}\n\`\`\`\n\n` +
            `ADVISOR TEMPLATE (add any missing sections from this):\n\`\`\`\n${template}\n\`\`\`\n\n` +
            `Return the merged QWEN.md:`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty response from AI');
  return content;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log();
  log('Qwen CLI Advisor — Installer');
  log('============================');
  log();

  // ── 1. Node version ──────────────────────────────────────────────────────
  log('Checking prerequisites...');

  const [major] = process.version.slice(1).split('.').map(Number);
  if (major < 18) {
    fail(`Node.js 18+ required (found ${process.version})`);
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);

  // ── 2. npm global root ───────────────────────────────────────────────────
  const npmRoot = tryRun('npm root -g');
  if (!npmRoot) {
    fail('Could not determine npm global root. Is npm installed?');
    process.exit(1);
  }
  ok(`npm root: ${npmRoot}`);
  log();

  // ── 3. Optional API keys ─────────────────────────────────────────────────
  log('Configuration (press Enter to skip optional items)...');
  log();

  const tavilyKey  = await ask('Tavily API key  (web-search MCP — get one free at tavily.com)', '');
  const githubToken = await ask('GitHub token    (github MCP — needed for private repos)', '');
  log();

  // ── 4. Install npm packages ──────────────────────────────────────────────
  log('Installing MCP packages...');

  for (const { pkg } of MCP_PACKAGES) {
    const pkgDir = join(npmRoot, ...pkg.split('/'));
    if (existsSync(pkgDir)) {
      ok(`${pkg} (already installed)`);
    } else {
      process.stdout.write(`  installing ${pkg}...`);
      try {
        run(`npm install -g ${pkg}`, true);
        log(' ✓');
      } catch (e) {
        log(' ✗');
        warn(`Failed: ${e.message?.split('\n')[0] ?? e}`);
      }
    }
  }
  log();

  // ── 5. Create directory structure ─────────────────────────────────────────
  log('Setting up ~/.qwen/...');
  for (const dir of [QWEN_DIR, COMMANDS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  ok('directory structure');

  // ── 6. Copy command files ─────────────────────────────────────────────────
  // Commands use dynamic path resolution ({QWEN_DIR} placeholder) — no patching needed.
  for (const file of ['advisor.md', 'advisor.select.md', 'advisor.setup.md']) {
    const src = join(__dirname, 'commands', file);
    copyFileSync(src, join(COMMANDS_DIR, file));
    ok(`commands/${file}`);
  }

  // ── 7. Copy support files ─────────────────────────────────────────────────
  for (const file of ['advisor-runner.js', 'advisor-context.md']) {
    copyFileSync(join(__dirname, file), join(QWEN_DIR, file));
    ok(file);
  }
  log();

  // ── 8. Merge settings.json ────────────────────────────────────────────────
  log('Updating ~/.qwen/settings.json...');

  const settingsPath = join(QWEN_DIR, 'settings.json');
  let settings = {};

  if (existsSync(settingsPath)) {
    const bak = settingsPath + `.bak-${new Date().toISOString().slice(0, 10)}`;
    copyFileSync(settingsPath, bak);
    ok(`backed up to ${bak}`);
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch { /* start fresh */ }
  }

  if (!settings.mcpServers) settings.mcpServers = {};
  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

  function nodeServer(relPath, extraArgs = [], env = {}) {
    const cfg = {
      command: 'node',
      args: [join(npmRoot, ...relPath.split('/')), ...extraArgs],
      trust: true,
    };
    if (Object.keys(env).length) cfg.env = env;
    return cfg;
  }

  const mcpDefs = {
    'filesystem': nodeServer(
      '@modelcontextprotocol/server-filesystem/dist/index.js',
      [HOME, QWEN_DIR]
    ),
    'sequential-thinking': nodeServer(
      '@modelcontextprotocol/server-sequential-thinking/dist/index.js'
    ),
    'memory': nodeServer(
      '@modelcontextprotocol/server-memory/dist/index.js',
      [],
      { MEMORY_FILE_PATH: join(QWEN_DIR, 'memory-graph.json') }
    ),
    'context7': nodeServer('@upstash/context7-mcp/dist/index.js'),
    'web-search': nodeServer(
      'tavily-mcp/build/index.js',
      [],
      { TAVILY_API_KEY: tavilyKey || 'YOUR_TAVILY_API_KEY_HERE' }
    ),
    'browser': nodeServer(
      '@playwright/mcp/cli.js',
      ['--browser', 'chrome', '--user-data-dir', join(QWEN_DIR, 'playwright-profile')]
    ),
    'sqlite': nodeServer('mcp-sqlite/mcp-sqlite-server.js'),
    'github': nodeServer(
      'github-mcp-server/dist/index.js',
      [],
      githubToken ? { GITHUB_PERSONAL_ACCESS_TOKEN: githubToken } : {}
    ),
    'code-runner': nodeServer('mcp-server-code-runner/dist/cli.js'),
  };

  let added = 0;
  for (const [key, cfg] of Object.entries(mcpDefs)) {
    if (!settings.mcpServers[key]) {
      settings.mcpServers[key] = cfg;
      added++;
    }
  }
  ok(`${added} MCP server(s) added, ${Object.keys(mcpDefs).length - added} already present`);

  const neededPerms = ['Bash(node *)', 'Bash(git *)'];
  let permAdded = 0;
  for (const p of neededPerms) {
    if (!settings.permissions.allow.includes(p)) {
      settings.permissions.allow.push(p);
      permAdded++;
    }
  }
  if (permAdded) ok(`${permAdded} permission(s) added`);

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  ok('settings.json saved');
  log();

  // ── 9. QWEN.md ────────────────────────────────────────────────────────────
  log('Setting up QWEN.md...');

  const qwenMdPath  = join(QWEN_DIR, 'QWEN.md');
  const templateRaw = readFileSync(join(__dirname, 'templates', 'QWEN.md'), 'utf8');

  if (!existsSync(qwenMdPath)) {
    writeFileSync(qwenMdPath, templateRaw);
    ok('QWEN.md written from template');
  } else {
    log('  Existing QWEN.md found — merging with advisor template using AI...');
    const existing = readFileSync(qwenMdPath, 'utf8');

    const endpoint = await ask('AI endpoint (OpenAI-compatible)', 'http://localhost:1234/v1');
    const model    = await ask('Model name', 'auto');
    const apiKey   = await ask('API key (press Enter if none required)', 'sk-none');

    try {
      const merged = await aiMerge(existing, templateRaw, endpoint, model, apiKey);
      writeFileSync(qwenMdPath, merged);
      ok('QWEN.md merged successfully');
    } catch (e) {
      warn(`AI merge failed: ${e.message}`);
      warn('Falling back to appending advisor section...');
      const advisorCtx = readFileSync(join(__dirname, 'advisor-context.md'), 'utf8');
      if (!existing.includes('## Advisor')) {
        writeFileSync(qwenMdPath, existing + '\n\n---\n\n' + advisorCtx);
        ok('Advisor section appended to QWEN.md');
      } else {
        ok('Advisor section already present — no changes needed');
      }
    }
  }

  // ── 10. Register extension ────────────────────────────────────────────────
  log('Registering advisor extension...');
  try {
    run('qwen extensions install .', true);
    ok('advisor extension registered');
  } catch {
    warn('Could not auto-register extension (qwen CLI not found or already registered).');
    warn('Run manually: qwen extensions install .');
  }

  log();
  log('Installation complete!');
  log();
  log('Next steps:');
  log('  1. Edit ~/.qwen/QWEN.md to describe your project (see "Your Projects" section)');
  if (!tavilyKey) {
    log('  2. Add your Tavily key to web-search in ~/.qwen/settings.json');
    log('     (sign up free at https://tavily.com, then set TAVILY_API_KEY)');
  }
  log('  3. Restart Qwen CLI');
  log('  4. /advisor.select chatgpt   ← choose advisor: chatgpt, claude, kimi, qwen');
  log('  5. /advisor.setup            ← one-time login (opens Chrome)');
  log('  6. /advisor <your question>  ← ready');
  log();
}

main().catch(e => {
  log();
  fail(`Installation failed: ${e.message}`);
  process.exit(1);
});
