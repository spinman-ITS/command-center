import { cn } from "@/shared/lib/utils";
import { CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

let toastId = 0;
let addToastFn: ((message: string) => void) | null = null;

export function showToast(message: string) {
  addToastFn?.(message);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-[#0d121e]/95 px-4 py-3 text-sm text-emerald-100 shadow-xl backdrop-blur-md",
            "animate-[slideIn_0.2s_ease-out]",
          )}
        >
          <CheckCircle2 className="size-4 text-emerald-400" />
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="text-slate-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
