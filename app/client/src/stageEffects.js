// Fires a window event when a job's stage crosses into one of these "worth celebrating"
// transitions. Decoupled from rendering on purpose — StageCelebration.jsx (mounted once in
// Layout.jsx, so it's live on every page) is the only thing that listens and shows an effect.
// Call this from anywhere a job's stage is patched; it's a no-op for any other transition.
export const STAGE_CELEBRATION_EVENT = 'job-stage-celebration';

// User preference (Settings page), device-local, on by default — absence of the key means
// enabled, so existing users who've never touched the toggle keep seeing celebrations.
const CELEBRATIONS_ENABLED_KEY = 'celebrations-enabled';

export function isCelebrationEnabled() {
  return localStorage.getItem(CELEBRATIONS_ENABLED_KEY) !== '0';
}

export function setCelebrationEnabled(enabled) {
  localStorage.setItem(CELEBRATIONS_ENABLED_KEY, enabled ? '1' : '0');
}

// The "before any interview" stages vs. the "interview is happening" stages — crossing from the
// former into the latter is what triggers the 'interview' celebration below (moving *within* the
// interview stages, e.g. Screening → Interviewing, does not re-trigger it). Kept as explicit lists
// rather than derived from STAGES, since this is about meaning, not stage order — update these if
// you add/rename a stage that should count as one side or the other.
const PRE_INTERVIEW_STAGES = ['Interested', 'Applied'];
const INTERVIEW_STAGES = ['Screening', 'Interviewing', 'Final Interview'];

export function celebrateStageChange(oldStage, newStage) {
  if (!isCelebrationEnabled()) return;
  let level = null;
  if (newStage === 'Accepted' && oldStage !== 'Accepted') level = 'accepted';
  else if (INTERVIEW_STAGES.includes(newStage) && PRE_INTERVIEW_STAGES.includes(oldStage)) level = 'interview';
  if (level) window.dispatchEvent(new CustomEvent(STAGE_CELEBRATION_EVENT, { detail: { level } }));
}
