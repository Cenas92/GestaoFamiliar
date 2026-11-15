import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-xl',
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${maxWidthClass}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}
