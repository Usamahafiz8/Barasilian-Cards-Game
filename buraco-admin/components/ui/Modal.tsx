'use client';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

const WIDTH = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

interface Props {
  title:       string;
  description?: string;
  onClose():   void;
  children:    ReactNode;
  size?:       keyof typeof WIDTH;
  footer?:     ReactNode;
}

export default function Modal({ title, description, onClose, children, size = 'md', footer }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${WIDTH[size]} bg-white rounded-2xl shadow-2xl flex flex-col`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Body */}
        <div className="px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-5 py-4 flex items-center gap-2 justify-end">{footer}</div>
          </>
        )}
      </div>
    </div>
  );
}
