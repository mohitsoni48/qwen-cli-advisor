---
description: Run the advisor. Pure Python script — no Node, no browser, no AI interpretation.
---

## Goal

Run `advisor.py` with the active advisor and user question.

## Steps

### 1. Read active advisor

Read `{HOST_DIR}advisor-active` and trim whitespace. Let it be `ADVISOR_ID`.

### 2. Run the script

Execute: `python "{HOST_DIR}advisor.py" "<ADVISOR_ID>" "<question>"`

Capture stdout. If non-zero exit, capture stderr.

### 3. Output

Print stdout verbatim. If stderr exists, print it after stdout.
