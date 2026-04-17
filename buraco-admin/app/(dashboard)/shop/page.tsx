'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';

interface ShopItem {
  id: string;
  name: string;
  category: string;
  priceCoins: number | null;
  priceDiamonds: number | null;
  isActive: boolean;
  isConsumable: boolean;
}

const CATEGORIES = ['HOME', 'SUBSCRIPTIONS', 'COINS', 'EMOJIS', 'TABLES', 'CARDS', 'SPECIAL', 'REDEEM'];
const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const EMPTY_FORM = { name: '', category: 'CARDS', priceCoins: '', priceDiamonds: '', isConsumable: false, description: '' };

export default function ShopPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation();
  const toggleMutation = useMutation();

  const { data, loading, refetch } = useFetch<{ data: ShopItem[] }>('/admin/shop/items', { limit: 100 });
  const items = data?.data ?? (data as unknown as ShopItem[]) ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await createMutation.run(() =>
      api.post('/admin/shop/items', {
        name:          form.name.trim(),
        category:      form.category,
        description:   form.description.trim() || undefined,
        priceCoins:    form.priceCoins    ? parseInt(form.priceCoins)    : undefined,
        priceDiamonds: form.priceDiamonds ? parseInt(form.priceDiamonds) : undefined,
        isConsumable:  form.isConsumable,
      }),
    );
    if (ok) { toast.success('Item created.'); setShowCreate(false); setForm(EMPTY_FORM); refetch(); }
    else toast.error('Failed to create item.');
  }

  async function toggleItem(item: ShopItem) {
    const ok = await toggleMutation.run(() =>
      api.patch(`/admin/shop/items/${item.id}/toggle`, { isActive: !item.isActive }),
    );
    if (ok) { toast.success(`"${item.name}" ${item.isActive ? 'deactivated' : 'activated'}.`); refetch(); }
    else toast.error('Failed to update item.');
  }

  return (
    <div>
      <PageHeader
        title="Shop Items"
        subtitle="Manage purchasable items and their prices"
        action={<Button onClick={() => setShowCreate(true)}>+ New Item</Button>}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No shop items yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Name', 'Category', 'Coins', 'Diamonds', 'Type', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3"><Badge variant="blue">{item.category}</Badge></td>
                  <td className="px-4 py-3 text-gray-700">{item.priceCoins?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.priceDiamonds?.toLocaleString() ?? '—'}</td>
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
                      onClick={() => toggleItem(item)}
                      disabled={toggleMutation.loading}
                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${item.isActive ? 'text-red-500' : 'text-green-600'}`}
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
        <Modal title="Create Shop Item" onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
          <form onSubmit={handleCreate} className="space-y-3">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" className={INPUT} />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className={INPUT} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" value={form.priceCoins} onChange={(e) => setForm({ ...form, priceCoins: e.target.value })} placeholder="Coins price" className={INPUT} />
              <input type="number" min="0" value={form.priceDiamonds} onChange={(e) => setForm({ ...form, priceDiamonds: e.target.value })} placeholder="Diamonds price" className={INPUT} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isConsumable} onChange={(e) => setForm({ ...form, isConsumable: e.target.checked })} className="rounded" />
              Consumable item
            </label>
            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={createMutation.loading}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
