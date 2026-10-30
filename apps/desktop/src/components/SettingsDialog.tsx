import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Eye,
  Info,
  LockKeyhole,
  Monitor,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { appDataDir, deleteSave } from "@/lib/api";
import { useSaves } from "@/lib/query";
import { formatBytes, relativeTime } from "@/lib/utils";
import { useAppStore, type DisplayMode, type Theme } from "@/store/app";
import { Badge, Button, Checkbox, Modal, Select, Switch } from "./ui";

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const setHiddenEnabled = useAppStore((state) => state.setHiddenEnabled);
  const displayMode = useAppStore((state) => state.displayMode);
  const setDisplayMode = useAppStore((state) => state.setDisplayMode);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const pushToast = useAppStore((state) => state.pushToast);
  const currentSaveId = useAppStore((state) => state.saveId);
  const clearSession = useAppStore((state) => state.clearSession);
  const [dataDir, setDataDir] = useState("");
  const { data: saves = [] } = useSaves();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) void appDataDir().then(setDataDir);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="设置"
      description="显示、隐私与本地缓存"
      width="max-w-[660px]"
      footer={
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          完成
        </Button>
      }
    >
      <div className="space-y-5 p-5">
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            显示
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-[11px] text-[var(--muted)]">主题</div>
              <div className="flex gap-1">
                {[
                  ["system", "跟随系统", <Monitor size={13} key="system" />],
                  ["light", "浅色", <Sun size={13} key="light" />],
                  ["dark", "深色", <Moon size={13} key="dark" />],
                ].map(([value, label, icon]) => (
                  <button
                    key={value as string}
                    type="button"
                    onClick={() => setTheme(value as Theme)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-[7px] border px-2 py-1.5 text-[10px] transition-colors ${
                      theme === value
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] text-[var(--muted)]">数值显示</div>
              <Select
                value={displayMode}
                onChange={(event) => setDisplayMode(event.target.value as DisplayMode)}
              >
                <option value="display">显示值 1–20</option>
                <option value="raw">原始值 1–100</option>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            隐藏属性
          </h3>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink)]">
                {hiddenEnabled ? <Eye size={14} /> : <LockKeyhole size={14} />}
                显示隐藏属性与性格
              </div>
              <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-[var(--muted)]">
                默认关闭。开启后显示稳定、大赛、受伤倾向、肮脏、多面性以及职业、雄心等性格数值。仅限单机使用。
              </p>
            </div>
            <Switch
              checked={hiddenEnabled}
              onChange={(enabled) => {
                setHiddenEnabled(enabled);
                if (enabled) {
                  pushToast({
                    title: "隐藏属性已开启",
                    description: "仅限单机使用，线上联赛可能被视为作弊。",
                    tone: "default",
                  });
                }
              }}
              label="隐藏属性"
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              本地缓存
            </h3>
            <span className="font-mono text-[9px] text-[var(--muted)]">{dataDir}</span>
          </div>
          <div className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
            {saves.length === 0 && (
              <div className="px-3 py-6 text-center text-[11px] text-[var(--muted)]">
                还没有缓存存档
              </div>
            )}
            {saves.map((save) => (
              <div key={save.id} className="flex items-center gap-3 bg-[var(--surface)] px-3 py-2.5">
                <Database size={14} className="text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-[var(--ink)]">{save.file_name}</div>
                  <div className="mt-0.5 text-[9px] text-[var(--muted)]">
                    {save.players.toLocaleString("en-US")} 名球员 · {save.game_date ?? "未知日期"} · 解析于{" "}
                    {relativeTime(save.parsed_at)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={async () => {
                    await deleteSave(save.id);
                    await queryClient.invalidateQueries({ queryKey: ["saves"] });
                    if (save.id === currentSaveId) clearSession();
                    pushToast({ title: "已删除缓存", description: save.file_name, tone: "success" });
                  }}
                  aria-label="删除缓存"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[9px] leading-relaxed text-[var(--muted)]">
            缓存只保存在本机应用数据目录。删除缓存不会影响原存档，下次打开时会重新解析。
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            关于
          </h3>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[10px] leading-relaxed text-[var(--muted)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--ink)]">
              <Info size={13} />
              FM27 Scout 0.1.0
            </div>
            <div className="mt-1">
              只读、本地、无网络的 Football Manager 27 球探工具。不会修改存档，不读取游戏内存，不上传任何数据。
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">解析器 {saves[0]?.parser_version ?? "0.1.0"}</Badge>
              <Badge tone="outline">Tauri 2</Badge>
              <Badge tone="outline">Rust</Badge>
              <Badge tone="outline">fmsave · MIT</Badge>
            </div>
            <div className="mt-2">
              非官方工具，与 Sports Interactive / SEGA 无关。线上联赛使用隐藏属性可能违反规则。
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
