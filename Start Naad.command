#!/bin/bash
# Naad — riyaz for the bansuri.
# Double-click this file. It serves the folder on localhost and opens Naad.
#
# A local web server is required, not optional: browsers refuse microphone
# access to a page opened straight off disk (file://). localhost counts as a
# secure origin, so the mic works there.

cd "$(dirname "$0")" || exit 1
PORT=8731

# If something is already serving this port, just open the page.
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Naad is already running."
  open "http://localhost:$PORT/naad.html"
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM

sleep 1
open "http://localhost:$PORT/naad.html"

cat <<BANNER

  नाद  Naad — riyaz for a C natural bansuri

  Running at  http://localhost:$PORT/naad.html

  Allow the microphone when your browser asks.
  Keep this window open while you practise; close it to stop.

BANNER

wait $SRV
