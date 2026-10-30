import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Coins,
  GitCompareArrows,
  HeartPulse,
  LockKeyhole,
  Ruler,
  Shield,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { usePlayerDetail } from "@/lib/query";
import type { Attributes, Player, Positions } from "@/lib/types";
import {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_LABELS,
  POSITION_LABELS,
  POSITION_KEYS,
} from "@/lib/types";
import {
  attributeTone,
  caTone,
  cn,
  formatDate,
  formatValue,
  formatWage,
  initials,
} from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { Badge, Button, EmptyState, Switch } from "./ui";

type Tab = "attributes" | "hidden" | "positions" | "contract" | "traits";

export function Inspector() {
  const selectedUid = useAppStore((state) => state.selectedUid);
  const setSelectedUid = useAppStore((state) => state.setSelectedUid);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const setHiddenEnabled = useAppStore((state) => state.setHiddenEnabled);
  const displayMode = useAppStore((state) => state.displayMode);
  const setDisplayMode = useAppStore((state) => state.setDisplayMode);
  const compareUids = useAppStore((state) => state.compareUids);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const { data: player, isLoading } = usePlayerDetail(selectedUid);
  const [tab, setTab] = useState<Tab>("attributes");

  useEffect(() => {
    if (!hiddenEnabled && tab === "hidden") setTab("attributes");
  }, [hiddenEnabled, tab]);

  if (selectedUid == null) {
    return (
      <aside className="flex h-full w-[372px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)]">
        <EmptyState
          icon={<UserRound size={20} />}
          title="选择一名球员"
          description="点击表格中的任意行查看完整属性、隐藏信息、位置评分与合同。"
        />
      </aside>
    );
  }

  if (isLoading || !player) {
    return (
      <aside className="flex h-full w-[372px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-7 animate-pulse rounded bg-[var(--surface-2)]" />
          ))}
        </div>
      </aside>
    );
  }

  const attributes = displayMode === "display" ? player.attributes : player.raw_attributes;
  const maxValue = displayMode === "display" ? 20 : 100;

  return (
    <aside className="flex h-full w-[372px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
          <ClipboardList size={13} className="text-[var(--accent)]" />
          球员档案
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={compareUids.includes(player.uid) ? "gold" : "ghost"}
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={() => toggleCompare(player.uid)}
          >
            {compareUids.includes(player.uid) ? <Check size={11} /> : <GitCompareArrows size={11} />}
            对比
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedUid(null)} aria-label="关闭档案">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[var(--line)] px-4 pb-4 pt-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] text-sm font-bold text-[var(--muted)]">
              {initials(player.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[17px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
                    {player.name ?? "未命名球员"}
                  </h2>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <span>{player.club_name ?? "自由球员"}</span>
                    <span className="text-[var(--line-strong)]">·</span>
                    <span>{player.age ?? "?"} 岁</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <span className={cn("flex h-8 min-w-10 flex-col items-center justify-center rounded-lg border px-1.5", caTone(player.ca))}>
                    <span className="text-[8px] font-bold uppercase opacity-60">CA</span>
                    <span className="font-mono text-[12px] font-bold leading-none">{player.ca}</span>
                  </span>
                  <span className="flex h-8 min-w-10 flex-col items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-1.5 text-[var(--muted)]">
                    <span className="text-[8px] font-bold uppercase opacity-60">PA</span>
                    <span className="font-mono text-[12px] font-bold leading-none">
                      {player.pa ?? (player.pa_range_code != null ? "?" : "—")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Shield size={11} />
              {player.natural_positions.join(" / ") || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Ruler size={11} />
              {player.height_cm ? `${player.height_cm} cm` : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleDot size={11} />
              {player.left_foot}/{player.right_foot} 脚
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} />
              合同 {player.contract?.end ?? "—"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <MiniStat icon={<Coins size={11} />} label="身价" value={formatValue(player.transfer_value)} />
            <MiniStat icon={<BriefcaseBusiness size={11} />} label="周薪" value={formatWage(player.contract?.wage)} />
            <MiniStat
              icon={<HeartPulse size={11} />}
              label="状态"
              value={`${Math.round(player.raw_condition / 100)}% / ${Math.round(player.raw_match_sharpness / 100)}%`}
            />
          </div>

          {player.on_loan && (
            <div className="mt-2 flex items-center gap-1.5 rounded-[7px] border border-[var(--blue-line)] bg-[var(--blue-soft)] px-2 py-1.5 text-[10px] text-[var(--blue)]">
              <span className="font-semibold">租借中</span>
              <span>来自 {player.loan_parent_club_name ?? "未知俱乐部"}</span>
              <span className="ml-auto font-mono">{player.loan_end ?? ""}</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-[7px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5">
            <span className="text-[10px] text-[var(--muted)]">显示 1–20 / 原始 1–100</span>
            <Switch
              checked={displayMode === "raw"}
              onChange={(raw) => setDisplayMode(raw ? "raw" : "display")}
              label="原始数值"
            />
          </div>
        </div>

        {player.traits.length > 0 && (
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <Sparkles size={11} />
              习惯动作
            </div>
            <div className="flex flex-wrap gap-1">
              {player.traits.map((trait) => (
                <Badge key={trait.bit} tone="outline">
                  {trait.name ?? `习惯 #${trait.bit}`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="sticky top-0 z-10 flex gap-0.5 border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1.5">
          {[
            ["attributes", "属性"],
            ["hidden", "隐藏"],
            ["positions", "位置"],
            ["contract", "合同"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as Tab)}
              className={cn(
                "focus-ring rounded-[6px] px-2.5 py-1 text-[10px] font-medium transition-colors",
                tab === key
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "attributes" && (
          <AttributesPanel player={player} attributes={attributes} max={maxValue} />
        )}
        {tab === "hidden" && (
          <HiddenPanel
            player={player}
            attributes={attributes}
            max={maxValue}
            hiddenEnabled={hiddenEnabled}
            onEnable={() => setHiddenEnabled(true)}
          />
        )}
        {tab === "positions" && <PositionsPanel positions={player.positions} />}
        {tab === "contract" && <ContractPanel player={player} />}
      </div>
    </aside>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[11px] font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function AttributesPanel({
  player,
  attributes,
  max,
}: {
  player: Player;
  attributes: Attributes;
  max: number;
}) {
  const groups = player.natural_positions.includes("GK") || player.positions.gk >= 15
    ? [...ATTRIBUTE_GROUPS.technical.slice(0, 2), ...ATTRIBUTE_GROUPS.goalkeeping, ...ATTRIBUTE_GROUPS.technical.slice(2)]
    : ATTRIBUTE_GROUPS.technical;
  return (
    <div className="space-y-4 px-4 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {group.label}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {group.keys.map((key) => (
              <AttributeRow key={key} label={ATTRIBUTE_LABELS[key] ?? key} value={attributes[key] ?? 0} max={max} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttributeRow({ label, value, max }: { label: string; value: number; max: number }) {
  const tone = attributeTone(max === 20 ? value : Math.round(value / 5));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[68px] shrink-0 truncate text-[10px] text-[var(--muted)]">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className={cn("h-full rounded-full", tone.split(" ")[0])}
          style={{ width: `${Math.max(4, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
      <span className="w-6 text-right font-mono text-[10px] font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function HiddenPanel({
  player,
  attributes,
  max,
  hiddenEnabled,
  onEnable,
}: {
  player: Player;
  attributes: Attributes;
  max: number;
  hiddenEnabled: boolean;
  onEnable: () => void;
}) {
  if (!hiddenEnabled) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <LockKeyhole size={20} className="text-[var(--muted)]" />
        <div className="text-xs font-semibold text-[var(--ink)]">隐藏属性已关闭</div>
        <p className="max-w-[240px] text-[11px] leading-relaxed text-[var(--muted)]">
          开启后可查看性格、稳定、大赛、受伤倾向等隐藏信息。仅限单机使用。
        </p>
        <Button size="sm" variant="gold" onClick={onEnable}>
          开启隐藏属性
        </Button>
      </div>
    );
  }
  const hidden = attributes;
  return (
    <div className="space-y-4 px-4 py-3">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          隐藏属性
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {ATTRIBUTE_GROUPS.hidden[0].keys.map((key) => (
            <AttributeRow key={key} label={ATTRIBUTE_LABELS[key]} value={hidden[key] ?? 0} max={max} />
          ))}
        </div>
      </div>
      {player.personality && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            性格
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {Object.entries(player.personality).map(([key, value]) => (
              <AttributeRow key={key} label={PERSONALITY_LABELS[key] ?? key} value={value} max={20} />
            ))}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)]/50 p-2 text-[10px] leading-relaxed text-[var(--danger)]">
        这些数值通常只在游戏内教练报告或编辑器中出现。请仅用于单机分析，不要用于线上联赛。
      </div>
    </div>
  );
}

const PERSONALITY_LABELS: Record<string, string> = {
  adaptability: "适应",
  ambition: "雄心",
  loyalty: "忠诚",
  pressure: "抗压",
  professionalism: "职业",
  sportsmanship: "体育精神",
  temperament: "气质",
  controversy: "争议",
};

function PositionsPanel({ positions }: { positions: Positions }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        位置评分
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {POSITION_ROWS.flat().map((position, index) =>
          position ? (
            <div
              key={position}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border py-2",
                (positions[position as keyof Positions] ?? 0) >= 18
                  ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--surface-2)]",
              )}
            >
              <span className="font-mono text-[9px] font-bold text-[var(--muted)]">
                {POSITION_LABELS[position]}
              </span>
              <span
                className={cn(
                  "font-mono text-[14px] font-bold",
                  (positions[position as keyof Positions] ?? 0) >= 18
                    ? "text-[var(--accent-strong)]"
                    : "text-[var(--muted)]",
                )}
              >
                {positions[position as keyof Positions] ?? 1}
              </span>
            </div>
          ) : (
            <div key={`blank-${index}`} />
          ),
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--muted)]">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" /> 天然位置 ≥ 18
        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--line-strong)]" /> 可胜任 15–17
      </div>
    </div>
  );
}

function ContractPanel({ player }: { player: Player }) {
  const contract = player.contract;
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">当前合同</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
              {contract?.club_name ?? "无合同 / 自由球员"}
            </div>
          </div>
          {contract?.on_loan && <Badge tone="blue">租借</Badge>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat icon={<Coins size={11} />} label="周薪" value={formatWage(contract?.wage)} />
          <MiniStat icon={<CalendarDays size={11} />} label="到期" value={formatDate(contract?.end)} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-[6px] bg-[var(--surface)] px-2 py-1.5">
            <div className="text-[var(--muted)]">开始</div>
            <div className="font-mono text-[var(--ink)]">{formatDate(contract?.start)}</div>
          </div>
          <div className="rounded-[6px] bg-[var(--surface)] px-2 py-1.5">
            <div className="text-[var(--muted)]">加入俱乐部</div>
            <div className="font-mono text-[var(--ink)]">{formatDate(player.club_join_date)}</div>
          </div>
        </div>
      </div>

      {contract?.on_loan && (
        <div className="rounded-xl border border-[var(--blue-line)] bg-[var(--blue-soft)] p-3 text-[11px] text-[var(--blue)]">
          <div className="font-semibold">租借信息</div>
          <div className="mt-1">母队：{contract.loan_parent_club_name ?? "—"}</div>
          <div>
            租借期：{formatDate(contract.loan_start)} → {formatDate(contract.loan_end)}
          </div>
        </div>
      )}

      {contract && contract.clauses.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            合同条款
          </div>
          <div className="space-y-1">
            {contract.clauses.map((clause, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-[6px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-[10px]"
              >
                <span className="text-[var(--muted)]">条款 #{clause.kind}</span>
                <span className="font-mono text-[var(--ink)]">
                  {clause.value != null ? formatValue(clause.value) : clause.parameter ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {contract && contract.chain.length > 1 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            合同链
          </div>
          <div className="space-y-1">
            {contract.chain.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 rounded-[6px] border border-[var(--line)] px-2 py-1.5">
                <ChevronRight size={11} className="text-[var(--muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-medium text-[var(--ink)]">
                    {entry.club_name ?? "未知俱乐部"}
                  </div>
                  <div className="text-[9px] text-[var(--muted)]">
                    {entry.start ?? "—"} → {entry.end ?? "—"}
                  </div>
                </div>
                {entry.has_terms && <Badge tone="outline">合同</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const POSITION_ROWS: (string | null)[][] = [
  [null, "gk", null],
  ["dl", "dc", "dr"],
  ["wbl", "dm", "wbr"],
  ["ml", "mc", "mr"],
  ["aml", "amc", "amr"],
  [null, "stc", null],
];
