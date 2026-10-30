import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportPlayers, pickExportFile } from "@/lib/api";
import { buildPlayerQuery, usePlayerPage } from "@/lib/query";
import { useAppStore, EMPTY_FILTERS } from "@/store/app";
import { Button, Modal } from "./ui";

type Scope = "filter" | "selected" | "all";

export function ExportDialog() {
  const open = useAppStore((state) => state.exportOpen);
  const setOpen = useAppStore((state) => state.setExportOpen);
  const saveId = useAppStore((state) => state.saveId);
  const summary = useAppStore((state) => state.summary);
  const filters = useAppStore((state) => state.filters);
  const sort = useAppStore((state) => state.sort);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const selectedUid = useAppStore((state) => state.selectedUid);
  const compareUids = useAppStore((state) => state.compareUids);
  const pushToast = useAppStore((state) => state.pushToast);
  const page = usePlayerPage();
  const [scope, setScope] = useState<Scope>("filter");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const selected = useMemo(() => {
    const ids = new Set<number>(compareUids);
    if (selectedUid != null) ids.add(selectedUid);
    return [...ids];
  }, [compareUids, selectedUid]);

  const exportNow = async () => {
    if (!saveId) return;
    const base = buildPlayerQuery(
      saveId,
      scope === "all" ? EMPTY_FILTERS : filters,
      sort,
      0,
      100000,
      hiddenEnabled,
    );
    base.uids = scope === "selected" ? selected : [];
    const defaultName = `fm27-${summary?.save_name ?? "players"}-${new Date()
      .toISOString()
      .slice(0, 10)}.${format}`;
    const path = await pickExportFile(defaultName, format);
    if (!path) return;
    setBusy(true);
    try {
      const report = await exportPlayers(base, format, path);
      pushToast({
        title: "导出完成",
        description: `${report.rows.toLocaleString("en-US")} 行已写入 ${report.path}`,
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["players"] });
      setOpen(false);
    } catch (error) {
      pushToast({ title: "导出失败", description: String(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="导出球员"
      description="导出当前筛选结果，或选中的 1–4 名球员"
      width="max-w-[520px]"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void exportNow()}
            disabled={busy || (scope === "selected" && selected.length === 0)}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            导出
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            范围
          </div>
          {[
            ["filter", "当前筛选结果", `${page.data?.total?.toLocaleString("en-US") ?? 0} 名球员`],
            ["selected", "选中 / 对比球员", selected.length ? `${selected.length} 名球员` : "尚未选择"],
            ["all", "当前存档全部球员", "跳过所有筛选条件"],
          ].map(([value, label, detail]) => (
            <button
              key={value}
              type="button"
              disabled={value === "selected" && selected.length === 0}
              onClick={() => setScope(value as Scope)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                scope === value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]"
              }`}
            >
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink)]">{label}</div>
                <div className="mt-0.5 text-[10px] text-[var(--muted)]">{detail}</div>
              </div>
              {scope === value && <Check size={14} className="text-[var(--accent)]" />}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            格式
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                format === "csv"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface-2)]"
              }`}
            >
              <FileSpreadsheet size={18} className="text-[var(--accent)]" />
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink)]">CSV</div>
                <div className="text-[9px] text-[var(--muted)]">Excel / Numbers</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormat("json")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                format === "json"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface-2)]"
              }`}
            >
              <FileJson size={18} className="text-[var(--gold)]" />
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink)]">JSON</div>
                <div className="text-[9px] text-[var(--muted)]">完整表格字段</div>
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
          CSV 包含表格字段与 52 项属性。导出文件写入你选择的位置；不会上传到任何服务器。
        </div>
      </div>
    </Modal>
  );
}
