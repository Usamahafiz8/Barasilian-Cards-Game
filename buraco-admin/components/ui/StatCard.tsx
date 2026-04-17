interface Props {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
  hint?: string;
}

export default function StatCard({ label, value, icon, color = 'bg-blue-600', hint }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`${color} rounded-xl w-11 h-11 flex items-center justify-center text-lg shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
