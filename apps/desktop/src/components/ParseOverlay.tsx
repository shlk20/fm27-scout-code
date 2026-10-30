import { Loader2, ScanSearch } from "lucide-react";
import { useAppStore } from "@/store/app";

const STAGES: Record<string, string> = {
  snapshot: "只读快照",
  opening: "读取容器",
  game_db: "解压 game_db",
  names: "姓名池",
  players: "扫描记录",
  clubs: "俱乐部",
  decode: "解码球员",
  done: "完成",
};

const STAGE_ORDER = ["snapshot", "opening", "game_db", "names", "players", "clubs", "decode"];

export function ParseOverlay() {
  const parsing = useAppStore((state) => state.parsing);
  const progress = useAppStore((state) => state.parseProgress);
  if (!parsing) return null;
  const total = progress?.total ?? 0;
  const current = progress?.current ?? 0;
  const percent = total > 0 ? Math.min(100, (current / total) * 100) : null;
  const activeStage = progress?.stage ?? "opening";
  const activeIndex = STAGE_ORDER.indexOf(activeStage);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[3px] dark:bg-black/50">
      <div className="w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <ScanSearch size={20} />
            <Loader2 size={12} className="absolute -right-1 -top-1 animate-spin text-[var(--gold)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">正在解析存档</div>
            <div className="mt-0.5 text-[10px] text-[var(--muted)]">
              {progress?.message ?? "准备中…"}
            </div>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className={`h-full rounded-full bg-[var(--accent)] transition-all duration-300 ${
              percent == null ? "w-1/3 animate-pulse" : ""
            }`}
            style={percent == null ? undefined : { width: `${Math.max(3, percent)}%` }}
          />
        </div>
        {total > 0 && (
          <div className="mt-1 text-right font-mono text-[9px] text-[var(--muted)]">
            {current.toLocaleString("en-US")} / {total.toLocaleString("en-US")}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1">
          {STAGE_ORDER.map((stage, index) => (
            <span
              key={stage}
              className={`rounded-full border px-2 py-0.5 text-[9px] ${
                stage === activeStage
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : index < activeIndex
                    ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {STAGES[stage]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[9px] leading-relaxed text-[var(--muted)]">
          只读取存档副本，不写入游戏目录。首次解析约 1–3 秒，之后会直接使用本地缓存。
        </p>
      </div>
    </div>
  );
}
