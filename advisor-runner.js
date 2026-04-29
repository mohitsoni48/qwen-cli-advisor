'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const HOST_DIR = process.env.ADVISOR_HOST_DIR || __dirname;
const RESPONSE_FILE = path.join(HOST_DIR, 'advisor-last-response.md');
const SETTINGS_PATH = path.join(os.homedir(), '.qwen', 'settings.json');
const TIMEOUT_MS = 90000;

// ─────────────────────────────────────────────────────────────────────
// Load advisors from settings.json
// ─────────────────────────────────────────────────────────────────────

function loadAdvisors() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    process.stderr.write(`ERROR: ${SETTINGS_PATH} not found.\n`);
    process.exit(1);
  }

  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const advisors = settings.advisors || [];
  if (advisors.length === 0) {
    process.stderr.write('ERROR: No advisors configured in settings.json.\n');
    process.exit(1);
  }
  return advisors;
}

// ─────────────────────────────────────────────────────────────────────
// Resolve API key: envKey → settings.env → process.env → apiKey
// ─────────────────────────────────────────────────────────────────────

function resolveApiKey(settings, envKey) {
  if (!envKey) return null;
  return settings.env?.[envKey] || process.env[envKey] || null;
}

// ─────────────────────────────────────────────────────────────────────
// Run model-based advisor — calls modelProviders API directly
// ─────────────────────────────────────────────────────────────────────

async function runModelAdvisor(advisor, question) {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const providers = settings.modelProviders || {};

  // Find the model in modelProviders by advisor id
  let modelConfig = null;
  for (const providerKey of Object.keys(providers)) {
    const models = providers[providerKey];
    const found = models.find(m => m.id === advisor.id);
    if (found) { modelConfig = found; break; }
  }

  if (!modelConfig) {
    process.stderr.write(`ERROR: Model "${advisor.id}" not found in settings.json.modelProviders.\n`);
    process.exit(1);
  }

  const baseUrl = modelConfig.baseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;
  const apiKey = resolveApiKey(settings, modelConfig.envKey);

  if (!apiKey) {
    process.stderr.write(`ERROR: API key missing for "${advisor.name}". Set ${modelConfig.envKey} in settings.json.env.\n`);
    process.exit(1);
  }

  const body = {
    model: modelConfig.id,
    messages: [{ role: 'user', content: question }],
  };

  // Apply generationConfig
  if (modelConfig.generationConfig) {
    const gc = modelConfig.generationConfig;
    if (gc.contextWindowSize) body.max_tokens = gc.contextWindowSize;
    if (gc.extra_body) Object.assign(body, gc.extra_body);
    const skipKeys = new Set(['extra_body', 'contextWindowSize', 'modalities']);
    for (const [k, v] of Object.entries(gc)) {
      if (!skipKeys.has(k)) body[k] = v;
    }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    process.stderr.write(`ERROR: ${advisor.name} HTTP ${res.status} — ${bodyText.slice(0, 300)}\n`);
    process.exit(1);
  }

  const data = await res.json();
  const response = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!response) {
    process.stderr.write(`ERROR: Empty response from ${advisor.name}.\n`);
    process.exit(1);
  }

  emitResponse(response, advisor);
}

// ─────────────────────────────────────────────────────────────────────
// Run CLI-based advisor — spawns local CLI tool
// ─────────────────────────────────────────────────────────────────────

function runCliAdvisor(advisor, question) {
  const args = advisor.args.map(a => a.replace('{{QUESTION}}', question));
  const result = spawnSync(advisor.bin, args, {
    cwd: process.env.ADVISOR_WORK_DIR || process.cwd(),
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write(`ERROR: ${advisor.bin} not found. Install it first.\n`);
    } else {
      process.stderr.write(`ERROR: ${advisor.name} failed — ${result.error.message}\n`);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`ERROR: ${advisor.name} exited ${result.status}.\n`);
    process.exit(1);
  }

  const response = (result.stdout || '').trim();
  if (!response) {
    process.stderr.write(`ERROR: No response from ${advisor.name}.\n`);
    process.exit(1);
  }

  emitResponse(response, advisor);
}

// ─────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────

function emitResponse(response, advisor) {
  fs.writeFileSync(RESPONSE_FILE, response, 'utf8');
  const preview = response.length > 200
    ? response.slice(0, 200).trimEnd() + '…'
    : response;
  process.stdout.write(
    `✓ ${advisor.name} responded (${response.length} chars)\n\n` +
    `Preview: ${preview}\n\n` +
    `Full response saved to: ${RESPONSE_FILE}\n`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────

const advisorId = process.argv[2];
const question = process.argv.slice(3).join(' ').trim();

if (!advisorId || !question) {
  const advisors = loadAdvisors();
  const names = advisors.map(a => a.id).join(', ');
  process.stderr.write(`Usage: node advisor-runner.js <advisor-id> "<question>"\nAvailable: ${names}\n`);
  process.exit(1);
}

const advisors = loadAdvisors();
const advisor = advisors.find(a => a.id === advisorId);
if (!advisor) {
  const names = advisors.map(a => a.id).join(', ');
  process.stderr.write(`ERROR: Unknown advisor "${advisorId}". Available: ${names}\n`);
  process.exit(1);
}

(async () => {
  if (advisor.type === 'model') return runModelAdvisor(advisor, question);
  if (advisor.type === 'cli')   return runCliAdvisor(advisor, question);
  process.stderr.write(`ERROR: Unknown advisor type "${advisor.type}".\n`);
  process.exit(1);
}).catch(err => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
