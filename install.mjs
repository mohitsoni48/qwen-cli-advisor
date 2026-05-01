#!/usr/bin/env node
/**
 * Open-Advisor — Installer
 * https://github.com/mohitsoni48/open-advisor
 *
 * Speckit-style multi-host install:
 *   node install.mjs --ai <name>
 *
 * Where <name> is one of: qwen, claude, codex, gemini, opencode, all
 *
 * Each host gets:
 *   - /advisor, /advisor.select, /advisor.setup commands rendered for its dir layout
 *   - advisor.py (pure Python, uses curl subprocess) + advisor-context.md
 *   - Per-host context file: QWEN.md / CLAUDE.md / GEMINI.md / AGENTS.md
 *
 * Optional Qwen-only extras: MCP servers wired into ~/.qwen/settings.json
 * and `qwen extensions install .` registration.
 *
 * Requires Node.js 18+
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();

// ---------------------------------------------------------------------------
// Host registry — speckit-style
// ---------------------------------------------------------------------------

const HOSTS = {
  qwen: {
    label:        'Qwen CLI',
    dir:          join(HOME, '.qwen', 'advisor'),
    commandsDir:  'commands',
    contextFile:  'QWEN.md',
    extInstall:   'qwen extensions install .',
    settingsFile: '../settings.json', // settings.json stays at ~/.qwen/
    // advisor.py and advisor-active live in ~/.qwen/advisor/
    advisorDir:   join(HOME, '.qwen', 'advisor'),
  },
  claude: {
    label:        'Claude Code',
    dir:          join(HOME, '.claude'),
    commandsDir:  'commands',
    contextFile:  'CLAUDE.md',
    extInstall:   null,
    settingsFile: null,
  },
  codex: {
    label:        'Codex CLI',
    dir:          join(HOME, '.codex'),
    commandsDir:  'prompts',
    contextFile:  'AGENTS.md',
    extInstall:   null,
    settingsFile: null,
  },
  gemini: {
    label:        'Gemini CLI',
    dir:          join(HOME, '.gemini'),
    commandsDir:  'commands',
    contextFile:  'GEMINI.md',
    extInstall:   null,
    settingsFile: null,
  },
  opencode: {
    label:        'OpenCode',
    dir:          join(HOME, '.config', 'opencode'),
    commandsDir:  'command',
    contextFile:  'AGENTS.md',
    extInstall:   null,
    settingsFile: null,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, silent = false) {
  return execSync(cmd, { stdio: silent ? 'pipe' : 'inherit', encoding: 'utf8' }).trim();
}
function tryRun(cmd) {
  try { return run(cmd, true); } catch { return null; }
}
const log  = (msg = '') => process.stdout.write(msg + '\n');
const ok   = (msg)      => log(`  ✓ ${msg}`);
const warn = (msg)      => log(`  ⚠ ${msg}`);
const fail = (msg)      => log(`  ✗ ${msg}`);

async function ask(question, defaultVal = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve =>
    rl.question(`  ${question}${defaultVal ? ` [${defaultVal}]` : ''}: `,
      a => { rl.close(); resolve(a.trim() || defaultVal); }));
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ai' || a === '--host')      out.ai      = argv[++i];
    else if (a === '--openrouter-key')        out.orKey   = argv[++i];
    else if (a === '--openrouter-model')      out.orModel = argv[++i];
    else if (a === '--tavily-key')            out.tavily  = argv[++i];
    else if (a === '--github-token')          out.github  = argv[++i];
    else if (a === '-h' || a === '--help')    out.help    = true;
  }
  return out;
}

function showHelp() {
  log(`
Open-Advisor installer

Usage:
  node install.mjs --ai <name> [options]

Hosts (--ai):
  qwen      Install into ~/.qwen/        (Qwen CLI; also wires MCPs)
  claude    Install into ~/.claude/      (Claude Code)
  codex     Install into ~/.codex/       (Codex CLI; commands → prompts/)
  gemini    Install into ~/.gemini/      (Gemini CLI)
  opencode  Install into ~/.config/opencode/
  all       Install into every host above

Optional:
  --openrouter-key <KEY>     Save OpenRouter API key for the openrouter advisor
  --openrouter-model <ID>    e.g. anthropic/claude-3.5-sonnet  (default openai/gpt-4o-mini)
  --tavily-key <KEY>         Tavily API key (Qwen MCP only)
  --github-token <TOKEN>     GitHub token   (Qwen MCP only)
`);
}

// ---------------------------------------------------------------------------
// MCP package definitions (Qwen host only)
// ---------------------------------------------------------------------------

const MCP_PACKAGES = [
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-sequential-thinking',
  '@modelcontextprotocol/server-memory',
  '@upstash/context7-mcp',
  'tavily-mcp',
  '@playwright/mcp',
  'mcp-sqlite',
  'github-mcp-server',
  'mcp-server-code-runner',
];

// ---------------------------------------------------------------------------
// Render templates
// ---------------------------------------------------------------------------

function renderTemplate(content, vars) {
  return content
    .replaceAll('{{HOST_DIR}}', vars.HOST_DIR)
    .replaceAll('{{CONTEXT_FILE}}', vars.CONTEXT_FILE)
    .replaceAll('{HOST_DIR}', vars.HOST_DIR);
}

// ---------------------------------------------------------------------------
// Per-host install
// ---------------------------------------------------------------------------

async function installForHost(hostName, host, opts) {
  log();
  log(`Installing for ${host.label} (${hostName}) → ${host.dir}`);
  log('─'.repeat(48));

  const commandsPath = join(host.dir, host.commandsDir);
  for (const d of [host.dir, commandsPath]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
  ok('directory structure');

  const vars = {
    HOST_DIR:     host.dir + (host.dir.endsWith('/') || host.dir.endsWith('\\') ? '' : '/'),
    CONTEXT_FILE: host.contextFile,
    QWEN_DIR:     join(HOME, '.qwen'),
  };

  for (const file of ['advisor.md', 'advisor.select.md', 'advisor.setup.md']) {
    const src = readFileSync(join(__dirname, 'commands', file), 'utf8');
    writeFileSync(join(commandsPath, file), renderTemplate(src, vars));
    ok(`commands/${file}`);
  }

  // advisor.py — pure Python runner, deployed to host dir
  const pySrc = readFileSync(join(__dirname, 'advisor.py'), 'utf8');
  writeFileSync(join(host.dir, 'advisor.py'), pySrc);
  ok('advisor.py');

  // advisor-active — tracks current advisor id (user must set via /advisor.select)
  ok('advisor-active (create via /advisor.select)');

  // advisor-last-response.md — output file
  ok('advisor-last-response.md (created on first run)');

  // advisor-context.md — context for Qwen
  const ctxSrc = readFileSync(join(__dirname, 'advisor-context.md'), 'utf8');
  writeFileSync(join(host.dir, 'advisor-context.md'), ctxSrc);
  ok('advisor-context.md');

  // Context file (CLAUDE.md / AGENTS.md / GEMINI.md — QWEN.md deployed below)
  const ctxPath = join(host.dir, host.contextFile);
  const tmplSrc = readFileSync(join(__dirname, 'templates', 'CONTEXT.md'), 'utf8');
  if (hostName === 'qwen') {
    // QWEN.md stays at ~/.qwen/ (not inside advisor/)
    const qwenPath = join(HOME, '.qwen', 'QWEN.md');
    if (!existsSync(qwenPath)) {
      writeFileSync(qwenPath, renderTemplate(tmplSrc, vars));
      ok(`QWEN.md written from template`);
    } else {
      const existing = readFileSync(qwenPath, 'utf8');
      if (!existing.includes('## Advisor')) {
        writeFileSync(qwenPath, existing + '\n\n---\n\n' + ctxSrc);
        ok('QWEN.md: appended Advisor section');
      } else {
        ok('QWEN.md: Advisor section already present');
      }
    }
  } else {
    if (!existsSync(ctxPath)) {
      writeFileSync(ctxPath, renderTemplate(tmplSrc, vars));
      ok(`${host.contextFile} written from template`);
    } else {
      const existing = readFileSync(ctxPath, 'utf8');
      if (!existing.includes('## Advisor')) {
        writeFileSync(ctxPath, existing + '\n\n---\n\n' + ctxSrc);
        ok(`${host.contextFile}: appended Advisor section`);
      } else {
        ok(`${host.contextFile}: Advisor section already present`);
      }
    }
  }

  // OpenRouter config (if provided)
  if (opts.orKey) {
    const orPath = join(host.dir, 'advisor-openrouter.json');
    const orCfg = {
      apiKey: opts.orKey,
      model:  opts.orModel || 'openai/gpt-4o-mini',
    };
    writeFileSync(orPath, JSON.stringify(orCfg, null, 2));
    if (process.platform !== 'win32') {
      try { chmodSync(orPath, 0o600); } catch { /* best-effort */ }
    }
    ok('advisor-openrouter.json (mode 0600 on POSIX)');
  }

  // Qwen-specific extras: MCP wiring + extension registration
  if (hostName === 'qwen') {
    await wireQwenMcps(host, opts);
  }
}

