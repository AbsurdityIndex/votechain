#!/bin/bash
# Keep running Ralph in cycles until completion criteria are met.
# Usage:
#   ./scripts/ralph/overnight.sh [iterations_per_cycle]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"

ITERATIONS_PER_CYCLE="${1:-200}"
MAX_CYCLES="${RALPH_MAX_CYCLES:-48}"
TOOL="${RALPH_TOOL:-codex}"
SLEEP_SECONDS="${RALPH_SLEEP_SECONDS:-5}"

if [ ! -f "$PRD_FILE" ]; then
  echo "Error: missing $PRD_FILE"
  exit 1
fi

echo "Starting overnight Ralph loop"
echo "Tool: $TOOL"
echo "Iterations per cycle: $ITERATIONS_PER_CYCLE"
echo "Max cycles: $MAX_CYCLES"

cycle=1
while [ "$cycle" -le "$MAX_CYCLES" ]; do
  echo ""
  echo "==============================================================="
  echo "Overnight cycle $cycle/$MAX_CYCLES"
  echo "==============================================================="

  if "$SCRIPT_DIR/ralph.sh" --tool "$TOOL" "$ITERATIONS_PER_CYCLE"; then
    if jq -e 'all(.userStories[]; .passes == true)' "$PRD_FILE" >/dev/null; then
      echo "All PRD stories are marked pass=true and Ralph reported COMPLETE."
      exit 0
    fi
  fi

  if jq -e 'all(.userStories[]; .passes == true)' "$PRD_FILE" >/dev/null; then
    echo "All stories pass=true, but Ralph did not signal COMPLETE. Continuing for backlog gap-scan confirmation."
  fi

  cycle=$((cycle + 1))
  sleep "$SLEEP_SECONDS"
done

echo "Overnight loop reached max cycles without completion."
exit 1
