'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { usePaginated } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';

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

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const EMPTY = { code: '', rewardCoins: '', rewardDiamonds: '', maxUses: '', expiresAt: '' };

export default function PromosPage() {
  const [page, setPage]         = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const createMutation          = useMutation();
  const toggleMutation          = useMutation();

  const { items: promos, totalPages, loading, refetch } = usePaginated<Promo>(
    '/admin/promos',
    { page, limit: 20 },
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await createMutation.run(() =>
      api.post('/admin/promos', {
        code:           form.code.trim().toUpperCase(),
        rewardCoins:    form.rewardCoins    ? parseInt(form.rewardCoins)    : 0,
        rewardDiamonds: form.rewardDiamonds ? parseInt(form.rewardDiamonds) : 0,
        maxUses:        form.maxUses        ? parseInt(form.maxUses)        : undefined,
        expiresAt:      form.expiresAt      || undefined,
      }),
    );
    if (ok) { toast.success('Promo code created.'); setShowCreate(false); setForm(EMPTY); refetch(); }
    else toast.error('Failed to create promo code.');
  }

  async function togglePromo(promo: Promo) {
    const ok = await toggleMutation.run(() =>
      api.patch(`/admin/promos/${promo.id}/toggle`, { isActive: !promo.isActive }),
    );
    if (ok) { toast.success(`Promo ${promo.isActive ? 'deactivated' : 'activated'}.`); refetch(); }
    else toast.error('Failed to update promo.');
  }

  return (
    <div>
      <PageHeader
        title="Promo Codes"
        subtitle="Create and manage discount and reward codes"
        action={<Button onClick={() => setShowCreate(true)}>+ New Promo</Button>}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : promos.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No promo codes yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Code', 'Coins', 'Diamonds', 'Used', 'Limit', 'Expires', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{p.code}</td>
                  <td className="px-4 py-3 text-gray-700">{p.rewardCoins.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{p.rewardDiamonds.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{p.usedCount}</td>
                  <td className="px-4 py-3 text-gray-500">{p.maxUses ?? '∞'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePromo(p)}
                      disabled={toggleMutation.loading}
                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${p.isActive ? 'text-red-500' : 'text-green-600'}`}
                    >
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && promos.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Create Promo Code" onClose={() => { setShowCreate(false); setForm(EMPTY); }} size="sm">
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="Code — e.g. WELCOME50"
              className={`${INPUT} font-mono`}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" value={form.rewardCoins}    onChange={(e) => setForm({ ...form, rewardCoins: e.target.value })}    placeholder="Coins reward"    className={INPUT} />
              <input type="number" min="0" value={form.rewardDiamonds} onChange={(e) => setForm({ ...form, rewardDiamonds: e.target.value })} placeholder="Diamonds reward" className={INPUT} />
            </div>
            <input type="number" min="1" value={form.maxUses}   onChange={(e) => setForm({ ...form, maxUses: e.target.value })}   placeholder="Max uses (blank = unlimited)" className={INPUT} />
            <input type="date"             value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={INPUT} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={createMutation.loading}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
