import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismiss = useAppStore((state) => state.dismissToast);
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[340px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "toast-enter pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-pop)]",
            toast.tone === "error"
              ? "border-[var(--danger-line)]"
              : toast.tone === "success"
                ? "border-[var(--success-line)]"
                : "border-[var(--line)]",
          )}
        >
          <span
            className={cn(
              "mt-0.5",
              toast.tone === "error"
                ? "text-[var(--danger)]"
                : toast.tone === "success"
                  ? "text-[var(--success)]"
                  : "text-[var(--blue)]",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle size={14} />
            ) : toast.tone === "success" ? (
              <CheckCircle2 size={14} />
            ) : (
              <Info size={14} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-[var(--ink)]">{toast.title}</div>
            {toast.description && (
              <div className="mt-0.5 break-words text-[10px] leading-relaxed text-[var(--muted)]">
                {toast.description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label={t("toast.close")}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
