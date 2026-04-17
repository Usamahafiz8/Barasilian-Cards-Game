'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import PageHeader from '@/components/ui/PageHeader';

interface Config {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export default function ConfigPage() {
  const { data, loading, refetch } = useFetch<Config[]>('/admin/config');
  const configs = data ?? [];

  const [editing, setEditing] = useState<Record<string, string>>({});
  const { run, loading: saving } = useMutation();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function startEdit(key: string, value: string) {
    setEditing((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit(key: string) {
    setEditing((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function save(key: string) {
    setSavingKey(key);
    const ok = await run(() => api.put(`/admin/config/${key}`, { value: editing[key] }));
    setSavingKey(null);
    if (ok) { toast.success(`"${key}" saved.`); cancelEdit(key); refetch(); }
    else toast.error(`Failed to save "${key}".`);
  }

  return (
    <div>
      <PageHeader title="System Config" subtitle="Manage runtime configuration values" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : configs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No config entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Key', 'Value', 'Last Updated', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {configs.map((cfg) => (
                <tr key={cfg.key} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 w-64">{cfg.key}</td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <input
                        value={editing[cfg.key]}
                        onChange={(e) => setEditing((p) => ({ ...p, [cfg.key]: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{cfg.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(cfg.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => save(cfg.key)}
                          disabled={saving && savingKey === cfg.key}
                          className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                        >
                          {saving && savingKey === cfg.key ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit(cfg.key)}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(cfg.key, cfg.value)}
                        className="text-xs font-medium text-blue-600 hover:underline"
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
