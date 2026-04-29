#!/usr/bin/env python3
"""Advisor runner — pure Python. Reads settings.json, dispatches via curl subprocess.
Works on Windows, macOS, and Linux."""

import json
import os
import sys
import subprocess

SETTINGS_PATH = os.path.expanduser('~/.qwen/settings.json')
HOST_DIR = os.environ.get('ADVISOR_HOST_DIR', os.path.expanduser('~/.qwen/advisor'))
RESPONSE_FILE = os.path.join(HOST_DIR, 'advisor-last-response.md')
TIMEOUT = 180


def ensure_host_dir():
    """Create HOST_DIR if it doesn't exist."""
    try:
        os.makedirs(HOST_DIR, exist_ok=True)
    except OSError:
        pass


def load_advisors():
    if not os.path.exists(SETTINGS_PATH):
        print(f"ERROR: {SETTINGS_PATH} not found.", file=sys.stderr)
        sys.exit(1)
    with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
        settings = json.load(f)
    advisors = settings.get('advisors', [])
    if not advisors:
        print("ERROR: No advisors configured in settings.json.", file=sys.stderr)
        sys.exit(1)
    return advisors, settings


def resolve_api_key(settings, env_key):
    if not env_key:
        return None
    return settings.get('env', {}).get(env_key) or os.environ.get(env_key)