// ---------------------------------------------------------------------------
// Qwen MCP wiring
// ---------------------------------------------------------------------------

async function wireQwenMcps(host, opts) {
  const npmRoot = tryRun('npm root -g');
  if (!npmRoot) {
    warn('Could not determine npm global root — skipping MCP wiring.');
    return;
  }

  log();
  log('Installing MCP packages...');
  for (const pkg of MCP_PACKAGES) {
    const pkgDir = join(npmRoot, ...pkg.split('/'));
    if (existsSync(pkgDir)) { ok(`${pkg} (already installed)`); continue; }
    process.stdout.write(`  installing ${pkg}...`);
    try { run(`npm install -g ${pkg}`, true); log(' ✓'); }
    catch (e) { log(' ✗'); warn(`Failed: ${(e.message || '').split('\n')[0]}`); }
  }

  log();
  log('Updating Qwen settings.json...');
  const settingsPath = join(host.dir, 'settings.json');
  let settings = {};
  if (existsSync(settingsPath)) {
    const bak = settingsPath + `.bak-${new Date().toISOString().slice(0, 10)}`;
    writeFileSync(bak, readFileSync(settingsPath));
    ok(`backed up to ${bak}`);
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch { /* fresh */ }
  }
  settings.mcpServers ??= {};
  settings.permissions ??= {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

  const nodeServer = (rel, args = [], env = {}) => {
    const cfg = { command: 'node', args: [join(npmRoot, ...rel.split('/')), ...args], trust: true };
    if (Object.keys(env).length) cfg.env = env;
    return cfg;
  };

  const mcpDefs = {
    'filesystem':          nodeServer('@modelcontextprotocol/server-filesystem/dist/index.js', [HOME, host.dir]),
    'sequential-thinking': nodeServer('@modelcontextprotocol/server-sequential-thinking/dist/index.js'),
    'memory':              nodeServer('@modelcontextprotocol/server-memory/dist/index.js', [],
                               { MEMORY_FILE_PATH: join(host.dir, 'memory-graph.json') }),
    'context7':            nodeServer('@upstash/context7-mcp/dist/index.js'),
    'web-search':          nodeServer('tavily-mcp/build/index.js', [],
                               { TAVILY_API_KEY: opts.tavily || 'YOUR_TAVILY_API_KEY_HERE' }),
    'browser':             nodeServer('@playwright/mcp/cli.js',
                               ['--browser', 'chrome', '--user-data-dir', join(host.dir, 'playwright-profile')]),
    'sqlite':              nodeServer('mcp-sqlite/mcp-sqlite-server.js'),
    'github':              nodeServer('github-mcp-server/dist/index.js', [],
                               opts.github ? { GITHUB_PERSONAL_ACCESS_TOKEN: opts.github } : {}),
    'code-runner':         nodeServer('mcp-server-code-runner/dist/cli.js'),
  };

  let added = 0;
  for (const [k, v] of Object.entries(mcpDefs)) {
    if (!settings.mcpServers[k]) { settings.mcpServers[k] = v; added++; }
  }
  ok(`${added} MCP server(s) added, ${Object.keys(mcpDefs).length - added} already present`);

  for (const p of ['Bash(node *)', 'Bash(git *)']) {
    if (!settings.permissions.allow.includes(p)) settings.permissions.allow.push(p);
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  ok('settings.json saved');

  if (host.extInstall) {
    log();
    try { run(host.extInstall, true); ok('advisor extension registered'); }
    catch { warn(`Could not auto-register: run manually → ${host.extInstall}`); }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseFlags(process.argv.slice(2));
  if (opts.help) { showHelp(); return; }

  log();
  log('Open-Advisor — Installer');
  log('========================');
  log();

  const [major] = process.version.slice(1).split('.').map(Number);
  if (major < 18) { fail(`Node.js 18+ required (found ${process.version})`); process.exit(1); }
  ok(`Node.js ${process.version}`);

  // Resolve target hosts
  let aiArg = opts.ai;
  if (!aiArg) {
    log();
    log('Available hosts: ' + Object.keys(HOSTS).join(', ') + ', all');
    aiArg = await ask('Which host CLI?', 'qwen');
  }
  aiArg = aiArg.toLowerCase();

  const targets = aiArg === 'all'
    ? Object.keys(HOSTS)
    : aiArg.split(',').map(s => s.trim()).filter(Boolean);

  for (const t of targets) {
    if (!HOSTS[t]) { fail(`Unknown host: ${t}. Choose from: ${Object.keys(HOSTS).join(', ')}, all`); process.exit(1); }
  }

  // Optional credentials (prompt only if not provided AND we're targeting qwen, OR for openrouter regardless)
  if (targets.includes('qwen') && opts.tavily === undefined && opts.github === undefined) {
    log();
    log('Optional Qwen MCP credentials (Enter to skip):');
    opts.tavily ??= await ask('Tavily API key (web-search)', '');
    opts.github ??= await ask('GitHub token   (github MCP)', '');
  }
  if (opts.orKey === undefined) {
    log();
    const want = await ask('Configure OpenRouter advisor now? (y/N)', 'n');
    if (want.toLowerCase().startsWith('y')) {
      opts.orKey   = await ask('OpenRouter API key', '');
      opts.orModel = await ask('Default model', 'openai/gpt-4o-mini');
    }
  }

  // Install for each target
  for (const t of targets) {
    await installForHost(t, HOSTS[t], opts);
  }

  log();
  log('Installation complete!');
  log();
  log('Next steps:');
  log('  1. Restart your CLI host');
  log('  2. /advisor.select <id>      ← set your active advisor');
  log('  3. /advisor.setup            ← verify config');
  log('  4. /advisor <your question>  ← ready');
  log();
}

main().catch(e => {
  log();
  fail(`Installation failed: ${e.message}`);
  process.exit(1);
});
