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
