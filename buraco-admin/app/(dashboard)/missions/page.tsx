'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useMutation } from '@/hooks/useMutation';
import Badge from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import Empty from '@/components/ui/Empty';

interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY';
  requirement: string;
  targetValue: number;
  rewardCoins: number;
  rewardDiamonds: number;
  isActive: boolean;
}

const REQ_LABEL: Record<string, string> = {
  PLAY_GAMES: 'Play Games',
  WIN_GAMES: 'Win Games',
  EARN_POINTS: 'Earn Points',
  SEND_MESSAGES: 'Send Messages',
  JOIN_CLUB: 'Join Club',
  PLAY_CLASSIC: 'Play Classic',
  PLAY_PROFESSIONAL: 'Play Professional',
  WIN_STREAK: 'Win Streak',
};

export default function MissionsPage() {
  const { data, loading, refetch } = useFetch<Mission[]>('/admin/missions');
  const missions = data ?? [];
  const { run, loading: saving } = useMutation();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const daily  = missions.filter((m) => m.type === 'DAILY');
  const weekly = missions.filter((m) => m.type === 'WEEKLY');

  async function toggle(mission: Mission) {
    setTogglingId(mission.id);
    const ok = await run(() =>
      api.patch(`/admin/missions/${mission.id}/toggle`, { isActive: !mission.isActive }),
    );
    setTogglingId(null);
    if (ok) {
      toast.success(`"${mission.title}" ${mission.isActive ? 'deactivated' : 'activated'}`);
      refetch();
    } else {
      toast.error('Failed to update mission');
    }
  }

  function MissionTable({ items }: { items: Mission[] }) {
    if (items.length === 0) return <Empty message="No missions in this group." />;
    return (
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            {['Mission', 'Requirement', 'Target', 'Rewards', 'Status', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800 text-sm">{m.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  {REQ_LABEL[m.requirement] ?? m.requirement}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700 font-semibold text-sm">{m.targetValue}</td>
              <td className="px-4 py-3">
                {m.rewardCoins > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mr-1">
                    🪙 {m.rewardCoins}
                  </span>
                )}
                {m.rewardDiamonds > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    💎 {m.rewardDiamonds}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={m.isActive ? 'green' : 'gray'}>
                  {m.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => toggle(m)}
                  disabled={togglingId === m.id}
                  className={`text-xs font-semibold hover:underline disabled:opacity-50 ${
                    m.isActive ? 'text-red-500' : 'text-green-600'
                  }`}
                >
                  {togglingId === m.id ? '…' : m.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Missions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage daily and weekly player missions</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <TableSkeleton rows={10} cols={6} />
        </div>
      ) : missions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Empty message="No missions found. Run the seed to populate defaults." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Daily Missions</h2>
              <span className="text-xs text-slate-400">({daily.filter((m) => m.isActive).length} active / {daily.length} total)</span>
            </div>
            <MissionTable items={daily} />
          </div>

          {/* Weekly */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weekly Missions</h2>
              <span className="text-xs text-slate-400">({weekly.filter((m) => m.isActive).length} active / {weekly.length} total)</span>
            </div>
            <MissionTable items={weekly} />
          </div>
        </div>
      )}
    </div>
  );
}
