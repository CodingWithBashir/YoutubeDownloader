"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (title: string, description?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconFor = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (title: string, description?: string, tone: ToastTone = "info") => {
      const id = Math.random().toString(36).slice(2);
      setItems((current) => [...current.slice(-2), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-3">
        {items.map((item) => {
          const Icon = iconFor[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "pointer-events-auto animate-scale-in rounded-2xl border bg-surface/95 p-4 shadow-lift backdrop-blur-xl",
                item.tone === "error" ? "border-danger/30" : item.tone === "success" ? "border-success/30" : "border-line",
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", item.tone === "error" ? "text-danger" : item.tone === "success" ? "text-success" : "text-teal")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  {item.description && <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>}
                </div>
                <button onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
