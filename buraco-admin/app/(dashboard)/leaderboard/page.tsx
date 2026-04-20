'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import api from '@/lib/api';
import { usePaginated } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import Empty from '@/components/ui/Empty';

interface LeaderboardEntry {
  rank:          number;
  userId:        string;
  username:      string;
  email:         string | null;
  avatarUrl:     string | null;
  isBanned:      boolean;
  level:         number;
  points:        number;
  gamesPlayed:   number;
  winPercentage: number;
  winStreak:     number;
  bestStreak:    number;
}

const SORT_OPTIONS = [
  { value: 'points',        label: 'Points' },
  { value: 'winPercentage', label: 'Win %' },
  { value: 'gamesPlayed',   label: 'Games Played' },
  { value: 'level',         label: 'Level' },
];

const INPUT_CLS = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';

export default function LeaderboardPage() {
  const [page, setPage]   = useState(1);
  const [sort, setSort]   = useState('points');

  const { items, totalPages, loading, refetch } = usePaginated<LeaderboardEntry>(
    '/admin/leaderboard', { page, limit: 20, sort },
  );

  const [resetTarget, setResetTarget]   = useState<LeaderboardEntry | null>(null);
  const [scoreTarget, setScoreTarget]   = useState<LeaderboardEntry | null>(null);
  const [newPoints,   setNewPoints]     = useState('');
  const [newLevel,    setNewLevel]      = useState('');

  const resetM = useMutation();
  const scoreM = useMutation();

  async function confirmReset() {
    if (!resetTarget) return;
    const ok = await resetM.run(() => api.post(`/admin/leaderboard/${resetTarget.userId}/reset`));
    if (ok) { toast.success(`Stats reset for ${resetTarget.username}`); setResetTarget(null); refetch(); }
    else    toast.error('Reset failed');
  }

  async function saveScore() {
    if (!scoreTarget) return;
    const pts = parseInt(newPoints);
    if (isNaN(pts) || pts < 0) { toast.error('Enter a valid points value'); return; }
    const ok = await scoreM.run(() =>
      api.patch(`/admin/leaderboard/${scoreTarget.userId}/score`, {
        points: pts,
        ...(newLevel.trim() && { level: parseInt(newLevel) }),
      }),
    );
    if (ok) { toast.success(`Score updated for ${scoreTarget.username}`); setScoreTarget(null); setNewPoints(''); setNewLevel(''); refetch(); }
    else    toast.error('Failed to update score');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">All player rankings — edit, reset, or set scores</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={10} cols={8} />
        ) : items.length === 0 ? (
          <Empty message="No players yet." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Player', 'Level', 'Points', 'Win %', 'Games', 'Streak', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((p) => (
                  <tr key={p.userId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${p.rank === 1 ? 'bg-amber-100 text-amber-700' : p.rank === 2 ? 'bg-slate-100 text-slate-600' : p.rank === 3 ? 'bg-orange-100 text-orange-600' : 'text-slate-400 font-normal'}`}>
                        {p.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${p.userId}`} className="font-medium text-slate-800 hover:text-blue-600">{p.username}</Link>
                      {p.email && <p className="text-xs text-slate-400">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.level}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">{p.points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{p.winPercentage.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-slate-700">{p.gamesPlayed}</td>
                    <td className="px-4 py-3 text-slate-700">{p.winStreak} <span className="text-slate-400 text-xs">(best {p.bestStreak})</span></td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isBanned ? 'red' : 'green'}>{p.isBanned ? 'Banned' : 'Active'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setScoreTarget(p); setNewPoints(String(p.points)); setNewLevel(String(p.level)); }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Set Score
                        </button>
                        <button
                          onClick={() => setResetTarget(p)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-3">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Set Score Modal */}
      {scoreTarget && (
        <Modal
          title={`Set Score — ${scoreTarget.username}`}
          description="Override this player's points and level directly."
          onClose={() => { setScoreTarget(null); setNewPoints(''); setNewLevel(''); }}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Points</label>
              <input
                type="number"
                min="0"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                placeholder="e.g. 5000"
                className={INPUT_CLS}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Level <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="number"
                min="1"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                placeholder="Leave blank to keep current"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setScoreTarget(null); setNewPoints(''); setNewLevel(''); }}>Cancel</Button>
              <Button variant="primary" size="sm" loading={scoreM.loading} onClick={saveScore}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Confirm Modal */}
      {resetTarget && (
        <Modal
          title={`Reset ${resetTarget.username}?`}
          description="All stats will be zeroed: points, level, games, streaks."
          onClose={() => setResetTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will set <strong>{resetTarget.username}</strong>'s points to 0, level to 1, and clear all game history stats. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={resetM.loading} onClick={confirmReset}>Reset Stats</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
