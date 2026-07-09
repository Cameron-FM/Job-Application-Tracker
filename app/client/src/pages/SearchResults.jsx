import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useDebouncedValue } from '../hooks';
import { annotateResult, RECORD_TYPES } from '../searchUtils';
import { fmtDate } from '../utils';

const PAGE_LIMIT = 200;

const TYPE_FILTERS = [
  { id: '', label: 'All' },
  ...Object.entries(RECORD_TYPES).map(([id, meta]) => ({ id, label: meta.plural })),
];

const SORTS = {
  relevance: (a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''),
  newest: (a, b) => (b.date || '').localeCompare(a.date || ''),
  name: (a, b) => a.title.localeCompare(b.title),
};

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(urlQuery);
  const [type, setType] = useState('');
  const [sort, setSort] = useState('relevance');
  const [results, setResults] = useState(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const navigate = useNavigate();

  useEffect(() => { setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true }); }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); return; }
    let cancelled = false;
    api.get(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${PAGE_LIMIT}`)
      .then((res) => { if (!cancelled) setResults(res.results.map(annotateResult)); })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    if (!results) return [];
    return results.filter((r) => !type || r.type === type).sort(SORTS[sort]);
  }, [results, type, sort]);

  const counts = useMemo(() => {
    const c = {};
    for (const r of results || []) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [results]);

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate(-1)}>← Back</button>

      <div className="page-header">
        <h1>Search results</h1>
      </div>

      <input
        className="search search-page-input"
        type="search"
        placeholder="Search everything…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {debouncedQuery.length >= 2 && (
        <>
          <div className="toolbar search-filters">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id || 'all'}
                className={`btn btn-sm${type === f.id ? ' btn-primary' : ''}`}
                onClick={() => setType(f.id)}
              >
                {f.label}{f.id && counts[f.id] ? ` (${counts[f.id]})` : ''}
              </button>
            ))}
            <span className="spacer" />
            <span className="muted-small">Sort:</span>
            {Object.keys(SORTS).map((s) => (
              <button
                key={s}
                className={`btn btn-sm${sort === s ? ' btn-primary' : ''}`}
                onClick={() => setSort(s)}
              >
                {s === 'relevance' ? 'Relevance' : s === 'newest' ? 'Newest' : 'Name A–Z'}
              </button>
            ))}
          </div>

          <div className="card">
            {results === null ? (
              <div className="empty">Searching…</div>
            ) : filtered.length === 0 ? (
              <div className="empty">No matches for "{debouncedQuery}"</div>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.key}
                  className={`list-row search-result${!r.to ? ' search-result-disabled' : ''}`}
                  onClick={() => { if (!r.to) return; if (r.external) window.open(r.to, '_blank', 'noopener'); else navigate(r.to); }}
                >
                  <span className="search-result-icon">{r.icon}</span>
                  <div className="list-main">
                    <div className="list-title">{r.title}</div>
                    {r.subtitle && <div className="list-sub">{r.subtitle}</div>}
                  </div>
                  <div className="list-side">
                    {r.date && <span className="muted-small">{fmtDate(r.date)}</span>}
                    <span className="search-type-tag">{r.typeLabel}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
