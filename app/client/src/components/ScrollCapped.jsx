import { useRef, useState, useLayoutEffect, useCallback } from 'react';

// Caps a list (or a multi-column CSS grid) to roughly `rows` rows of content:
// shrinks to fit when there's less, becomes a scrollable region with a
// bouncing "more below" hint when there's more. Row boundaries are measured
// live off the DOM (grouping children by their rendered top position) rather
// than assumed from a hardcoded pixel height, so it stays correct regardless
// of per-item height (e.g. wrapped text) or how many columns a grid is
// currently rendering (which itself changes responsively) — a ResizeObserver
// re-measures whenever the container's size changes.
export default function ScrollCapped({ rows = 3, className = '', children }) {
  const containerRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.children.length === 0) {
      setMaxHeight(null);
      setOverflowing(false);
      return;
    }
    const containerTop = el.getBoundingClientRect().top - el.scrollTop;
    const tops = [...new Set(
      Array.from(el.children).map((c) => Math.round(c.getBoundingClientRect().top - containerTop))
    )].sort((a, b) => a - b);
    if (tops.length <= rows) {
      setMaxHeight(null);
      setOverflowing(false);
      return;
    }
    setMaxHeight(tops[rows]);
    setOverflowing(true);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  }, [rows]);

  useLayoutEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  };

  return (
    <div className="scroll-capped">
      <div
        ref={containerRef}
        className={className}
        style={maxHeight != null ? { maxHeight, overflowY: 'auto', overflowX: 'hidden' } : undefined}
        onScroll={overflowing ? onScroll : undefined}
      >
        {children}
      </div>
      {overflowing && !atBottom && (
        <div className="scroll-more-indicator" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}
    </div>
  );
}
