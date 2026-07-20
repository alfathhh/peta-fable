import { useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 disabled:bg-emerald-300',
    secondary: 'border border-stone-300 bg-white text-stone-700 shadow-sm hover:border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  }[variant];
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ label, error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>}
      <input
        className={`w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:bg-stone-100 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Textarea({ label, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>}
      <textarea
        className={`w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 ${className}`}
        rows={3}
        {...props}
      />
    </label>
  );
}

export function Select({ label, children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>}
      <select
        className={`w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-emerald-700 ${className}`} />;
}

export function LoadingState({ text = 'Memuat...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-stone-500">
      <Spinner /> {text}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-sm text-stone-500">{text}</div>;
}

export function ErrorState({ text = 'Gagal memuat data.', onRetry }: { text?: string; onRetry?: () => void }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"><p>{text}</p>{onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>Coba lagi</Button>}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-tight text-stone-950">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-stone-500">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}

export function Panel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`} {...props} />;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm [&_table]:min-w-[680px] [&_thead]:bg-stone-50/80 [&_th]:whitespace-nowrap [&_th]:text-stone-500 [&_tbody]:divide-y [&_tbody]:divide-stone-100 [&_tr]:transition-colors [&_tbody_tr:hover]:bg-stone-50/60">{children}</div>;
}

export function IconButton({ label, variant = 'neutral', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: 'neutral' | 'danger' | 'success' }) {
  const tone = variant === 'danger' ? 'text-red-600 hover:bg-red-50' : variant === 'success' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900';
  return <button aria-label={label} title={label} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${tone} ${className}`} {...props} />;
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const color = { neutral: 'bg-stone-100 text-stone-600', success: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-red-700', info: 'bg-sky-50 text-sky-700' }[tone];
  return <span className={`inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${color}`}>{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previousFocus.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-stone-950/45 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-stone-200 bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
      >
        <div className="sticky -top-5 z-10 mb-4 flex items-center justify-between border-b border-stone-100 bg-white py-4">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-stone-900">{title}</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-500',
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[1300] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${colors[t.type]}`}
        >
          <span>{t.message}</span>
          <button onClick={() => remove(t.id)} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
