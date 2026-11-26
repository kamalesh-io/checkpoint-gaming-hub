import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '@/stores/toastStore';
import { cn } from '@/utils/cn';

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle2; border: string; accent: string }> = {
  success: {
    icon: CheckCircle2,
    border: 'border-success/45',
    accent: 'text-success',
  },
  error: {
    icon: AlertCircle,
    border: 'border-error/45',
    accent: 'text-error',
  },
  warning: {
    icon: AlertCircle,
    border: 'border-warning/45',
    accent: 'text-warning',
  },
  info: {
    icon: Info,
    border: 'border-accent-active/45',
    accent: 'text-accent-active',
  },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const cfg = TOAST_STYLES[toast.type];
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-modal backdrop-blur-xl',
              'bg-secondary-background/95',
              cfg.border,
            )}
          >
            <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', cfg.accent)} />
            <div className="min-w-0 flex-1">
              <p className="text-label-md text-on-background font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="text-body-sm text-muted mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              data-nav-item="true"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 text-muted hover:text-on-background hover:bg-surface transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
