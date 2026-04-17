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

interface User {
  id: string;
  username: string;
  email: string | null;
  coins: number;
  diamonds: number;
  subscriptionStatus: string;
  isBanned: boolean;
  lastSeenAt: string | null;
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function planBadge(status: string) {
  if (status === 'PREMIUM') return <Badge variant="yellow">PREMIUM</Badge>;
  if (status === 'BASIC')   return <Badge variant="blue">BASIC</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export default function UsersPage() {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery]   = useState('');

  const { items: users, totalPages, loading, refetch } = usePaginated<User>(
    '/admin/users',
    { page, limit: 20, search: query || undefined },
  );

  const [selected, setSelected] = useState<User | null>(null);
  const [amount, setAmount]     = useState('');
  const [currency, setCurrency] = useState<'COINS' | 'DIAMONDS'>('COINS');
  const [banReason, setBanReason] = useState('');

  const banMutation    = useMutation();
  const creditMutation = useMutation();
  const deductMutation = useMutation();

  function openModal(u: User) {
    setSelected(u);
    setAmount('');
    setBanReason('');
  }

  async function handleCredit(type: 'credit' | 'deduct') {
    const n = parseInt(amount);
    if (!amount || isNaN(n) || n <= 0) { toast.error('Enter a valid positive amount.'); return; }
    const mut = type === 'credit' ? creditMutation : deductMutation;
    const ok = await mut.run(() =>
      api.post(`/admin/users/${selected!.id}/${type}`, { currency, amount: n }),
    );
    if (ok) { toast.success(`${type === 'credit' ? 'Credited' : 'Deducted'} ${n.toLocaleString()} ${currency.toLowerCase()}.`); setSelected(null); refetch(); }
    else toast.error('Currency operation failed.');
  }

  async function handleBan() {
    const ok = await banMutation.run(() =>
      api.patch(`/admin/users/${selected!.id}/ban`, {
        isBanned: !selected!.isBanned,
        reason: !selected!.isBanned ? (banReason.trim() || 'Banned by admin') : undefined,
      }),
    );
    if (ok) {
      toast.success(selected!.isBanned ? `${selected!.username} unbanned.` : `${selected!.username} banned.`);
      setSelected(null);
      refetch();
    } else toast.error('Ban operation failed.');
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Search and manage player accounts" />

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search); }}
        className="flex gap-2 mb-6"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button type="submit">Search</Button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Username', 'Email', 'Coins', 'Diamonds', 'Plan', 'Status', 'Last Seen', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{u.coins.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{u.diamonds.toLocaleString()}</td>
                  <td className="px-4 py-3">{planBadge(u.subscriptionStatus)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isBanned ? 'red' : 'green'}>
                      {u.isBanned ? 'Banned' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openModal(u)} className="text-blue-600 hover:underline text-xs font-medium">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Manage modal */}
      {selected && (
        <Modal title={`Manage: ${selected.username}`} onClose={() => setSelected(null)}>
          <div className="space-y-6">
            {/* Currency */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Currency</p>
              <div className="flex gap-2 mb-3">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'COINS' | 'DIAMONDS')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COINS">Coins</option>
                  <option value="DIAMONDS">Diamonds</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className={`flex-1 ${INPUT}`}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="success" size="sm" loading={creditMutation.loading} onClick={() => handleCredit('credit')}>
                  Credit
                </Button>
                <Button variant="danger" size="sm" loading={deductMutation.loading} onClick={() => handleCredit('deduct')}>
                  Deduct
                </Button>
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* Ban */}
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {selected.isBanned ? 'Unban User' : 'Ban User'}
              </p>
              {!selected.isBanned && (
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Ban reason (optional)…"
                  className={`${INPUT} mb-3`}
                />
              )}
              <Button
                variant={selected.isBanned ? 'success' : 'danger'}
                size="sm"
                loading={banMutation.loading}
                onClick={handleBan}
              >
                {selected.isBanned ? 'Unban User' : 'Ban User'}
              </Button>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
