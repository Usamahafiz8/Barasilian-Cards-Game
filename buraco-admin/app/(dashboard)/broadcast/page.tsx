'use client';
import { useState } from 'react';
import api from '@/lib/api';

export default function BroadcastPage() {
  const [form, setForm] = useState({ title: '', body: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/admin/broadcast', form);
      setResult(res.data.data.message);
      setForm({ title: '', body: '' });
    } catch {
      setResult('Failed to send broadcast.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Broadcast Notification</h2>
      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <p className="text-sm text-gray-500 mb-4">Send a push notification to all active users.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. New Update Available" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Notification body..." />
          </div>
          {result && (
            <div className={`text-sm px-3 py-2 rounded ${result.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {result}
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Sending...' : '📢 Send Broadcast'}
          </button>
        </form>
      </div>
    </div>
  );
}
