'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalGames: number;
  activeGames: number;
  totalRevenue: number;
}

const ZERO_STATS: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  bannedUsers: 0,
  totalGames: 0,
  activeGames: 0,
  totalRevenue: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((r) => setStats(r.data.data ?? ZERO_STATS))
      .catch(() => { setStats(ZERO_STATS); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse p-4">Loading dashboard…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        {error && (
          <span className="text-xs text-red-500 bg-red-50 px-3 py-1 rounded-full">
            Could not reach backend — showing cached zeros
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Users" value={stats!.totalUsers} icon="👥" color="bg-blue-600" />
        <StatCard label="Active (24h)" value={stats!.activeUsers} icon="🟢" color="bg-green-600" />
        <StatCard label="Banned Users" value={stats!.bannedUsers} icon="🚫" color="bg-red-500" />
        <StatCard label="Total Games" value={stats!.totalGames} icon="🎮" color="bg-purple-600" />
        <StatCard label="Live Games" value={stats!.activeGames} icon="⚡" color="bg-yellow-500" />
        <StatCard label="Total Revenue (Diamonds)" value={stats!.totalRevenue} icon="💎" color="bg-indigo-600" />
      </div>
    </div>
  );
}
