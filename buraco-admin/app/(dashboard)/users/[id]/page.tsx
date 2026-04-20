'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface UserDetail {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  coins: number;
  diamonds: number;
  lives: number;
  subscriptionStatus: string;
  isBanned: boolean;
  banReason: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  stats: {
    level: number; points: number; gamesPlayed: number;
    winPercentage: number; winStreak: number; bestWinStreak: number;
  } | null;
  transactions: Array<{
    id: string; type: string; currency: string; amount: number;
    description: string | null; createdAt: string;
  }>;
  adminNotes: Array<{ id: string; content: string; adminId: string; createdAt: string }>;
}

interface ShopItem { id: string; name: string; category: string; }

const INPUT = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';
const TABS  = ['Overview', 'Transactions', 'Notes'] as const;
type Tab = typeof TABS[number];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const { data: user, loading, refetch } = useFetch<UserDetail>(`/admin/users/${id}`);
  const { data: shopData } = useFetch<{ data: ShopItem[] }>('/admin/shop/items?limit=100');
  const shopItems: ShopItem[] = (shopData as any)?.data ?? shopData ?? [];

  const [tab,      setTab]      = useState<Tab>('Overview');
  const [form,     setForm]     = useState({ username: '', email: '', lives: '', coins: '', diamonds: '', subscriptionStatus: '' });
  const [note,     setNote]     = useState('');
  const [banNote,  setBanNote]  = useState('');
  const [itemId,   setItemId]   = useState('');

  const editM    = useMutation();
  const banM     = useMutation();
  const noteM    = useMutation();
  const itemM    = useMutation();

  useEffect(() => {
    if (user) {
      setForm({
        username:           user.username,
        email:              user.email ?? '',
        lives:              String(user.lives),
        coins:              String(user.coins),
        diamonds:           String(user.diamonds),
        subscriptionStatus: user.subscriptionStatus,
      });
      if (shopItems.length && !itemId) setItemId(shopItems[0]?.id ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (shopItems.length && !itemId) setItemId(shopItems[0]?.id ?? '');
  }, [shopItems, itemId]);

  async function saveEdit() {
    const payload: Record<string, any> = {};
    if (form.username !== user!.username)           payload.username           = form.username;
    if (form.email    !== (user!.email ?? ''))       payload.email              = form.email || undefined;
    if (form.lives    !== String(user!.lives))       payload.lives              = parseInt(form.lives);
    if (form.coins    !== String(user!.coins))       payload.coins              = parseInt(form.coins);
    if (form.diamonds !== String(user!.diamonds))    payload.diamonds           = parseInt(form.diamonds);
    if (form.subscriptionStatus !== user!.subscriptionStatus) payload.subscriptionStatus = form.subscriptionStatus;

    if (!Object.keys(payload).length) { toast('No changes to save.'); return; }
    const ok = await editM.run(() => api.patch(`/admin/users/${id}`, payload));
    if (ok) { toast.success('User updated'); refetch(); }
    else    toast.error('Update failed');
  }

  async function toggleBan() {
    const ok = await banM.run(() =>
      api.patch(`/admin/users/${id}/ban`, {
        isBanned: !user!.isBanned,
        reason:   !user!.isBanned ? (banNote.trim() || 'Banned by admin') : undefined,
      }),
    );
    if (ok) { toast.success(user!.isBanned ? 'User unbanned' : 'User banned'); setBanNote(''); refetch(); }
    else    toast.error('Operation failed');
  }

  async function addNote() {
    if (!note.trim()) return;
    const ok = await noteM.run(() => api.post(`/admin/users/${id}/notes`, { content: note }));
    if (ok) { toast.success('Note added'); setNote(''); refetch(); }
    else    toast.error('Failed to add note');
  }

  async function sendItem() {
    if (!itemId) return;
    const ok = await itemM.run(() => api.post(`/admin/users/${id}/send-item`, { itemId }));
    if (ok) { toast.success('Item sent to user'); refetch(); }
    else    toast.error('Failed to send item');
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded-lg" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">User not found.</p>
        <Link href="/users" className="text-blue-600 hover:underline text-sm">← Back to Users</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{user.username}</h1>
          <p className="text-sm text-slate-400">{user.email ?? 'No email'} · ID: {user.id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.isBanned ? 'red' : 'green'}>{user.isBanned ? 'Banned' : 'Active'}</Badge>
          {user.subscriptionStatus !== 'FREE' && (
            <Badge variant="yellow">{user.subscriptionStatus}</Badge>
          )}
        </div>
      </div>

      {/* Stats row */}
      {user.stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Level',    val: user.stats.level },
            { label: 'Points',   val: user.stats.points.toLocaleString() },
            { label: 'Games',    val: user.stats.gamesPlayed },
            { label: 'Win %',    val: user.stats.winPercentage.toFixed(1) + '%' },
            { label: 'Streak',   val: user.stats.winStreak },
            { label: 'Best',     val: user.stats.bestWinStreak },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-slate-800">{val}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Overview ── */}
          {tab === 'Overview' && (
            <div className="space-y-6">
              {/* Edit fields */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Username</label>
                    <input className={INPUT} value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Email</label>
                    <input className={INPUT} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Coins</label>
                    <input type="number" min="0" className={INPUT} value={form.coins} onChange={(e) => setForm((p) => ({ ...p, coins: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Diamonds</label>
                    <input type="number" min="0" className={INPUT} value={form.diamonds} onChange={(e) => setForm((p) => ({ ...p, diamonds: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Lives</label>
                    <input type="number" min="0" className={INPUT} value={form.lives} onChange={(e) => setForm((p) => ({ ...p, lives: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Subscription</label>
                    <select className={INPUT} value={form.subscriptionStatus} onChange={(e) => setForm((p) => ({ ...p, subscriptionStatus: e.target.value }))}>
                      <option value="FREE">FREE</option>
                      <option value="BASIC">BASIC</option>
                      <option value="PREMIUM">PREMIUM</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <Button variant="primary" size="sm" loading={editM.loading} onClick={saveEdit}>Save Changes</Button>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Send item */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Send Shop Item</h3>
                <div className="flex gap-2">
                  <select
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {shopItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                    ))}
                  </select>
                  <Button variant="success" size="sm" loading={itemM.loading} onClick={sendItem}>Send Item</Button>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Ban */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {user.isBanned ? 'Restore Access' : 'Restrict Access'}
                </h3>
                {user.isBanned && user.banReason && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                    Ban reason: {user.banReason}
                  </p>
                )}
                {!user.isBanned && (
                  <input
                    value={banNote}
                    onChange={(e) => setBanNote(e.target.value)}
                    placeholder="Ban reason (optional)"
                    className={`${INPUT} mb-3`}
                  />
                )}
                <Button
                  variant={user.isBanned ? 'success' : 'danger'}
                  size="sm"
                  loading={banM.loading}
                  onClick={toggleBan}
                >
                  {user.isBanned ? 'Unban User' : 'Ban User'}
                </Button>
              </section>
            </div>
          )}

          {/* ── Transactions ── */}
          {tab === 'Transactions' && (
            <div>
              {user.transactions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Type', 'Currency', 'Amount', 'Description', 'Date'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {user.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/40">
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{tx.type.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2.5 text-slate-600">{tx.currency}</td>
                        <td className={`px-3 py-2.5 tabular-nums font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{tx.description ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {tab === 'Notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add an admin note…"
                  rows={3}
                  className={`${INPUT} resize-none flex-1`}
                />
                <Button variant="primary" size="sm" loading={noteM.loading} onClick={addNote}>Add Note</Button>
              </div>
              {user.adminNotes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {user.adminNotes.map((n) => (
                    <div key={n.id} className="bg-slate-50 rounded-lg px-4 py-3">
                      <p className="text-sm text-slate-700">{n.content}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
