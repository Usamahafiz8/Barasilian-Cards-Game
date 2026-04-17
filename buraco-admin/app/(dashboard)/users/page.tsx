'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Pagination from '@/components/ui/Pagination';
import Toast from '@/components/ui/Toast';

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
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    api.get('/admin/users', { params: { page: p, limit: 20, search: q || undefined } })
      .then((r) => {
        setUsers(r.data.data.data ?? []);
        setTotalPages(r.data.data.totalPages ?? 1);
      })
      .catch(() => {
        setUsers([]);
        setTotalPages(1);
        setToast({ message: 'Failed to load users.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, search); }, [load, page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search);
  }

  function closeModal() {
    setSelectedUser(null);
    setCreditAmount('');
    setBanReason('');
  }

  async function handleBan(user: User) {
    if (mutating) return;
    setMutating(true);
    try {
      const reason = user.isBanned ? undefined : (banReason.trim() || 'Banned by admin');
      await api.patch(`/admin/users/${user.id}/ban`, { isBanned: !user.isBanned, reason });
      setToast({
        message: user.isBanned ? `${user.username} unbanned.` : `${user.username} banned.`,
        type: 'success',
      });
      closeModal();
      load(page, search);
    } catch {
      setToast({ message: 'Failed to update ban status.', type: 'error' });
    } finally {
      setMutating(false);
    }
  }

  async function handleCredit(userId: string, type: 'credit' | 'deduct') {
    if (mutating) return;
    const amount = parseInt(creditAmount);
    if (!creditAmount || isNaN(amount) || amount <= 0) {
      setToast({ message: 'Enter a valid positive amount.', type: 'error' });
      return;
    }
    setMutating(true);
    try {
      await api.post(`/admin/users/${userId}/${type}`, { currency: creditCurrency, amount });
      setToast({ message: `${type === 'credit' ? 'Credited' : 'Deducted'} ${amount.toLocaleString()} ${creditCurrency.toLowerCase()}.`, type: 'success' });
      closeModal();
      load(page, search);
    } catch {
      setToast({ message: `Failed to ${type} currency.`, type: 'error' });
    } finally {
      setMutating(false);
    }
  }

  const PLAN_COLORS: Record<string, string> = {
    PREMIUM: 'bg-yellow-100 text-yellow-700',
    BASIC: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {users.length === 0 ? (
            <div className="text-gray-400 p-8 text-center">No users found.</div>
          ) : (
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
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[u.subscriptionStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {u.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isBanned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {u.isBanned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedUser(u)} className="text-blue-600 hover:underline text-xs">
                        Manage
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

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-1">Manage: {selectedUser.username}</h3>
            <p className="text-xs text-gray-400 mb-5">{selectedUser.email ?? 'No email'}</p>

            <div className="space-y-5">
              <section>
                <p className="text-sm font-semibold text-gray-700 mb-2">Credit / Deduct Currency</p>
                <div className="flex gap-2 mb-2">
                  <select
                    value={creditCurrency}
                    onChange={(e) => setCreditCurrency(e.target.value as 'COINS' | 'DIAMONDS')}
                    className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="COINS">Coins</option>
                    <option value="DIAMONDS">Diamonds</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="Amount"
                    className="border rounded px-2 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCredit(selectedUser.id, 'credit')}
                    disabled={mutating}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {mutating ? '…' : 'Credit'}
                  </button>
                  <button
                    onClick={() => handleCredit(selectedUser.id, 'deduct')}
                    disabled={mutating}
                    className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    {mutating ? '…' : 'Deduct'}
                  </button>
                </div>
              </section>

              <section>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {selectedUser.isBanned ? 'Unban User' : 'Ban User'}
                </p>
                {!selectedUser.isBanned && (
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Ban reason (optional)…"
                    className="border rounded px-2 py-1.5 text-sm w-full mb-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                )}
                <button
                  onClick={() => handleBan(selectedUser)}
                  disabled={mutating}
                  className={`px-3 py-1.5 rounded text-sm text-white disabled:opacity-50 ${selectedUser.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {mutating ? '…' : selectedUser.isBanned ? 'Unban User' : 'Ban User'}
                </button>
              </section>
            </div>

            <button onClick={closeModal} className="mt-5 text-sm text-gray-400 hover:text-gray-600 block">
              Close
            </button>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
