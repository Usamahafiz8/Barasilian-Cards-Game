import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export function useFetch<T>(url: string, params?: Record<string, unknown>) {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  // stringify params so the effect re-runs when values change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = JSON.stringify(params ?? {});

  const refetch = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get(url, params ? { params } : undefined)
      .then((r) => { setData(r.data.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  useEffect(() => { refetch(); }, [refetch]);

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
