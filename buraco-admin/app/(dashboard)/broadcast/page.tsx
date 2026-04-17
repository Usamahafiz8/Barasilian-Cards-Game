'use client';
import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useMutation } from '@/hooks/useMutation';
import Button from '@/components/ui/Button';

const F = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white';

export default function BroadcastPage() {
  const [form, setForm]  = useState({ title: '', body: '' });
  const { run, loading } = useMutation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => api.post('/admin/broadcast', form));
    if (ok) { toast.success('Broadcast sent to all users.'); setForm({ title: '', body: '' }); }
    else    toast.error('Failed to send broadcast.');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Broadcast</h1>
        <p className="text-sm text-slate-500 mt-0.5">Push a notification to all active players</p>
      </div>

      <div className="max-w-md">
        {/* Warning */}
        <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            This sends a push notification to <strong>all</strong> registered users. Use carefully.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Title
              </label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. New season has started!"
                className={F}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Message
              </label>
              <textarea
                required
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Notification body…"
                className={`${F} resize-none`}
              />
            </div>
            <Button
              type="submit"
              loading={loading}
              icon={<Send size={14} />}
              className="w-full justify-center"
            >
              Send Broadcast
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
