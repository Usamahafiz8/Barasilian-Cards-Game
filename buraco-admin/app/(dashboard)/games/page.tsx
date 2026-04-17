'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { usePaginated } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';

interface Game {
  id: string;
  mode: string;
  variant: string;
  status: string;
  startedAt: string | null;
  players: { userId: string }[];
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  WAITING:     'yellow',
  IN_PROGRESS: 'blue',
  COMPLETED:   'green',
  ABANDONED:   'gray',
  VOIDED:      'red',
};

const STATUSES = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'VOIDED'];

export default function GamesPage() {
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatus] = useState('');
  const [voidTarget, setVoidTarget] = useState<Game | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const voidMutation = useMutation();

  const { items: games, totalPages, loading, refetch } = usePaginated<Game>(
    '/admin/games',
    { page, limit: 20, status: statusFilter || undefined },
  );

  async function handleVoid() {
    if (!voidReason.trim()) { toast.error('Please enter a reason.'); return; }
    const ok = await voidMutation.run(() =>
      api.patch(`/admin/games/${voidTarget!.id}/void`, { reason: voidReason.trim() }),
    );
    if (ok) {
      toast.success('Game voided.');
      setVoidTarget(null);
      setVoidReason('');
      refetch();
    } else toast.error('Failed to void game.');
  }

  return (
    <div>
      <PageHeader title="Game Sessions" subtitle="Monitor and manage active game sessions" />

      {/* Filter */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : games.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No game sessions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Game ID', 'Mode', 'Variant', 'Status', 'Players', 'Started At', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {games.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-700">{g.mode}</td>
                  <td className="px-4 py-3 text-gray-700">{g.variant}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[g.status] ?? 'gray'}>{g.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{g.players.length}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {g.startedAt ? new Date(g.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {g.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => { setVoidTarget(g); setVoidReason(''); }}
                        className="text-red-500 hover:underline text-xs font-medium"
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
        {!loading && games.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Void confirm modal */}
      {voidTarget && (
        <Modal title="Void Game" onClose={() => setVoidTarget(null)} size="sm">
          <p className="text-xs text-gray-400 font-mono mb-4">{voidTarget.id}</p>
          <input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason for voiding…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <Button variant="danger" loading={voidMutation.loading} onClick={handleVoid}>
              Confirm Void
            </Button>
            <Button variant="ghost" onClick={() => setVoidTarget(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
