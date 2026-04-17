'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import { TableSkeleton } from '@/components/ui/Skeleton';
import Empty from '@/components/ui/Empty';

interface Config { id: string; key: string; value: string; updatedAt: string; }

export default function ConfigPage() {
  const { data, loading, refetch } = useFetch<Config[]>('/admin/config');
  const configs = data ?? [];

  const [editing,   setEditing]   = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { run } = useMutation();

  function startEdit(key: string, val: string) {
    setEditing((p) => ({ ...p, [key]: val }));
  }

  function cancelEdit(key: string) {
    setEditing((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  async function save(key: string) {
    setSavingKey(key);
    const ok = await run(() => api.put(`/admin/config/${key}`, { value: editing[key] }));
    setSavingKey(null);
    if (ok) { toast.success(`"${key}" saved.`); cancelEdit(key); refetch(); }
    else    toast.error(`Failed to save "${key}".`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">System Config</h1>
        <p className="text-sm text-slate-500 mt-0.5">Runtime configuration values</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : configs.length === 0 ? (
          <Empty message="No config entries found." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Key', 'Value', 'Last Updated', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {configs.map((cfg) => (
                <tr key={cfg.key} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 w-72">{cfg.key}</td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <input
                        value={editing[cfg.key]}
                        onChange={(e) => setEditing((p) => ({ ...p, [cfg.key]: e.target.value }))}
                        className="rounded-lg border border-blue-300 ring-1 ring-blue-300 px-2.5 py-1.5 text-sm w-56 outline-none bg-white"
                      />
                    ) : (
                      <span className="font-medium text-slate-900">{cfg.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(cfg.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => save(cfg.key)}
                          disabled={savingKey === cfg.key}
                          className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {savingKey === cfg.key ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit(cfg.key)}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(cfg.key, cfg.value)}
                        className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
