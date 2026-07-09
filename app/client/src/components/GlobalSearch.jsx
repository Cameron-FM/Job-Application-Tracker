import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useDebouncedValue } from '../hooks';
import { annotateResult } from '../searchUtils';

const DROPDOWN_LIMIT = 8;
const EMPTY = { results: [], total: 0 };

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [data, setData] = useState(EMPTY);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (debouncedQuery.length < 2) { setData(EMPTY); return; }
    let cancelled = false;
    api.get(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${DROPDOWN_LIMIT}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(EMPTY); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const results = data.results.map(annotateResult);
  const hasQuery = debouncedQuery.length >= 2;
  const showViewAll = hasQuery && data.total > 0;
  // Flatten results + the "view all" row into one navigable list for arrow keys.
  const items = showViewAll ? [...results, { key: 'view-all', isViewAll: true }] : results;

  useEffect(() => { setHighlighted(0); }, [data]);

  const close = useCallback(() => { setOpen(false); }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) close();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [close]);

  useEffect(() => {
    function onGlobalKeyDown(e) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isShortcut) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  function reset() {
    setQuery('');
    setData(EMPTY);
    close();
    inputRef.current?.blur();
  }

  function goTo(result) {
    if (!result || !result.to) return;
    navigate(result.to);
    reset();
  }

  function goToSearchPage() {
    const q = debouncedQuery;
    reset();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function activate(item) {
    if (!item) return;
    if (item.isViewAll) goToSearchPage();
    else goTo(item);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { close(); inputRef.current?.blur(); return; }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(items[highlighted]); }
  }

  return (
    <div className="global-search" ref={containerRef}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search everything…  (⌘K)"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && hasQuery && (
        <div className="global-search-results">
          {results.length === 0 ? (
            <div className="empty">No matches for "{debouncedQuery}"</div>
          ) : (
            <>
              {results.map((r, i) => (
                <div
                  key={r.key}
                  className={`list-row search-result${i === highlighted ? ' search-result-active' : ''}${!r.to ? ' search-result-disabled' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); goTo(r); }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span className="search-result-icon">{r.icon}</span>
                  <div className="list-main">
                    <div className="list-title">{r.title}</div>
                    {r.subtitle && <div className="list-sub">{r.subtitle}</div>}
                  </div>
                  <span className="search-type-tag">{r.typeLabel}</span>
                </div>
              ))}
              {showViewAll && (
                <div
                  className={`search-view-all${highlighted === items.length - 1 ? ' search-result-active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); goToSearchPage(); }}
                  onMouseEnter={() => setHighlighted(items.length - 1)}
                >
                  View all {data.total} result{data.total === 1 ? '' : 's'} →
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
