// A window.confirm()-style async prompt, but for the one required text field: why a job is
// being marked Rejected/Withdrawn. RejectionReasonModal.jsx (mounted once in Layout.jsx) is the
// only thing that actually renders the modal — it registers itself as the handler here on mount.
// Call sites just `await askRejectionReason()` and get back the trimmed reason, or null if the
// user cancelled (in which case the caller should abort the stage change entirely).
let openHandler = null;

export function registerRejectionReasonHandler(handler) {
  openHandler = handler;
}

export function askRejectionReason() {
  if (!openHandler) return Promise.resolve(null);
  return openHandler();
}
