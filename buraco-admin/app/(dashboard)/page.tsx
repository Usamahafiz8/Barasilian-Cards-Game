'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, UserX, Gamepad2, Zap, Diamond, TrendingUp, UserPlus, Calendar } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import StatCard from '@/components/ui/StatCard';
import { StatSkeleton } from '@/components/ui/Skeleton';

interface TopPlayer { id: string; username: string; avatarUrl: string | null; points: number; level: number; winPercentage: number; }

interface Stats {
  totalUsers:    number;
  activeUsers:   number;
  bannedUsers:   number;
  totalGames:    number;
  activeGames:   number;
  totalRevenue:  number;
  newUsersToday: number;
  gamesToday:    number;
  topPlayers:    TopPlayer[];
}

const ZERO: Stats = {
  totalUsers: 0, activeUsers: 0, bannedUsers: 0,
  totalGames: 0, activeGames: 0, totalRevenue: 0,
  newUsersToday: 0, gamesToday: 0, topPlayers: [],
};

export default function DashboardPage() {
  const { data, loading, error } = useFetch<Stats>('/admin/dashboard');

  useEffect(() => {
    if (error) toast.error('Could not load dashboard stats. Is the backend running?');
  }, [error]);

  if (loading) return <StatSkeleton />;

  const s = data ?? ZERO;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"       value={s.totalUsers}    Icon={Users}      color="bg-blue-600" />
        <StatCard label="Active (24h)"       value={s.activeUsers}   Icon={TrendingUp} color="bg-emerald-600" />
        <StatCard label="New Today"          value={s.newUsersToday} Icon={UserPlus}   color="bg-cyan-600" />
        <StatCard label="Banned Users"       value={s.bannedUsers}   Icon={UserX}      color="bg-red-500" />
        <StatCard label="Total Games"        value={s.totalGames}    Icon={Gamepad2}   color="bg-violet-600" />
        <StatCard label="Live Games"         value={s.activeGames}   Icon={Zap}        color="bg-amber-500" />
        <StatCard label="Games Today"        value={s.gamesToday}    Icon={Calendar}   color="bg-orange-500" />
        <StatCard label="Revenue (Diamonds)" value={s.totalRevenue}  Icon={Diamond}    color="bg-indigo-600" />
      </div>

      {/* Top Players + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Players */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Top Players</h2>
            <Link href="/leaderboard" className="text-xs text-blue-600 hover:underline font-medium">View all →</Link>
          </div>
          {s.topPlayers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No player data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Player', 'Level', 'Points', 'Win %'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {s.topPlayers.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'text-slate-400'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/users/${p.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                        {p.username}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.level}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-800">{p.points.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.winPercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Quick Actions</h2>
          {[
            { href: '/leaderboard', label: 'View Leaderboard',  desc: 'Player rankings & stats' },
            { href: '/users',       label: 'Manage Users',      desc: 'Search, edit, ban players' },
            { href: '/config',      label: 'System Config',     desc: 'Game settings & credentials' },
            { href: '/broadcast',   label: 'Broadcast Message', desc: 'Notify all players' },
            { href: '/shop',        label: 'Manage Shop',       desc: 'Items, pricing, inventory' },
            { href: '/audit',       label: 'Audit Logs',        desc: 'Admin action history' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <span className="text-slate-300 group-hover:text-blue-400 text-base">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
