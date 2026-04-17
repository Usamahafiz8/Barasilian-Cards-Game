import { ReactNode } from 'react';

const V = {
  green:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  red:    'bg-red-50 text-red-600 ring-1 ring-red-500/20',
  yellow: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  blue:   'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  purple: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20',
  gray:   'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20',
};

export type BadgeVariant = keyof typeof V;

export default function Badge({ children, variant }: { children: ReactNode; variant: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${V[variant]}`}>
      {children}
    </span>
  );
}
