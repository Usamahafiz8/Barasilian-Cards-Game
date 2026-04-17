'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import Empty from '@/components/ui/Empty';

interface ShopItem {
  id: string; name: string; category: string;
  priceCoins: number | null; priceDiamonds: number | null;
  isActive: boolean; isConsumable: boolean;
}

const CATS   = ['HOME', 'SUBSCRIPTIONS', 'COINS', 'EMOJIS', 'TABLES', 'CARDS', 'SPECIAL', 'REDEEM'];
const EMPTY  = { name: '', category: 'CARDS', priceCoins: '', priceDiamonds: '', isConsumable: false, description: '' };
const F      = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';

export default function ShopPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const createM  = useMutation();
  const toggleM  = useMutation();

  const { data, loading, refetch } = useFetch<{ data: ShopItem[] } | ShopItem[]>('/admin/shop/items', { limit: 100 });
  const items: ShopItem[] = Array.isArray(data) ? data : (data as { data: ShopItem[] } | null)?.data ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await createM.run(() => api.post('/admin/shop/items', {
      name: form.name.trim(), category: form.category,
      description: form.description.trim() || undefined,
      priceCoins:    form.priceCoins    ? parseInt(form.priceCoins)    : undefined,
      priceDiamonds: form.priceDiamonds ? parseInt(form.priceDiamonds) : undefined,
      isConsumable: form.isConsumable,
    }));
    if (ok) { toast.success('Item created.'); setShowCreate(false); setForm(EMPTY); refetch(); }
    else    toast.error('Failed to create item.');
  }

  async function toggle(item: ShopItem) {
    const ok = await toggleM.run(() =>
      api.patch(`/admin/shop/items/${item.id}/toggle`, { isActive: !item.isActive }),
    );
    if (ok) { toast.success(`"${item.name}" ${item.isActive ? 'deactivated' : 'activated'}.`); refetch(); }
    else    toast.error('Update failed.');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Shop</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage purchasable items</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Item</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : items.length === 0 ? (
          <Empty message="No shop items yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Category', 'Coins', 'Diamonds', 'Type', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3"><Badge variant="blue">{item.category}</Badge></td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{item.priceCoins?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{item.priceDiamonds?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.isConsumable ? 'purple' : 'gray'}>
                      {item.isConsumable ? 'Consumable' : 'Permanent'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={item.isActive ? 'green' : 'gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(item)}
                      disabled={toggleM.loading}
                      className={`text-xs font-medium hover:underline disabled:opacity-40 ${item.isActive ? 'text-red-500' : 'text-emerald-600'}`}
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal title="New Shop Item" onClose={() => { setShowCreate(false); setForm(EMPTY); }}>
          <form onSubmit={handleCreate} className="space-y-3">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" className={F} />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className={F} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={F}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" value={form.priceCoins}    onChange={(e) => setForm({ ...form, priceCoins: e.target.value })}    placeholder="Coins price"    className={F} />
              <input type="number" min="0" value={form.priceDiamonds} onChange={(e) => setForm({ ...form, priceDiamonds: e.target.value })} placeholder="Diamonds price" className={F} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.isConsumable} onChange={(e) => setForm({ ...form, isConsumable: e.target.checked })} className="rounded" />
              Consumable item
            </label>
            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={createM.loading}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
