import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

export type ToastInput =
  | {
      type: ToastType;
      title: string;
      description?: string;
    }
  | {
      tone: 'success' | 'error' | 'accent' | 'neutral' | 'warning' | 'info';
      title: string;
      message?: string;
    };

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const normalizedType: ToastType =
      'type' in toast
        ? toast.type
        : toast.tone === 'error'
        ? 'error'
        : toast.tone === 'warning'
        ? 'warning'
        : 'success';

    const normalizedDesc =
      'description' in toast ? toast.description : 'message' in toast ? toast.message : undefined;

    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, type: normalizedType, title: toast.title, description: normalizedDesc }],
    }));

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4200);
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
