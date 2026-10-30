import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Checkbox, Input } from "./ui";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import type { FilterOption } from "@/lib/types";

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchable = true,
  maxLabel = 1,
}: {
  options: FilterOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder: string;
  searchable?: boolean;
  maxLabel?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(needle));
  }, [options, query]);

  const label = useMemo(() => {
    if (selected.length === 0) return placeholder;
    const names = selected.map(
      (id) => options.find((option) => option.id === id)?.name ?? `#${id}`,
    );
    if (names.length <= maxLabel) return names.join(", ");
    return `${names.slice(0, maxLabel).join(", ")} +${names.length - maxLabel}`;
  }, [selected, options, placeholder, maxLabel]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "focus-ring flex h-8 w-full items-center justify-between gap-2 rounded-[7px] border bg-[var(--surface)] px-2.5 text-left text-xs transition-colors hover:border-[var(--line-strong)]",
          selected.length
            ? "border-[var(--accent-line)] text-[var(--ink)]"
            : "border-[var(--line)] text-[var(--muted)]",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("common.clear")}
              className="rounded-full p-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
              onClick={(event) => {
                event.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange([]);
                }
              }}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-[9px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
          {searchable && (
            <div className="border-b border-[var(--line)] p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("multiSelect.search")}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
            </div>
          )}
          <div className="thin-scroll max-h-56 overflow-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-[var(--muted)]">
                {t("multiSelect.noMatches")}
              </div>
            )}
            {filtered.slice(0, 250).map((option) => (
              <div
                key={option.id}
                className="flex cursor-pointer items-center justify-between rounded-[6px] px-2 py-1.5 hover:bg-[var(--surface-2)]"
                onClick={() => {
                  onChange(
                    selected.includes(option.id)
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id],
                  );
                }}
              >
                <Checkbox
                  checked={selected.includes(option.id)}
                  onChange={() => undefined}
                  label={<span className="text-[11px]">{option.name}</span>}
                />
                <span className="font-mono text-[10px] text-[var(--muted)]">{option.count}</span>
              </div>
            ))}
            {filtered.length > 250 && (
              <div className="px-2 py-2 text-center text-[9px] text-[var(--muted)]">
                {t("multiSelect.limit", { total: filtered.length })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
