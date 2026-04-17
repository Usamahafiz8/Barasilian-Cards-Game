'use client';
import { useState } from 'react';
import { usePaginated } from '@/hooks/useFetch';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  admin: { name: string; email: string; role: string };
}

export default function AuditPage() {
  const [page, setPage] = useState(1);

  const { items: logs, totalPages, loading } = usePaginated<AuditLog>(
    '/admin/audit-logs',
    { page, limit: 50 },
  );

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Full history of admin actions" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No audit logs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Time', 'Admin', 'Action', 'Target', 'Details'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{log.admin.name}</p>
                    <Badge variant="gray">{log.admin.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 text-xs">{log.targetType}</p>
                    <p className="font-mono text-xs text-gray-400">{log.targetId.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && logs.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
