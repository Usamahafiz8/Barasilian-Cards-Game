import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export function useFetch<T>(url: string, params?: Record<string, unknown>) {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [tick,    setTick]    = useState(0);

  const paramsStr = JSON.stringify(params ?? {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = params ? JSON.parse(paramsStr) : undefined;
    api.get(url, parsed ? { params: parsed } : undefined)
      .then((r) => {
        if (!cancelled) { setData(r.data.data); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsStr, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}

/** Convenience wrapper for paginated endpoints that return { data: T[], totalPages: number } */
export function usePaginated<T>(url: string, params: Record<string, unknown>) {
  const { data, loading, error, refetch } =
    useFetch<{ data: T[]; totalPages: number }>(url, params);

  return {
    items:      data?.data       ?? ([] as T[]),
    totalPages: data?.totalPages ?? 1,
    loading,
    error,
    refetch,
  };
}
