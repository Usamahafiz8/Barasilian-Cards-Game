interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
}

export default function StatCard({ label, value, icon, color = 'bg-blue-600' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-6 flex items-center gap-4">
      <div className={`${color} text-white rounded-full w-12 h-12 flex items-center justify-center text-xl`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
}
