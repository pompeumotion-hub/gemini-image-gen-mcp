#!/usr/bin/env bash
set -e

MODE="${1:---both}"

case "$MODE" in
  --mcp-only)
    echo "Starting MCP server..."
    npm start
    ;;
  --web-only)
    echo "Starting Web server..."
    npm run web
    ;;
  --both)
    echo "Starting both MCP and Web servers..."
    npm run web &
    WEB_PID=$!
    npm start &
    MCP_PID=$!
    trap "kill $WEB_PID $MCP_PID 2>/dev/null" EXIT INT TERM
    wait
    ;;
  *)
    echo "Usage: $0 [--both|--mcp-only|--web-only]"
    exit 1
    ;;
esac