def http_post(base_url, api_key, body, timeout):
    url = f'{base_url.rstrip("/")}'
    # Ollama OpenAI-compatible uses /api/chat, not /chat/completions
    if not url.endswith('/chat'):
        url = f'{url}/chat/completions'
    payload = json.dumps(body).encode('utf-8')

    # Pipe JSON to curl via stdin — works on all platforms (Win/Mac/Linux)
    cmd = [
        'curl', '-s', '--max-time', str(timeout),
        url,
        '-H', 'Content-Type: application/json',
        '-H', f'Authorization: Bearer {api_key}',
        '--data-binary', '@-',
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, input=payload, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None, f'curl timed out after {timeout}s'

    if proc.returncode != 0:
        return None, f'curl exit {proc.returncode}: {proc.stderr.decode("utf-8", errors="replace").strip()[:300]}'

    stdout_str = proc.stdout.decode('utf-8', errors='replace')
    try:
        data = json.loads(stdout_str)
        # OpenAI-compatible: choices[0].message.content
        # Ollama OpenAI-compatible: message.content
        content = (data.get('choices', [{}])[0].get('message', {}).get('content') or '').strip()
        if not content:
            content = (data.get('message', {}).get('content') or '').strip()
        data['_content'] = content  # normalized content for callers
        if not content:
            status = data.get('status')
            title = data.get('title')
            detail = data.get('detail')
            if status and status in (403, 401):
                return None, f'HTTP {status}: {title} — {detail}'
            return None, f'Empty content in response. Full: {stdout_str[:500]}'
        return data, None
    except json.JSONDecodeError as e:
        return None, f'JSON parse error: {e}. stdout={len(proc.stdout)} bytes. Body: {stdout_str[:300]}'


def run_model(advisor, settings, question):
    model_id = advisor['id']
    providers = settings.get('modelProviders', {})

    model_config = None
    for provider_key in providers:
        for m in providers[provider_key]:
            if m['id'] == model_id:
                model_config = m
                break
        if model_config:
            break

    if not model_config:
        print(f'ERROR: Model "{model_id}" not found in settings.json.modelProviders.', file=sys.stderr)
        sys.exit(1)

    api_key = resolve_api_key(settings, model_config.get('envKey'))
    if not api_key:
        print(f'ERROR: API key missing. Set {model_config["envKey"]} in settings.json.env.', file=sys.stderr)
        sys.exit(1)

    body = {
        'model': model_config['id'],
        'messages': [{'role': 'user', 'content': question}],
    }
    gc = model_config.get('generationConfig', {})
    skip_keys = {'extra_body', 'contextWindowSize', 'modalities'}
    for k, v in gc.items():
        if k not in skip_keys:
            body[k] = v
    if gc.get('extra_body'):
        body.update(gc['extra_body'])

    data, err = http_post(model_config['baseUrl'], api_key, body, TIMEOUT)
    if err:
        print(f'ERROR: {advisor["name"]} — {err}', file=sys.stderr)
        sys.exit(1)

    content = data.get('_content', (data.get('choices', [{}])[0].get('message', {}).get('content') or '')).strip()
    if not content:
        print(f'ERROR: Empty response from {advisor["name"]}.', file=sys.stderr)
        sys.exit(1)

    emit_response(content, advisor)


def run_http(advisor, settings, question):
    api_key = resolve_api_key(settings, advisor.get('envKey'))
    if not api_key:
        print(f'ERROR: API key missing. Set {advisor["envKey"]} in settings.json.env.', file=sys.stderr)
        sys.exit(1)

    base_url = advisor['baseUrl'].rstrip('/')
    body = {
        'model': advisor['model'],
        'messages': [{'role': 'user', 'content': question}],
    }
    gc = advisor.get('generationConfig', {})
    skip_keys = {'extra_body', 'contextWindowSize', 'modalities'}
    for k, v in gc.items():
        if k not in skip_keys:
            body[k] = v
    if gc.get('extra_body'):
        body.update(gc['extra_body'])

    data, err = http_post(base_url, api_key, body, TIMEOUT)
    if err:
        print(f'ERROR: {advisor["name"]} — {err}', file=sys.stderr)
        sys.exit(1)

    content = data.get('_content', '').strip()
    if not content:
        print(f'ERROR: Empty response from {advisor["name"]}.', file=sys.stderr)
        sys.exit(1)

    emit_response(content, advisor)


def run_cli(advisor, question):
    args = [a.replace('{{QUESTION}}', question) for a in advisor.get('args', [])]
    result = subprocess.run(
        [advisor['bin']] + args,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
        shell=sys.platform == 'win32',
    )

    if result.returncode != 0:
        print(f'ERROR: {advisor["name"]} exited {result.returncode}.', file=sys.stderr)
        sys.exit(1)

    response = (result.stdout or '').strip()
    if not response:
        print(f'ERROR: No response from {advisor["name"]}.', file=sys.stderr)
        sys.exit(1)

    emit_response(response, advisor)


def emit_response(response, advisor):
    with open(RESPONSE_FILE, 'w', encoding='utf-8') as f:
        f.write(response)
    preview = response[:200] + ('…' if len(response) > 200 else '')
    print(f'✓ {advisor["name"]} responded ({len(response)} chars)')
    print(f'Preview: {preview}')
    print(f'Full response saved to: {RESPONSE_FILE}')


def main():
    if len(sys.argv) < 2:
        print(f'Usage: python advisor.py [advisor-id] "<question>"\nRun /advisor.select first to choose one.', file=sys.stderr)
        sys.exit(1)

    ensure_host_dir()

    if len(sys.argv) == 2:
        # No advisor ID — read from advisor-active
        active_file = os.path.join(HOST_DIR, 'advisor-active')
        try:
            advisor_id = open(active_file, 'r', encoding='utf-8').read().strip()
        except FileNotFoundError:
            print(f'ERROR: {active_file} not found. Run /advisor.select first.', file=sys.stderr)
            sys.exit(1)
        if not advisor_id:
            print(f'ERROR: {active_file} is empty. Run /advisor.select first.', file=sys.stderr)
            sys.exit(1)
        question = sys.argv[1]
    else:
        advisor_id = sys.argv[1]
        question = ' '.join(sys.argv[2:])

    advisors, settings = load_advisors()
    advisor = next((a for a in advisors if a['id'] == advisor_id), None)

    if not advisor:
        names = ', '.join(a['id'] for a in advisors)
        print(f'ERROR: Unknown advisor "{advisor_id}". Available: {names}', file=sys.stderr)
        sys.exit(1)

    if advisor['type'] == 'model':
        run_model(advisor, settings, question)
    elif advisor['type'] == 'http':
        run_http(advisor, settings, question)
    elif advisor['type'] == 'cli':
        run_cli(advisor, question)
    else:
        print(f'ERROR: Unknown advisor type "{advisor["type"]}".', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
