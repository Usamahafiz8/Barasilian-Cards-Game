import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  Icon:  LucideIcon;
  color: string;
}

export default function StatCard({ label, value, Icon, color }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
