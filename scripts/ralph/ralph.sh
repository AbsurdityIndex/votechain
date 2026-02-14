#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop (repo-local)
# Usage:
#   ./scripts/ralph/ralph.sh [--tool codex|amp|claude] [max_iterations]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
FACTORY_ROOT_DEFAULT="/Users/coreysteinwand/Developer/arctek-agents/factory"
FACTORY_ROOT="${RALPH_FACTORY_ROOT:-$FACTORY_ROOT_DEFAULT}"
MODEL="${RALPH_MODEL:-gpt-5.3-codex}"
DISABLE_PLAYWRIGHT_MCP="${RALPH_DISABLE_PLAYWRIGHT_MCP:-1}"
BASE_URL="${RALPH_BASE_URL:-http://127.0.0.1:4321/votechain/poc/}"
AUTO_START_DEV_SERVER="${RALPH_AUTO_START_DEV_SERVER:-1}"
DEV_HOST="${RALPH_DEV_HOST:-127.0.0.1}"
DEV_PORT="${RALPH_DEV_PORT:-4321}"
DEV_SERVER_PID_FILE="$SCRIPT_DIR/.dev-server.pid"
DEV_SERVER_LOG="$SCRIPT_DIR/dev-server.log"
DEV_SERVER_CMD="${RALPH_DEV_COMMAND:-npm run dev -- --host $DEV_HOST --port $DEV_PORT}"

export RALPH_FACTORY_ROOT="$FACTORY_ROOT"
export RALPH_MODEL="$MODEL"
export RALPH_BASE_URL="$BASE_URL"

if command -v codex >/dev/null 2>&1; then
  DEFAULT_TOOL="codex"
elif command -v claude >/dev/null 2>&1; then
  DEFAULT_TOOL="claude"
else
  DEFAULT_TOOL="amp"
fi

TOOL="${RALPH_TOOL:-$DEFAULT_TOOL}"
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool)
      TOOL="${2:-}"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--tool codex|amp|claude] [max_iterations]"
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

if [[ "$TOOL" != "codex" && "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'codex', 'amp', or 'claude'."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required. Install jq and retry."
  exit 1
fi

if [[ "$TOOL" == "amp" ]] && ! command -v amp >/dev/null 2>&1; then
  echo "Error: amp is not installed or not on PATH."
  echo "Install amp, or run with --tool claude."
  exit 1
fi

if [[ "$TOOL" == "claude" ]] && ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude is not installed or not on PATH."
  echo "Install Claude Code, or run with --tool codex or --tool amp."
  exit 1
fi

if [[ "$TOOL" == "codex" ]] && ! command -v codex >/dev/null 2>&1; then
  echo "Error: codex is not installed or not on PATH."
  echo "Install Codex CLI, or run with --tool claude or --tool amp."
  exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
  echo "Error: Missing $PRD_FILE"
  echo "Create it from scripts/ralph/prd.json.example first."
  exit 1
fi

if [ ! -d "$RALPH_FACTORY_ROOT/prompts" ]; then
  echo "Warning: factory prompts not found at $RALPH_FACTORY_ROOT/prompts"
  echo "Set RALPH_FACTORY_ROOT to your factory repo root to enable domain-expert prompt loading."
fi

is_base_url_up() {
  curl -fsS --max-time 3 "$BASE_URL" >/dev/null 2>&1
}

ensure_local_host() {
  if is_base_url_up; then
    return
  fi

  if [[ "$AUTO_START_DEV_SERVER" != "1" ]]; then
    echo "Error: $BASE_URL is not reachable and RALPH_AUTO_START_DEV_SERVER=0."
    exit 1
  fi

  if [ -f "$DEV_SERVER_PID_FILE" ]; then
    OLD_PID=$(cat "$DEV_SERVER_PID_FILE" 2>/dev/null || true)
    if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
      echo "Waiting for existing dev server PID $OLD_PID..."
    else
      rm -f "$DEV_SERVER_PID_FILE"
    fi
  fi

  if [ ! -f "$DEV_SERVER_PID_FILE" ]; then
    echo "Starting dev server for Ralph: $DEV_SERVER_CMD"
    (cd "$PROJECT_ROOT" && nohup bash -lc "$DEV_SERVER_CMD" > "$DEV_SERVER_LOG" 2>&1 & echo $! > "$DEV_SERVER_PID_FILE")
    sleep 1
  fi

  for _ in $(seq 1 45); do
    if is_base_url_up; then
      return
    fi
    sleep 1
  done

  echo "Error: dev server did not become ready at $BASE_URL"
  echo "Check log: $DEV_SERVER_LOG"
  exit 1
}

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "Archived to: $ARCHIVE_FOLDER"

    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch from PRD
CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ]; then
  echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo "Factory prompt root: $RALPH_FACTORY_ROOT"
echo "POC base URL: $RALPH_BASE_URL"
if [[ "$TOOL" == "codex" ]]; then
  echo "Codex model: $RALPH_MODEL"
  if [[ "$DISABLE_PLAYWRIGHT_MCP" == "1" ]]; then
    echo "Codex MCP override: playwright disabled for runner stability"
  fi
fi

ensure_local_host

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  run_codex_with_model() {
    local model_name="${1:-}"
    local -a cmd
    cmd=(codex exec --dangerously-bypass-approvals-and-sandbox -C "$PROJECT_ROOT")

    if [[ "$DISABLE_PLAYWRIGHT_MCP" == "1" ]]; then
      cmd+=(-c "mcp_servers.playwright.enabled=false")
    fi

    if [[ -n "$model_name" ]]; then
      cmd+=(-m "$model_name")
    fi

    cmd+=(-)
    OUTPUT=$(cat "$SCRIPT_DIR/CLAUDE.md" | "${cmd[@]}" 2>&1 | tee /dev/stderr) || true
  }

  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  elif [[ "$TOOL" == "codex" ]]; then
    run_codex_with_model "$RALPH_MODEL"
    if echo "$OUTPUT" | grep -q "does not exist or you do not have access"; then
      echo "Warning: requested model '$RALPH_MODEL' unavailable. Retrying Codex with default accessible model..."
      run_codex_with_model ""
    fi
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  fi

  if echo "$OUTPUT" | tr -d '\r' | grep -Eq '^[[:space:]]*<promise>COMPLETE</promise>[[:space:]]*$'; then
    echo ""
    echo "Ralph completed all tasks."
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
