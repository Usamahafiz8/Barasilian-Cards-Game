'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Pagination from '@/components/ui/Pagination';
import Toast from '@/components/ui/Toast';

interface Game {
  id: string;
  mode: string;
  variant: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  players: { userId: string; teamId: number; result: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ABANDONED: 'bg-gray-100 text-gray-600',
  VOIDED: 'bg-red-100 text-red-600',
};

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState<Game | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((p: number, s: string) => {
    setLoading(true);
    api.get('/admin/games', { params: { page: p, limit: 20, status: s || undefined } })
      .then((r) => {
        setGames(r.data.data.data ?? []);
        setTotalPages(r.data.data.totalPages ?? 1);
      })
      .catch(() => {
        setGames([]);
        setTotalPages(1);
        setToast({ message: 'Failed to load games.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, statusFilter); }, [load, page, statusFilter]);

  async function handleVoid() {
    if (!voidTarget || !voidReason.trim() || voiding) return;
    setVoiding(true);
    try {
      await api.patch(`/admin/games/${voidTarget.id}/void`, { reason: voidReason.trim() });
      setToast({ message: `Game ${voidTarget.id.slice(0, 8)} voided.`, type: 'success' });
      setVoidTarget(null);
      setVoidReason('');
      load(page, statusFilter);
    } catch {
      setToast({ message: 'Failed to void game.', type: 'error' });
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Game Sessions</h2>

      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'VOIDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {games.length === 0 ? (
            <div className="text-gray-400 p-8 text-center">No games found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID', 'Mode', 'Variant', 'Status', 'Players', 'Started', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {games.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{g.mode}</td>
                    <td className="px-4 py-3">{g.variant}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[g.status] ?? 'bg-gray-100'}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{g.players.length}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {g.startedAt ? new Date(g.startedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => { setVoidTarget(g); setVoidReason(''); }}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Void
                        </button>
                      )}
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

      {voidTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold mb-1">Void Game</h3>
            <p className="text-xs text-gray-400 mb-3 font-mono">{voidTarget.id}</p>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding…"
              className="border rounded px-3 py-2 text-sm w-full mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim() || voiding}
                className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50"
              >
                {voiding ? 'Voiding…' : 'Confirm Void'}
              </button>
              <button
                onClick={() => { setVoidTarget(null); setVoidReason(''); }}
                className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
