import { ButtonHTMLAttributes, ReactNode } from 'react';

const VARIANT = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
  danger:    'bg-red-500  text-white hover:bg-red-600  active:bg-red-700',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700',
  outline:   'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100',
  ghost:     'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
};

const SIZE = {
  sm: 'h-8  px-3   text-xs  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
  lg: 'h-10 px-5   text-sm  gap-2',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT;
  size?:    keyof typeof SIZE;
  loading?: boolean;
  icon?:    ReactNode;
  children: ReactNode;
}

export default function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  icon,
  disabled,
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed select-none
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon}
      {loading ? 'Loading…' : children}
    </button>
  );
}
