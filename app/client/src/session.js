// Desktop-launcher lifecycle heartbeat. See server/session.js for the full
// design — in short: as long as any tab is running this, the server knows it's
// still wanted. If the server was started manually (npm start / npm run dev,
// no launcher), it never acts on this, so this is harmless background chatter
// in the normal dev workflow.
//
// Plain module-level side effect (not a React hook/effect) — this is an
// app-lifecycle concern, not UI state, and staying outside React avoids any
// interaction with StrictMode's dev-mode double-invoking of effects.
import { api } from './api';

const HEARTBEAT_MS = 10 * 1000;

let sessionId = null;

async function tick() {
  try {
    if (!sessionId) {
      const r = await api.post('/api/session/start', {});
      sessionId = r.sessionId;
      return;
    }
    const r = await api.post('/api/session/heartbeat', { sessionId });
    // Server restarted since we registered (fresh session id) — re-adopt it
    // rather than keep heartbeating a session id it no longer recognizes.
    if (!r.ok) sessionId = r.sessionId;
  } catch {
    // Offline or the dev server is mid-restart — next tick retries. Never
    // throws into the UI; this is best-effort lifecycle plumbing, not a
    // user-facing feature.
  }
}

export function startSessionHeartbeat() {
  tick();
  setInterval(tick, HEARTBEAT_MS);
}
