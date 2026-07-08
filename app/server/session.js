// Desktop-launcher session lifecycle: lets the server auto-shut-down once no
// browser tab is open anymore, without ever having to detect "tab closed"
// directly (browsers don't expose that reliably). Instead, the frontend sends a
// heartbeat every 10s while any tab is open; if none arrive for 60s, the server
// assumes it's no longer wanted and shuts itself down (through the same
// shutdown path used for Ctrl+C, so the on-close backup still runs).
//
// GRACE PERIOD (the "reopen race" guard): the server does NOT exit the instant
// it first notices it's idle. It waits one more check interval — a grace window
// in which a just-reopened tab (registering + heartbeating) cancels the pending
// shutdown. This closes the window where a user closes the last tab and quickly
// reopens the app: the launcher's /health probe finds a live server and reuses
// it, the reopened tab reconnects within the grace window, and the shutdown is
// cancelled. See ARCHITECTURE.md §9.3.
//
// Only ACTIVE when the process was started by one of the launch scripts (they
// set JOB_TRACKER_SESSION). Plain `npm start` / `npm run dev` — the normal dev
// workflow — never auto-shuts-down; this whole module is a no-op for them.

const crypto = require('crypto');

const LAUNCHER_MANAGED = !!process.env.JOB_TRACKER_SESSION;
// Overridable for fast local testing (e.g. ATS_IDLE_TIMEOUT_MS=5000); production
// always uses the 60s/30s defaults from the brief.
const IDLE_TIMEOUT_MS = Number(process.env.ATS_IDLE_TIMEOUT_MS) || 60 * 1000;
const CHECK_INTERVAL_MS = Number(process.env.ATS_IDLE_CHECK_INTERVAL_MS) || 30 * 1000;

let activeSession = process.env.JOB_TRACKER_SESSION || null;
// Seed lastHeartbeat at boot (not null) so the very first idle-check — before any
// tab has had a chance to load and register — doesn't see a false "60s of silence."
let lastHeartbeat = Date.now();
let monitorTimer = null;
// Set true on the first idle check; shutdown only fires on the *next* still-idle
// check. Any register/heartbeat clears it — that's the grace window.
let idlePending = false;

// Any client activity: refresh the clock and cancel a pending idle-shutdown.
function noteActivity() {
  lastHeartbeat = Date.now();
  idlePending = false;
}

// Called by POST /api/session/start. If no launcher supplied a token (dev mode,
// or the very first call in a launcher-managed run), mint one now. Always
// returns the id the caller should use for subsequent heartbeats.
function registerSession() {
  if (!activeSession) activeSession = `job-tracker-session-${crypto.randomBytes(6).toString('hex')}`;
  noteActivity();
  return activeSession;
}

// Called by POST /api/session/heartbeat. Returns whether the id matched the
// current session — a mismatch means the server restarted since this tab last
// loaded; the frontend re-registers itself when it sees ok:false.
function heartbeat(sessionId) {
  const ok = !!sessionId && sessionId === activeSession;
  if (ok) noteActivity();
  return { ok, sessionId: activeSession };
}

function startIdleMonitor(onIdle) {
  if (!LAUNCHER_MANAGED) return; // manual/dev runs: never auto-shutdown
  console.log(`Session lifecycle armed (idle timeout ${IDLE_TIMEOUT_MS}ms, checking every ${CHECK_INTERVAL_MS}ms).`);
  stopIdleMonitor();
  idlePending = false;
  monitorTimer = setInterval(() => {
    const idleFor = Date.now() - lastHeartbeat;
    if (idleFor <= IDLE_TIMEOUT_MS) {
      idlePending = false; // still active — nothing pending
      return;
    }
    if (!idlePending) {
      // First time we've seen it idle: arm, but don't exit yet. Give a reopened
      // tab this whole interval to reconnect and cancel via noteActivity().
      idlePending = true;
      console.log(`No open Job Tracker tab for ${Math.round(idleFor / 1000)}s — will shut down at the next check unless a tab reconnects.`);
      return;
    }
    console.log('Still no open tab after the grace window — shutting down.');
    onIdle();
  }, CHECK_INTERVAL_MS);
  // Doesn't hold the process open on its own — shutdown() calls process.exit()
  // anyway, but this keeps intent clear and matches backup.js's scheduler.
  if (monitorTimer.unref) monitorTimer.unref();
}

function stopIdleMonitor() {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
}

module.exports = { registerSession, heartbeat, startIdleMonitor, stopIdleMonitor, LAUNCHER_MANAGED };
