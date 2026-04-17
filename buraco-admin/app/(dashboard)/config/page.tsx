'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Toast from '@/components/ui/Toast';

interface Config {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadConfigs = useCallback(() => {
    setLoading(true);
    api.get('/admin/config')
      .then((r) => setConfigs(r.data.data ?? []))
      .catch(() => setToast({ message: 'Failed to load configuration.', type: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  function startEdit(key: string, value: string) {
    setEditing((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit(key: string) {
    setEditing((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function save(key: string) {
    setSaving(key);
    try {
      await api.put(`/admin/config/${key}`, { value: editing[key] });
      setConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value: editing[key] } : c)));
      cancelEdit(key);
      setToast({ message: `Config "${key}" saved.`, type: 'success' });
    } catch {
      setToast({ message: `Failed to save "${key}". Please try again.`, type: 'error' });
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">System Configuration</h2>

      {configs.length === 0 ? (
        <div className="text-gray-400 bg-white rounded-xl shadow p-8 text-center">No config entries found.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Key', 'Value', 'Last Updated', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {configs.map((cfg) => (
                <tr key={cfg.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{cfg.key}</td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <input
                        value={editing[cfg.key]}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="font-medium">{cfg.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(cfg.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {editing[cfg.key] !== undefined ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => save(cfg.key)}
                          disabled={saving === cfg.key}
                          className="text-green-600 hover:underline text-xs disabled:opacity-50"
                        >
                          {saving === cfg.key ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => cancelEdit(cfg.key)}
                          disabled={saving === cfg.key}
                          className="text-gray-400 hover:underline text-xs disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(cfg.key, cfg.value)} className="text-blue-600 hover:underline text-xs">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
