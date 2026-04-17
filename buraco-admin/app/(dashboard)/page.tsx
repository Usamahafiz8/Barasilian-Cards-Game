'use client';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, UserX, Gamepad2, Zap, Diamond, TrendingUp } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import StatCard from '@/components/ui/StatCard';
import { StatSkeleton } from '@/components/ui/Skeleton';

interface Stats {
  totalUsers:   number;
  activeUsers:  number;
  bannedUsers:  number;
  totalGames:   number;
  activeGames:  number;
  totalRevenue: number;
}

const ZERO: Stats = { totalUsers: 0, activeUsers: 0, bannedUsers: 0, totalGames: 0, activeGames: 0, totalRevenue: 0 };

export default function DashboardPage() {
  const { data, loading, error } = useFetch<Stats>('/admin/dashboard');

  useEffect(() => {
    if (error) toast.error('Could not load dashboard stats. Is the backend running?');
  }, [error]);

  if (loading) return <StatSkeleton />;

  const s = data ?? ZERO;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard label="Total Users"        value={s.totalUsers}   Icon={Users}      color="bg-blue-600" />
        <StatCard label="Active (24h)"        value={s.activeUsers}  Icon={TrendingUp} color="bg-emerald-600" />
        <StatCard label="Banned Users"        value={s.bannedUsers}  Icon={UserX}      color="bg-red-500" />
        <StatCard label="Total Games"         value={s.totalGames}   Icon={Gamepad2}   color="bg-violet-600" />
        <StatCard label="Live Games"          value={s.activeGames}  Icon={Zap}        color="bg-amber-500" />
        <StatCard label="Revenue (Diamonds)"  value={s.totalRevenue} Icon={Diamond}    color="bg-indigo-600" />
      </div>
    </div>
  );
}
