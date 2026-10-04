#!/usr/bin/env sh
# DevToolkit launcher for macOS / Linux.  Usage: ./start.sh   (HOST=0.0.0.0 PORT=8080 ./start.sh to share on your network)
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"; export PORT
open_browser() { (sleep 1; (xdg-open "http://localhost:$PORT/" || open "http://localhost:$PORT/") >/dev/null 2>&1) & }

if command -v node >/dev/null 2>&1; then
  open_browser; exec node server/server.mjs
elif command -v python3 >/dev/null 2>&1; then
  echo "Node.js not found - using Python instead."; open_browser; exec python3 server/serve.py
else
  echo "DevToolkit needs Node.js 18+ or Python 3.8+ to run its local web server."; exit 1
fi
