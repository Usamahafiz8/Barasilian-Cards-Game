'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Pagination from '@/components/ui/Pagination';

interface User {
  id: string;
  username: string;
  email: string | null;
  coins: number;
  diamonds: number;
  subscriptionStatus: string;
  isBanned: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditCurrency, setCreditCurrency] = useState<'COINS' | 'DIAMONDS'>('COINS');
  const [banReason, setBanReason] = useState('');

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    api.get('/admin/users', { params: { page: p, limit: 20, search: q || undefined } })
      .then((r) => { setUsers(r.data.data.data ?? []); setTotalPages(r.data.data.totalPages ?? 1); })
      .catch(() => { setUsers([]); setTotalPages(1); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, search); }, [load, page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search);
  }

  async function handleBan(user: User) {
    const reason = user.isBanned ? undefined : (banReason || 'Banned by admin');
    await api.patch(`/admin/users/${user.id}/ban`, { isBanned: !user.isBanned, reason });
    load(page, search);
    setSelectedUser(null);
  }

  async function handleCredit(userId: string, type: 'credit' | 'deduct') {
    await api.post(`/admin/users/${userId}/${type}`, { currency: creditCurrency, amount: parseInt(creditAmount) });
    setCreditAmount('');
    setSelectedUser(null);
    load(page, search);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Search</button>
      </form>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Username', 'Email', 'Coins', 'Diamonds', 'Plan', 'Status', 'Last Seen', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{u.coins.toLocaleString()}</td>
                  <td className="px-4 py-3">{u.diamonds.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.subscriptionStatus === 'PREMIUM' ? 'bg-yellow-100 text-yellow-700' : u.subscriptionStatus === 'BASIC' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isBanned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {u.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedUser(u)} className="text-blue-600 hover:underline text-xs">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Manage: {selectedUser.username}</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Credit / Deduct Currency</p>
                <div className="flex gap-2 mb-2">
                  <select value={creditCurrency} onChange={(e) => setCreditCurrency(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                    <option value="COINS">Coins</option>
                    <option value="DIAMONDS">Diamonds</option>
                  </select>
                  <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="Amount" className="border rounded px-2 py-1 text-sm flex-1" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCredit(selectedUser.id, 'credit')} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">Credit</button>
                  <button onClick={() => handleCredit(selectedUser.id, 'deduct')} className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600">Deduct</button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Ban User</p>
                {!selectedUser.isBanned && (
                  <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Ban reason..." className="border rounded px-2 py-1 text-sm w-full mb-2" />
                )}
                <button onClick={() => handleBan(selectedUser)} className={`px-3 py-1.5 rounded text-sm text-white ${selectedUser.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                  {selectedUser.isBanned ? 'Unban User' : 'Ban User'}
                </button>
              </div>
            </div>

            <button onClick={() => setSelectedUser(null)} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
