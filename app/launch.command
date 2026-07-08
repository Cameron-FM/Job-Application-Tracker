#!/bin/bash
# Job Tracker — macOS launcher.
#
# Double-clicked via Job Tracker.app (or run directly). Resolves its directories
# from its own location, checks Node.js/npm, reuses an already-running instance
# if one exists, otherwise installs deps and starts the server, waits for it to
# become healthy, then opens the browser. See ARCHITECTURE.md ("Desktop launchers
# & session lifecycle") for how this fits together with the server-side
# session/idle-shutdown system in server/session.js.
set -u

# --- 1. Resolve directories from the script's own location ------------------
# This script lives in app/ (all program files do); the project ROOT — holding
# data/ and the double-clickable launchers — is one level up.
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
cd "$APP_DIR" || exit 1   # npm commands run here (package.json lives in app/)

PORT=3400
HEALTH_URL="http://localhost:${PORT}/health"
APP_URL="http://localhost:${PORT}"
LOG_DIR="$ROOT_DIR/data/logs"
LOG_FILE="$LOG_DIR/app.log"

alert() {
  # Simple native macOS alert dialog (no extra dependency — osascript ships with macOS).
  osascript -e "display alert \"Job Tracker\" message \"$1\"" >/dev/null 2>&1
}

# --- Make Node findable regardless of how it was installed ------------------
# A double-clicked .app does NOT load your shell profile (~/.zshrc etc.), so a
# Node that works fine in Terminal can be missing from PATH here. Add the usual
# install locations (including this project's ~/.local/node) so we find it.
add_to_path() { [ -d "$1" ] && case ":$PATH:" in *":$1:"*) ;; *) PATH="$1:$PATH";; esac; }
add_to_path "$HOME/.local/node/bin"   # the location this repo documents in CLAUDE.md
add_to_path "/opt/homebrew/bin"       # Homebrew (Apple Silicon)
add_to_path "/usr/local/bin"          # Homebrew (Intel) + official nodejs.org installer
add_to_path "$HOME/.volta/bin"        # Volta
if [ -d "$HOME/.nvm/versions/node" ]; then   # nvm — take the newest installed
  add_to_path "$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
fi
export PATH

# True if a genuine Job Tracker instance answers /health right now.
is_job_tracker_up() {
  curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q '"app"[[:space:]]*:[[:space:]]*"job-tracker"'
}

# True if *anything* is listening on our port (bash's /dev/tcp — no `nc`/`lsof` needed).
port_in_use() {
  (exec 3<>"/dev/tcp/localhost/${PORT}") 2>/dev/null && exec 3>&- 3<&-
}

# --- 2. Check Node.js and npm -----------------------------------------------
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  alert "Node.js is required to run Job Tracker but wasn't found on this Mac.\n\nInstall it from https://nodejs.org (the LTS version), then double-click Job Tracker again."
  exit 1
fi

# --- 3. Already running? Reuse it instead of starting a second instance ----
# Only trusts port 3400 if it's genuinely our /health endpoint — never assumes
# and never kills whatever else might be using the port. A live Job Tracker is
# always safe to reuse: the server's grace period (server/session.js) means a
# reopened tab reconnects and cancels any pending idle-shutdown.
if is_job_tracker_up; then
  open "$APP_URL"
  exit 0
fi

# Port-settle safety: if a previous instance happened to be exiting at this exact
# moment, its port may take a beat to free. Wait briefly so our fresh start won't
# collide with it — but bounded, and re-checking for reuse each time, so we never
# hang on a foreign process holding the port.
settle=0
while port_in_use && [ "$settle" -lt 10 ]; do
  if is_job_tracker_up; then open "$APP_URL"; exit 0; fi  # it was actually alive
  sleep 0.5
  settle=$((settle + 1))
done

# --- 4. Install dependencies (keeps things in sync after a git pull) -------
mkdir -p "$LOG_DIR"
echo "[$(date)] Installing dependencies..." >>"$LOG_FILE"
if ! npm install >>"$LOG_FILE" 2>&1; then
  alert "Job Tracker couldn't install its dependencies. Check data/logs/app.log for details."
  exit 1
fi

# --- 5. Start the server in the background with a fresh session token ------
SESSION_ID="job-tracker-session-$(date +%s)-$RANDOM"
echo "[$(date)] Starting server (session $SESSION_ID)..." >>"$LOG_FILE"
JOB_TRACKER_SESSION="$SESSION_ID" nohup npm start >>"$LOG_FILE" 2>&1 &
disown

# --- 6. Wait for it to become healthy, then open the browser ---------------
attempt=0
until [ "$attempt" -ge 30 ]; do
  body="$(curl -fsS --max-time 1 "$HEALTH_URL" 2>/dev/null)"
  if [ -n "$body" ] && echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    open "$APP_URL"
    exit 0
  fi
  sleep 1
  attempt=$((attempt + 1))
done

alert "Job Tracker didn't start within 30 seconds. Check data/logs/app.log for details."
exit 1
