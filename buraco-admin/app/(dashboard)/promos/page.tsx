'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { usePaginated } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import Empty from '@/components/ui/Empty';

interface Promo {
  id: string; code: string;
  rewardCoins: number; rewardDiamonds: number;
  maxUses: number | null; usedCount: number;
  isActive: boolean; expiresAt: string | null;
}

const EMPTY = { code: '', rewardCoins: '', rewardDiamonds: '', maxUses: '', expiresAt: '' };
const F     = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';

export default function PromosPage() {
  const [page, setPage]         = useState(1);
  const [showCreate, setCreate] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const createM = useMutation();
  const toggleM = useMutation();

  const { items: promos, totalPages, loading, refetch } = usePaginated<Promo>(
    '/admin/promos', { page, limit: 20 },
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await createM.run(() => api.post('/admin/promos', {
      code:           form.code.trim().toUpperCase(),
      rewardCoins:    form.rewardCoins    ? parseInt(form.rewardCoins)    : 0,
      rewardDiamonds: form.rewardDiamonds ? parseInt(form.rewardDiamonds) : 0,
      maxUses:        form.maxUses        ? parseInt(form.maxUses)        : undefined,
      expiresAt:      form.expiresAt      || undefined,
    }));
    if (ok) { toast.success('Promo created.'); setCreate(false); setForm(EMPTY); refetch(); }
    else    toast.error('Failed to create promo.');
  }

  async function toggle(p: Promo) {
    const ok = await toggleM.run(() =>
      api.patch(`/admin/promos/${p.id}/toggle`, { isActive: !p.isActive }),
    );
    if (ok) { toast.success(`Promo ${p.isActive ? 'deactivated' : 'activated'}.`); refetch(); }
    else    toast.error('Update failed.');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Promo Codes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage reward codes</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setCreate(true)}>New Promo</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : promos.length === 0 ? (
          <Empty message="No promo codes yet." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Code', 'Coins', 'Diamonds', 'Used', 'Limit', 'Expires', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {promos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.code}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{p.rewardCoins.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{p.rewardDiamonds.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{p.usedCount}</td>
                    <td className="px-4 py-3 text-slate-500">{p.maxUses ?? '∞'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggle(p)}
                        disabled={toggleM.loading}
                        className={`text-xs font-medium hover:underline disabled:opacity-40 ${p.isActive ? 'text-red-500' : 'text-emerald-600'}`}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-3">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <Modal title="New Promo Code" onClose={() => { setCreate(false); setForm(EMPTY); }} size="sm">
          <form onSubmit={handleCreate} className="space-y-3">
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Code — e.g. WELCOME50" className={`${F} font-mono`} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" value={form.rewardCoins}    onChange={(e) => setForm({ ...form, rewardCoins: e.target.value })}    placeholder="Coins reward"    className={F} />
              <input type="number" min="0" value={form.rewardDiamonds} onChange={(e) => setForm({ ...form, rewardDiamonds: e.target.value })} placeholder="Diamonds reward" className={F} />
            </div>
            <input type="number" min="1"  value={form.maxUses}   onChange={(e) => setForm({ ...form, maxUses: e.target.value })}   placeholder="Max uses (blank = unlimited)" className={F} />
            <input type="date"            value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={F} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={createM.loading}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => { setCreate(false); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
