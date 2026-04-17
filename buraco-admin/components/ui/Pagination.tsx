import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page:       number;
  totalPages: number;
  onChange(p: number): void;
}

function PageBtn({ children, onClick, disabled, active }: {
  children: ReactNode; onClick(): void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-blue-600 text-white pointer-events-none'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} />
        </PageBtn>
        {pages.map((p) => (
          <PageBtn key={p} onClick={() => onChange(p)} active={p === page}>{p}</PageBtn>
        ))}
        <PageBtn onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          <ChevronRight size={14} />
        </PageBtn>
      </div>
    </div>
  );
}
