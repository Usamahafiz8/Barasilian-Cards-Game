import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export function useFetch<T>(url: string, params?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paramsKey = JSON.stringify(params ?? {});

  const refetch = useCallback(() => {
    setLoading(true);
    setError(false);
    api
      .get(url, params ? { params } : undefined)
      .then((r) => setData(r.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function usePaginated<T>(url: string, params: Record<string, unknown>) {
  const { data, loading, error, refetch } = useFetch<{
    data: T[];
    totalPages: number;
    total?: number;
  }>(url, params);

  return {
    items: data?.data ?? [],
    totalPages: data?.totalPages ?? 1,
    loading,
    error,
    refetch,
  };
}
