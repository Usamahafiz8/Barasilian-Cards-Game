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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => setStats(r.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-red-500">Failed to load stats.</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Users" value={stats.totalUsers} icon="👥" color="bg-blue-600" />
        <StatCard label="Active (24h)" value={stats.activeUsers} icon="🟢" color="bg-green-600" />
        <StatCard label="Banned Users" value={stats.bannedUsers} icon="🚫" color="bg-red-500" />
        <StatCard label="Total Games" value={stats.totalGames} icon="🎮" color="bg-purple-600" />
        <StatCard label="Live Games" value={stats.activeGames} icon="⚡" color="bg-yellow-500" />
        <StatCard label="Total Revenue (Diamonds)" value={stats.totalRevenue} icon="💎" color="bg-indigo-600" />
      </div>
    </div>
  );
}
