'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Pagination from '@/components/ui/Pagination';

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: object | null;
  createdAt: string;
  admin: { name: string; email: string; role: string };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/audit-logs', { params: { page, limit: 50 } })
      .then((r) => { setLogs(r.data.data.data); setTotalPages(r.data.data.totalPages); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h2>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Time', 'Admin', 'Action', 'Target', 'Details'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.admin.name}</div>
                    <div className="text-gray-400 text-xs">{log.admin.role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-mono">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{log.targetType}</div>
                    <div className="font-mono text-xs">{log.targetId.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
