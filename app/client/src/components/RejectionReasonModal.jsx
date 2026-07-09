import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { registerRejectionReasonHandler } from '../rejectionReasonPrompt';

const MAX_LENGTH = 200;

export default function RejectionReasonModal() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const resolverRef = useRef(null);

  useEffect(() => {
    registerRejectionReasonHandler(() => {
      setReason('');
      setOpen(true);
      return new Promise((resolve) => { resolverRef.current = resolve; });
    });
  }, []);

  function settle(value) {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }

  function confirm(e) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    settle(trimmed);
  }

  if (!open) return null;

  return (
    <Modal title="Reason for rejection / withdrawal" onClose={() => settle(null)}>
      <form onSubmit={confirm}>
        <label className="field full">
          <span className="field-label">Reason *</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={3}
            autoFocus
            placeholder="e.g. Went with another candidate, didn't hear back, took a different offer…"
          />
          <span className="hint">{reason.length}/{MAX_LENGTH}</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => settle(null)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!reason.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
