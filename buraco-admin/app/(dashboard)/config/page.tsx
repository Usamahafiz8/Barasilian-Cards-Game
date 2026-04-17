'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Config { id: string; key: string; value: string; updatedAt: string; }

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/config').then((r) => setConfigs(r.data.data)).finally(() => setLoading(false));
  }, []);

  function startEdit(key: string, value: string) {
    setEditing((prev) => ({ ...prev, [key]: value }));
  }

  async function save(key: string) {
    setSaving(key);
    await api.put(`/admin/config/${key}`, { value: editing[key] });
    setConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value: editing[key] } : c)));
    setEditing((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setSaving(null);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">System Configuration</h2>
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
                      className="border rounded px-2 py-1 text-sm w-48"
                    />
                  ) : (
                    <span className="font-medium">{cfg.value}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(cfg.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {editing[cfg.key] !== undefined ? (
                    <div className="flex gap-2">
                      <button onClick={() => save(cfg.key)} disabled={saving === cfg.key} className="text-green-600 hover:underline text-xs">
                        {saving === cfg.key ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[cfg.key]; return n; })} className="text-gray-400 hover:underline text-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(cfg.key, cfg.value)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
