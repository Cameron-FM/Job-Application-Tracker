import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Text holders that may get visually cut off. The clip check below gates whether
// a tooltip actually shows, so listing an element that happens to fit is harmless
// — add classes here freely and new truncated spots are covered automatically.
const SELECTOR = [
  '.td-truncate', '.td-subtle', '.kanban-card-summary', '.kanban-card-title',
  '.kanban-card-company', '.list-title', '.list-sub', '.side-item-title', '[data-tip]',
].join(',');

// True when the element's content overflows its box — horizontally (ellipsis)
// or vertically (line-clamp). The +1 avoids sub-pixel false positives.
function isClipped(el) {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

// A single global tooltip: on hover over any clipped text, it shows the full text
// in a small card that follows the cursor. Positions itself directly via a ref so
// cursor movement doesn't trigger React re-renders.
export default function TextTooltip() {
  const boxRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;

    const place = (x, y) => {
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      let left = x + 14;
      let top = y + 16;
      if (left + w > window.innerWidth - 6) left = x - 14 - w;
      if (left < 6) left = 6;
      if (top + h > window.innerHeight - 6) top = y - 16 - h;
      if (top < 6) top = 6;
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
    };

    const hide = () => {
      if (!activeRef.current) return;
      activeRef.current = null;
      box.classList.remove('show');
    };

    const onMove = (e) => {
      const el = e.target.closest?.(SELECTOR);
      if (!el || !isClipped(el)) { hide(); return; }
      if (el !== activeRef.current) {
        activeRef.current = el;
        box.textContent = (el.getAttribute('data-tip') || el.innerText || '').trim();
        box.classList.add('show');
      }
      place(e.clientX, e.clientY);
    };

    document.addEventListener('mousemove', onMove);
    // Any scroll can slide the text out from under the cursor — just hide.
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  return createPortal(<div ref={boxRef} className="text-tooltip" />, document.body);
}
