# Ralph Setup (VoteChain)

This repository is configured to run Ralph from `scripts/ralph/`.

## Prerequisites

- `jq`
- One agent CLI:
  - `codex` (recommended in this repo)
  - or `claude`
  - or `amp`

## First-time setup

```bash
cp scripts/ralph/prd.json.example scripts/ralph/prd.json
chmod +x scripts/ralph/ralph.sh
```

Edit `scripts/ralph/prd.json` with your real stories, branch name, and acceptance criteria.

## Factory domain prompts

Ralph is configured to load domain expert prompts from your factory repo via:

- `RALPH_FACTORY_ROOT` (default: `/Users/coreysteinwand/Developer/arctek-agents/factory`)

Override if needed:

```bash
export RALPH_FACTORY_ROOT="/path/to/your/factory"
```

## Model selection

Codex runs use `gpt-5.3-codex` by default.

Override if needed:

```bash
export RALPH_MODEL="gpt-5.3-codex"
```

If your account cannot access that model, the runner automatically retries with Codex CLI's default model.

## Playwright MCP stability

Runner mode disables the `playwright` MCP server by default to avoid startup handshake failures.
This only affects MCP startup; UI verification can still be executed through shell Playwright workflows.

Override:

```bash
export RALPH_DISABLE_PLAYWRIGHT_MCP=0
```

## Run

```bash
# Default tool auto-selects codex if available, otherwise claude, then amp
./scripts/ralph/ralph.sh

# Explicit tool + iterations
./scripts/ralph/ralph.sh --tool codex 10
./scripts/ralph/ralph.sh --tool claude 10
./scripts/ralph/ralph.sh --tool amp 10
```

## npm shortcuts

```bash
npm run ralph
npm run ralph:codex
npm run ralph:claude
npm run ralph:amp
npm run ralph:overnight
```

## Overnight autonomous mode

Run repeated Ralph cycles until completion:

```bash
# 200 iterations per cycle by default
npm run ralph:overnight

# Tune behavior
RALPH_TOOL=claude RALPH_MAX_CYCLES=64 RALPH_SLEEP_SECONDS=5 ./scripts/ralph/overnight.sh 200
RALPH_TOOL=codex RALPH_MAX_CYCLES=64 RALPH_SLEEP_SECONDS=5 ./scripts/ralph/overnight.sh 200
```

## Runtime files

Generated during runs:

- `scripts/ralph/prd.json`
- `scripts/ralph/progress.txt`
- `scripts/ralph/archive/`
- `scripts/ralph/.last-branch`
