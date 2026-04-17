import { useState } from 'react';

export function useMutation() {
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    if (loading) return false;
    setLoading(true);
    try {
      await fn();
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading };
}
