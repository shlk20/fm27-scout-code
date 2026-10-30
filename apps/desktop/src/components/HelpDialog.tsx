import { Command, Database, Eye, Info, LockKeyhole, ShieldCheck, WifiOff } from "lucide-react";
import { useAppStore } from "@/store/app";
import { Badge, Button, Modal } from "./ui";

const SHORTCUTS = [
  ["⌘ O", "打开存档"],
  ["⌘ F", "聚焦搜索"],
  ["⌘ E", "导出当前结果"],
  ["⌘ ,", "打开设置"],
  ["Shift + 点击列头", "加入多列排序"],
  ["Esc", "关闭弹窗 / 详情"],
];

export function HelpDialog() {
  const open = useAppStore((state) => state.helpOpen);
  const setOpen = useAppStore((state) => state.setHelpOpen);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="关于与帮助"
      description="FM27 Scout 0.2.0 · 只读球探工作台"
      width="max-w-[620px]"
      footer={
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          关闭
        </Button>
      }
    >
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink)]">
            <ShieldCheck size={14} className="text-[var(--accent)]" />
            只读与隐私
          </h3>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
            <li className="flex gap-1.5">
              <Check /> 不修改存档，不读取游戏内存，不注入进程。
            </li>
            <li className="flex gap-1.5">
              <Check /> 完全离线，不上传存档、球员或使用数据。
            </li>
            <li className="flex gap-1.5">
              <Check /> SQLite 缓存保存在本机应用数据目录。
            </li>
            <li className="flex gap-1.5">
              <Check /> 不内置 SI / SEGA 的数据库、图片或 Logo。
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink)]">
            <Eye size={14} className="text-[var(--gold)]" />
            隐藏属性说明
          </h3>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
            隐藏属性默认关闭。开启后显示稳定、大赛、受伤倾向、肮脏、多面性与性格数值。这些信息在线上联赛、对战平台可能被视为作弊，请仅用于单机分析。
          </p>
          <div className="mt-2 flex gap-1.5">
            <Badge tone="danger">仅单机</Badge>
            <Badge tone="outline">默认关闭</Badge>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink)]">
            <Command size={14} />
            快捷键
          </h3>
          <div className="mt-2 space-y-1">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--muted)]">{label}</span>
                <span className="kbd">{key}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink)]">
            <Info size={14} className="text-[var(--blue)]" />
            解析说明
          </h3>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
            当前解析器针对 FM27 build 27.0.0+2486695 验证，game_db schema 4000。未知 build 会降级读取并在报告中提示，不会猜测缺失字段。
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="outline">
              <Database size={9} /> 46,273 球员
            </Badge>
            <Badge tone="outline">
              <LockKeyhole size={9} /> parser 0.2.0
            </Badge>
            <Badge tone="outline">
              <WifiOff size={9} /> offline
            </Badge>
          </div>
        </section>

        <section className="md:col-span-2">
          <div className="rounded-xl border border-[var(--line)] px-3 py-2 text-[9px] leading-relaxed text-[var(--muted)]">
            非官方工具，与 Sports Interactive / SEGA 无关。解析逻辑参考 MIT 许可的 fmsave 项目；Tauri、React、TanStack 等组件遵循各自许可证。
            如果游戏正在保存，请等待保存完成后重新打开存档。
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Check() {
  return (
    <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[8px] text-[var(--accent-strong)]">
      ✓
    </span>
  );
}
