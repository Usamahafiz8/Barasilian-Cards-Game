'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Toast from '@/components/ui/Toast';

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
const emptyForm = { name: '', category: 'CARDS', priceCoins: '', priceDiamonds: '', isConsumable: false, description: '' };

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    api.get('/admin/shop/items', { params: { limit: 100 } })
      .then((r) => setItems(r.data.data.data ?? r.data.data ?? []))
      .catch(() => {
        setItems([]);
        setToast({ message: 'Failed to load shop items.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/admin/shop/items', {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        priceCoins: form.priceCoins ? parseInt(form.priceCoins) : undefined,
        priceDiamonds: form.priceDiamonds ? parseInt(form.priceDiamonds) : undefined,
        isConsumable: form.isConsumable,
      });
      setShowCreate(false);
      setForm(emptyForm);
      setToast({ message: 'Shop item created.', type: 'success' });
      loadItems();
    } catch {
      setToast({ message: 'Failed to create shop item.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleItem(item: ShopItem) {
    if (toggling) return;
    setToggling(item.id);
    try {
      await api.patch(`/admin/shop/items/${item.id}/toggle`, { isActive: !item.isActive });
      setToast({ message: `"${item.name}" ${item.isActive ? 'deactivated' : 'activated'}.`, type: 'success' });
      loadItems();
    } catch {
      setToast({ message: 'Failed to update item status.', type: 'error' });
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Shop Items</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + New Item
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {items.length === 0 ? (
            <div className="text-gray-400 p-8 text-center">No shop items yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Name', 'Category', 'Coins', 'Diamonds', 'Type', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3">{item.priceCoins?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-3">{item.priceDiamonds?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-3">{item.isConsumable ? 'Consumable' : 'Permanent'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleItem(item)}
                        disabled={toggling === item.id}
                        className={`text-xs hover:underline disabled:opacity-50 ${item.isActive ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {toggling === item.id ? '…' : item.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Create Shop Item</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name"
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={form.priceCoins}
                  onChange={(e) => setForm({ ...form, priceCoins: e.target.value })}
                  placeholder="Price (Coins)"
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  value={form.priceDiamonds}
                  onChange={(e) => setForm({ ...form, priceDiamonds: e.target.value })}
                  placeholder="Price (Diamonds)"
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isConsumable}
                  onChange={(e) => setForm({ ...form, isConsumable: e.target.checked })}
                />
                Consumable
              </label>
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
