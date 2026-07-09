import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

export function useFetch(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    api.get(url).then(setData).catch((e) => setError(e.message));
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
