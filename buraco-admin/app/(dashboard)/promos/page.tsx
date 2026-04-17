'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Pagination from '@/components/ui/Pagination';
import Toast from '@/components/ui/Toast';

interface Promo {
  id: string;
  code: string;
  rewardCoins: number;
  rewardDiamonds: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

const emptyForm = { code: '', rewardCoins: '', rewardDiamonds: '', maxUses: '', expiresAt: '' };

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadPromos = useCallback((p: number) => {
    setLoading(true);
    api.get('/admin/promos', { params: { page: p, limit: 20 } })
      .then((r) => {
        setPromos(r.data.data.data ?? []);
        setTotalPages(r.data.data.totalPages ?? 1);
      })
      .catch(() => {
        setPromos([]);
        setTotalPages(1);
        setToast({ message: 'Failed to load promo codes.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPromos(page); }, [loadPromos, page]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/admin/promos', {
        code: form.code.trim().toUpperCase(),
        rewardCoins: form.rewardCoins ? parseInt(form.rewardCoins) : 0,
        rewardDiamonds: form.rewardDiamonds ? parseInt(form.rewardDiamonds) : 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm);
      setToast({ message: 'Promo code created.', type: 'success' });
      loadPromos(page);
    } catch {
      setToast({ message: 'Failed to create promo code.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePromo(promo: Promo) {
    if (toggling) return;
    setToggling(promo.id);
    try {
      await api.patch(`/admin/promos/${promo.id}/toggle`, { isActive: !promo.isActive });
      setToast({ message: `Promo ${promo.isActive ? 'deactivated' : 'activated'}.`, type: 'success' });
      loadPromos(page);
    } catch {
      setToast({ message: 'Failed to update promo status.', type: 'error' });
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Promo Codes</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + New Promo
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {promos.length === 0 ? (
            <div className="text-gray-400 p-8 text-center">No promo codes yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Code', 'Coins', 'Diamonds', 'Uses', 'Max Uses', 'Expires', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold">{p.code}</td>
                    <td className="px-4 py-3">{p.rewardCoins.toLocaleString()}</td>
                    <td className="px-4 py-3">{p.rewardDiamonds.toLocaleString()}</td>
                    <td className="px-4 py-3">{p.usedCount}</td>
                    <td className="px-4 py-3">{p.maxUses ?? '∞'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePromo(p)}
                        disabled={toggling === p.id}
                        className={`text-xs hover:underline disabled:opacity-50 ${p.isActive ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {toggling === p.id ? '…' : p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Create Promo Code</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Code (e.g. WELCOME2024)"
                className="border rounded px-3 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={form.rewardCoins}
                  onChange={(e) => setForm({ ...form, rewardCoins: e.target.value })}
                  placeholder="Coins reward"
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  value={form.rewardDiamonds}
                  onChange={(e) => setForm({ ...form, rewardDiamonds: e.target.value })}
                  placeholder="Diamonds reward"
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Max uses (blank = unlimited)"
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setForm(emptyForm); }}
                  className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
