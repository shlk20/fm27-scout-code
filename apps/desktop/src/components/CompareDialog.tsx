import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { GitCompareArrows, X } from "lucide-react";
import { getPlayer } from "@/lib/api";
import {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_LABELS,
  type Player,
} from "@/lib/types";
import { caTone, cn, formatValue } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { Badge, Button, Modal } from "./ui";

export function CompareDialog() {
  const open = useAppStore((state) => state.compareOpen);
  const setOpen = useAppStore((state) => state.setCompareOpen);
  const compareUids = useAppStore((state) => state.compareUids);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const clearCompare = useAppStore((state) => state.clearCompare);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const displayMode = useAppStore((state) => state.displayMode);
  const saveId = useAppStore((state) => state.saveId);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [hiddenOnly, setHiddenOnly] = useState(false);

  const results = useQueries({
    queries: compareUids.map((uid) => ({
      queryKey: ["player", saveId, uid, hiddenEnabled],
      queryFn: () => getPlayer(saveId!, uid, hiddenEnabled),
      enabled: open && saveId != null,
      staleTime: 60_000,
    })),
  });
  const players = results.map((result) => result.data).filter(Boolean) as Player[];

  const groups = useMemo(() => {
    const selected = hiddenOnly
      ? ATTRIBUTE_GROUPS.hidden
      : [...ATTRIBUTE_GROUPS.technical, ...(hiddenEnabled ? ATTRIBUTE_GROUPS.hidden : [])];
    return selected;
  }, [hiddenEnabled, hiddenOnly]);

  const values = (player: Player, key: string) =>
    displayMode === "display" ? player.attributes[key] ?? 0 : player.raw_attributes[key] ?? 0;
  const max = displayMode === "display" ? 20 : 100;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={
        <span className="inline-flex items-center gap-2">
          <GitCompareArrows size={16} className="text-[var(--gold)]" />
          球员对比
        </span>
      }
      description={`${players.length} 名球员 · 最优值高亮 · 最多 4 人`}
      width="max-w-[1040px]"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            清空
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </>
      }
    >
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(event) => setDifferencesOnly(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            只看差异
          </label>
          {hiddenEnabled && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={hiddenOnly}
                onChange={(event) => setHiddenOnly(event.target.checked)}
                className="accent-[var(--accent)]"
              />
              只看隐藏属性
            </label>
          )}
          <span className="ml-auto text-[10px] text-[var(--muted)]">
            {displayMode === "display" ? "显示值 1–20" : "原始值 1–100"}
          </span>
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `160px repeat(${Math.max(players.length, 1)}, minmax(0, 1fr))` }}
        >
          <div />
          {players.map((player) => (
            <div
              key={player.uid}
              className="relative rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5"
            >
              <button
                type="button"
                onClick={() => toggleCompare(player.uid)}
                className="absolute right-1.5 top-1.5 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                aria-label="移除对比"
              >
                <X size={11} />
              </button>
              <div className="pr-3 text-[12px] font-semibold leading-tight text-[var(--ink)]">
                {player.name}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                {player.club_name ?? "自由球员"}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", caTone(player.ca))}>
                  CA {player.ca}
                </span>
                <span className="rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)]">
                  PA {player.pa ?? "?"}
                </span>
              </div>
              <div className="mt-1.5 text-[9px] text-[var(--muted)]">
                {player.age} 岁 · {player.natural_positions.join(" / ")} · {formatValue(player.transfer_value)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {groups.map((group) => {
            const rows = group.keys
              .map((key) => {
                const rowValues = players.map((player) => values(player, key));
                const best = Math.max(...rowValues);
                const differs = new Set(rowValues).size > 1;
                return { key, rowValues, best, differs };
              })
              .filter((row) => !differencesOnly || row.differs);
            if (rows.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {group.label}
                </div>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `160px repeat(${Math.max(players.length, 1)}, minmax(0, 1fr))` }}
                >
                  {rows.map((row) => (
                    <div key={row.key} className="contents">
                      <div className="flex items-center rounded-[6px] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--muted)]">
                        {ATTRIBUTE_LABELS[row.key] ?? row.key}
                      </div>
                      {row.rowValues.map((value, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center justify-center rounded-[6px] border px-2 py-1 font-mono text-[10px]",
                            value === row.best && value > 0
                              ? "border-[var(--gold-line)] bg-[var(--gold-soft)] font-bold text-[var(--gold)]"
                              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
                          )}
                        >
                          {value > 0 ? value : "—"}
                          {value === row.best && value > 0 && (
                            <span className="ml-1 text-[8px] uppercase opacity-60">best</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {players.length < 2 && (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[11px] text-[var(--muted)]">
            在表格左侧勾选至少 2 名球员，再打开对比。
          </div>
        )}
      </div>
    </Modal>
  );
}
