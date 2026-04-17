'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

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

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'CARDS', priceCoins: '', priceDiamonds: '', isConsumable: false, description: '' });

  function loadItems() {
    setLoading(true);
    api.get('/shop/items', { params: { limit: 100 } }).then((r) => setItems(r.data.data.data ?? r.data.data)).finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/admin/shop/items', {
      name: form.name,
      category: form.category,
      description: form.description || undefined,
      priceCoins: form.priceCoins ? parseInt(form.priceCoins) : undefined,
      priceDiamonds: form.priceDiamonds ? parseInt(form.priceDiamonds) : undefined,
      isConsumable: form.isConsumable,
    });
    setShowCreate(false);
    setForm({ name: '', category: 'CARDS', priceCoins: '', priceDiamonds: '', isConsumable: false, description: '' });
    loadItems();
  }

  async function toggleItem(item: ShopItem) {
    await api.patch(`/admin/shop/items/${item.id}/toggle`, { isActive: !item.isActive });
    loadItems();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Shop Items</h2>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ New Item</button>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
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
                    <button onClick={() => toggleItem(item)} className={`text-xs hover:underline ${item.isActive ? 'text-red-500' : 'text-green-600'}`}>
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Create Shop Item</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="border rounded px-3 py-2 text-sm w-full" />
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="border rounded px-3 py-2 text-sm w-full" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded px-3 py-2 text-sm w-full">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" value={form.priceCoins} onChange={(e) => setForm({ ...form, priceCoins: e.target.value })} placeholder="Price (Coins)" className="border rounded px-3 py-2 text-sm flex-1" />
                <input type="number" value={form.priceDiamonds} onChange={(e) => setForm({ ...form, priceDiamonds: e.target.value })} placeholder="Price (Diamonds)" className="border rounded px-3 py-2 text-sm flex-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isConsumable} onChange={(e) => setForm({ ...form, isConsumable: e.target.checked })} />
                Consumable
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
