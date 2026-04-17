'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useMutation } from '@/hooks/useMutation';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';

const INPUT = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function BroadcastPage() {
  const [form, setForm]   = useState({ title: '', body: '' });
  const { run, loading }  = useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => api.post('/admin/broadcast', form));
    if (ok) {
      toast.success('Broadcast sent to all users.');
      setForm({ title: '', body: '' });
    } else {
      toast.error('Failed to send broadcast.');
    }
  }

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="Send a push notification to all active players" />

      <div className="max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <span className="text-yellow-500 text-lg mt-0.5">⚠</span>
          <p className="text-sm text-yellow-700">
            This will send a push notification to <strong>all</strong> registered users.
            Use carefully.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Title
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. New Update Available"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Message
            </label>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Notification body…"
              className={`${INPUT} resize-none`}
            />
          </div>
          <Button type="submit" loading={loading} className="w-full justify-center">
            📢 Send Broadcast
          </Button>
        </form>
      </div>
    </div>
  );
}
