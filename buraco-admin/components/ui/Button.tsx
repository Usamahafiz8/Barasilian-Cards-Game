import { ButtonHTMLAttributes, ReactNode } from 'react';

const STYLES = {
  primary:   'bg-blue-600  text-white hover:bg-blue-700  focus-visible:ring-blue-500',
  danger:    'bg-red-500   text-white hover:bg-red-600   focus-visible:ring-red-400',
  success:   'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
  secondary: 'bg-white     text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-300',
  ghost:     'text-gray-500 hover:bg-gray-100 focus-visible:ring-gray-300',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2   text-sm',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof STYLES;
  size?: keyof typeof SIZES;
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${STYLES[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <span className="opacity-70">…</span> : children}
    </button>
  );
}
