interface Props {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 6, cols = 5 }: Props) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-3.5 rounded bg-slate-100 flex-1" style={{ maxWidth: c === 0 ? 120 : undefined }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-24" />
      ))}
    </div>
  );
}
