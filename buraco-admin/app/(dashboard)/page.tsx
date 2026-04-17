'use client';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import { useFetch } from '@/hooks/useFetch';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalGames: number;
  activeGames: number;
  totalRevenue: number;
}

const ZERO: Stats = { totalUsers: 0, activeUsers: 0, bannedUsers: 0, totalGames: 0, activeGames: 0, totalRevenue: 0 };

export default function DashboardPage() {
  const { data, loading, error } = useFetch<Stats>('/admin/dashboard');

  useEffect(() => {
    if (error) toast.error('Could not load dashboard stats.');
  }, [error]);

  const s = data ?? ZERO;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview at a glance" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Users"     value={s.totalUsers}   icon="👤" color="bg-blue-600" />
        <StatCard label="Active (24h)"    value={s.activeUsers}  icon="🟢" color="bg-green-600" />
        <StatCard label="Banned Users"    value={s.bannedUsers}  icon="🚫" color="bg-red-500" />
        <StatCard label="Total Games"     value={s.totalGames}   icon="🎮" color="bg-purple-600" />
        <StatCard label="Live Games"      value={s.activeGames}  icon="⚡" color="bg-yellow-500" />
        <StatCard label="Revenue (Diamonds)" value={s.totalRevenue} icon="💎" color="bg-indigo-600" />
      </div>
    </div>
  );
}
