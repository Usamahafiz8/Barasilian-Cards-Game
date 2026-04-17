import { ReactNode } from 'react';

const STYLES = {
  green:  'bg-green-50  text-green-700  ring-1 ring-inset ring-green-600/20',
  red:    'bg-red-50    text-red-600    ring-1 ring-inset ring-red-500/20',
  yellow: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
  blue:   'bg-blue-50   text-blue-700   ring-1 ring-inset ring-blue-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
  gray:   'bg-gray-50   text-gray-600   ring-1 ring-inset ring-gray-500/20',
};

export type BadgeVariant = keyof typeof STYLES;

interface Props {
  children: ReactNode;
  variant: BadgeVariant;
}

export default function Badge({ children, variant }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[variant]}`}>
      {children}
    </span>
  );
}
