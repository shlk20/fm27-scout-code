import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  Filter,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useFilterOptions } from "@/lib/query";
import { ATTRIBUTE_LABELS, POSITION_LABELS, POSITION_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, useAppStore, type Filters } from "@/store/app";
import { Badge, Button, Checkbox, Input, Label, Select, Switch } from "./ui";
import { MultiSelect } from "./MultiSelect";
import { RangeInput } from "./RangeInput";

const POSITION_ROWS: (string | null)[][] = [
  [null, "gk", null],
  ["dl", "dc", "dr"],
  ["wbl", "dm", "wbr"],
  ["ml", "mc", "mr"],
  ["aml", "amc", "amr"],
  [null, "stc", null],
];

const HIDDEN_ATTRIBUTES = new Set([
  "consistency",
  "dirtiness",
  "important_matches",
  "injury_proneness",
  "versatility",
]);

export function FilterSidebar() {
  const filters = useAppStore((state) => state.filters);
  const patchFilters = useAppStore((state) => state.patchFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const togglePosition = useAppStore((state) => state.togglePosition);
  const addAttribute = useAppStore((state) => state.addAttribute);
  const updateAttribute = useAppStore((state) => state.updateAttribute);
  const removeAttribute = useAppStore((state) => state.removeAttribute);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const setHiddenEnabled = useAppStore((state) => state.setHiddenEnabled);
  const pushToast = useAppStore((state) => state.pushToast);
  const summary = useAppStore((state) => state.summary);
  const savedViews = useAppStore((state) => state.savedViews);
  const saveView = useAppStore((state) => state.saveView);
  const applyView = useAppStore((state) => state.applyView);
  const deleteView = useAppStore((state) => state.deleteView);
  const { data: options } = useFilterOptions();
  const [savingView, setSavingView] = useState(false);
  const [viewNameDraft, setViewNameDraft] = useState("");

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.clubUids.length) count++;
    if (filters.nationIds.length) count++;
    if (filters.genders.length) count++;
    if (filters.availability) count++;
    if (filters.ageMin != null || filters.ageMax != null) count++;
    if (filters.caMin != null || filters.caMax != null) count++;
    if (
      filters.paMin != null ||
      filters.paMax != null ||
      filters.paCaGapMin != null ||
      filters.paUnknown != null
    )
      count++;
    if (filters.positions.length) count++;
    if (filters.attributes.length) count += filters.attributes.length;
    if (filters.valueMin != null || filters.valueMax != null) count++;
    if (filters.wageMin != null || filters.wageMax != null) count++;
    if (
      filters.contractEndBefore ||
      filters.contractEndAfter ||
      filters.onLoan != null
    )
      count++;
    return count;
  }, [filters]);

  const attributeOptions = useMemo(
    () =>
      Object.entries(ATTRIBUTE_LABELS)
        .filter(([key]) => hiddenEnabled || !HIDDEN_ATTRIBUTES.has(key))
        .sort((a, b) => a[1].localeCompare(b[1], "zh-CN")),
    [hiddenEnabled],
  );

  const presets = useMemo(() => {
    const gameDate = summary?.game_date ?? "2026-07-13";
    const options: { label: string; patch: Partial<Filters> }[] = [
      { label: "全部", patch: {} },
      { label: "小妖", patch: { ageMax: 21, paMin: 140, paCaGapMin: 10 } },
      {
        label: "合同年",
        patch: {
          contractEndAfter: gameDate,
          contractEndBefore: nextYear(gameDate),
        },
      },
      { label: "高潜", patch: { caMin: 140, paMin: 160, ageMax: 23 } },
    ];
    return options.map((option) => ({
      ...option,
      active: matchesFilters(filters, option.patch),
    }));
  }, [filters, summary?.game_date]);

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]/80">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[var(--accent)]" />
          <span className="text-xs font-semibold tracking-wide text-[var(--ink)]">筛选</span>
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          disabled={activeCount === 0}
          className="h-6 px-1.5 text-[10px]"
        >
          <RotateCcw size={11} />
          重置
        </Button>
      </div>

      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3.5">
        <section className="grid grid-cols-2 gap-1">
          {presets.map(({ label, patch, active }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                resetFilters();
                if (label !== "全部") patchFilters(patch);
              }}
              className={
                active
                  ? "rounded-[7px] border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1.5 text-[10px] font-semibold text-[var(--accent-strong)]"
                  : "rounded-[7px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-[10px] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
              }
            >
              {label}
            </button>
          ))}
        </section>

        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>我的视图</Label>
            <button
              type="button"
              onClick={() => {
                setViewNameDraft(`视图 ${savedViews.length + 1}`);
                setSavingView(true);
              }}
              className="rounded px-1 text-[10px] font-medium text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
            >
              + 保存
            </button>
          </div>
          {savingView && (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={viewNameDraft}
                onChange={(event) => setViewNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && viewNameDraft.trim()) {
                    saveView(viewNameDraft);
                    setSavingView(false);
                    setViewNameDraft("");
                  }
                  if (event.key === "Escape") setSavingView(false);
                }}
                placeholder="视图名称"
                className="h-6 flex-1 text-[10px]"
              />
              <Button
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => {
                  if (viewNameDraft.trim()) {
                    saveView(viewNameDraft);
                    setSavingView(false);
                    setViewNameDraft("");
                  }
                }}
              >
                保存
              </Button>
            </div>
          )}
          {savedViews.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[var(--line)] px-2 py-1.5 text-[9px] text-[var(--muted)]">
              保存常用筛选条件，下次一键恢复
            </div>
          ) : (
            <div className="space-y-1">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => applyView(view.id)}
                    className="min-w-0 flex-1 truncate text-left text-[10px] text-[var(--ink)] hover:text-[var(--accent-strong)]"
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteView(view.id)}
                    className="rounded px-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                    aria-label={`删除视图 ${view.name}`}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-1.5">
          <Label>俱乐部</Label>
          <MultiSelect
            options={options?.clubs ?? []}
            selected={filters.clubUids}
            onChange={(clubUids) => patchFilters({ clubUids })}
            placeholder="全部俱乐部"
          />
        </section>

        <section className="space-y-1.5">
          <Label>国籍</Label>
          <MultiSelect
            options={options?.nations ?? []}
            selected={filters.nationIds}
            onChange={(nationIds) => patchFilters({ nationIds })}
            placeholder="全部国籍"
            maxLabel={2}
          />
        </section>

        <Section title="性别与状态" icon={<SlidersHorizontal size={12} />}>
          <div className="grid grid-cols-2 gap-1">
            {[
              { ids: [] as number[], label: "全部" },
              { ids: [0], label: "男子" },
              { ids: [1], label: "女子" },
            ].map((option) => {
              const active =
                option.ids.length === 0
                  ? filters.genders.length === 0
                  : filters.genders.length === option.ids.length &&
                    option.ids.every((id) => filters.genders.includes(id));
              const count =
                option.ids.length === 0
                  ? options?.genders.reduce((sum, item) => sum + item.count, 0)
                  : options?.genders
                      .filter((item) => option.ids.includes(item.id))
                      .reduce((sum, item) => sum + item.count, 0);
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => patchFilters({ genders: option.ids })}
                  className={cn(
                    "flex items-center justify-between rounded-[6px] border px-2 py-1.5 text-[10px] transition-colors",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
                  )}
                >
                  <span>{option.label}</span>
                  {count != null && <span className="font-mono text-[9px] opacity-70">{count}</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => patchFilters({ genders: [] })}
              className="rounded-[6px] border border-dashed border-[var(--line)] px-2 py-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              清除性别
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[
              ["", "全部状态"],
              ["injured", "伤病中"],
              ["injury_history", "伤病史"],
              ["suspended", "停赛"],
              ["loan", "租借"],
              ["free", "自由球员"],
              ["available", "可出战"],
            ].map(([value, label]) => {
              const active = (filters.availability ?? "") === value;
              const statusId = {
                injured: 1,
                suspended: 2,
                loan: 3,
                free: 4,
                available: 5,
                injury_history: 6,
              }[
                value as "injured" | "suspended" | "loan" | "free" | "available" | "injury_history"
              ];
              const count = value
                ? options?.availability.find((item) => item.id === statusId)?.count
                : null;
              return (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() =>
                    patchFilters({ availability: value || null })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-[6px] border px-2 py-1.5 text-[10px] transition-colors",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
                  )}
                >
                  <span>{label}</span>
                  {count != null && <span className="font-mono text-[9px] opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="年龄与能力" icon={<SlidersHorizontal size={12} />}>
          <RangeInput
            label="年龄"
            min={filters.ageMin}
            max={filters.ageMax}
            onMin={(ageMin) => patchFilters({ ageMin })}
            onMax={(ageMax) => patchFilters({ ageMax })}
            placeholderMin="16"
            placeholderMax="45"
          />
          <RangeInput
            label="CA"
            min={filters.caMin}
            max={filters.caMax}
            onMin={(caMin) => patchFilters({ caMin })}
            onMax={(caMax) => patchFilters({ caMax })}
            placeholderMin="0"
            placeholderMax="200"
          />
          <RangeInput
            label="PA"
            min={filters.paMin}
            max={filters.paMax}
            onMin={(paMin) => patchFilters({ paMin })}
            onMax={(paMax) => patchFilters({ paMax })}
            placeholderMin="0"
            placeholderMax="200"
          />
          <div className="flex items-center justify-between gap-2">
            <Label>PA - CA 差距 ≥</Label>
            <Input
              type="number"
              min={0}
              max={80}
              value={filters.paCaGapMin ?? ""}
              placeholder="0"
              onChange={(event) =>
                patchFilters({
                  paCaGapMin: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              className="h-7 w-16 font-mono text-[10px]"
            />
          </div>
          <Checkbox
            checked={filters.paUnknown === true}
            onChange={(checked) => patchFilters({ paUnknown: checked ? true : null })}
            label="只看 PA 未知 / 随机"
          />
        </Section>

        <Section title="位置" icon={<CircleHelp size={12} />}>
          <div className="grid grid-cols-3 gap-1">
            {POSITION_ROWS.flat().map((position, index) =>
              position ? (
                <button
                  key={position}
                  type="button"
                  onClick={() => togglePosition(position)}
                  className={cn(
                    "focus-ring flex h-7 items-center justify-center rounded-[6px] border font-mono text-[10px] font-semibold transition-colors",
                    filters.positions.includes(position)
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
                  )}
                >
                  {POSITION_LABELS[position]}
                </button>
              ) : (
                <div key={`blank-${index}`} />
              ),
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>最低评分</span>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={1}
                max={20}
                value={filters.positionMin}
                onChange={(event) =>
                  patchFilters({ positionMin: Number(event.target.value) })
                }
                className="h-1 w-24 accent-[var(--accent)]"
              />
              <span className="w-5 text-right font-mono text-[var(--ink)]">
                {filters.positionMin}
              </span>
            </div>
          </div>
        </Section>

        <Section title="属性规则" icon={<Plus size={12} />}>
          <Select
            value=""
            onChange={(event) => {
              if (event.target.value) addAttribute(event.target.value);
            }}
            className="h-7 text-[11px]"
          >
            <option value="">添加属性条件…</option>
            {attributeOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <div className="space-y-1.5">
            {filters.attributes.map((rule) => (
              <div
                key={rule.id}
                className="rounded-[7px] border border-[var(--line)] bg-[var(--surface-2)] p-2"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--ink)]">
                    {ATTRIBUTE_LABELS[rule.key] ?? rule.key}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttribute(rule.id)}
                    className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                    aria-label="移除属性条件"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="最小"
                    value={rule.min ?? ""}
                    onChange={(event) =>
                      updateAttribute(rule.id, {
                        min: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    className="h-6 w-full rounded-[5px] border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono text-[10px]"
                  />
                  <span className="text-[10px] text-[var(--muted)]">–</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="最大"
                    value={rule.max ?? ""}
                    onChange={(event) =>
                      updateAttribute(rule.id, {
                        max: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                    className="h-6 w-full rounded-[5px] border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono text-[10px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="合同与身价" icon={<ChevronDown size={12} />}>
          <RangeInput
            label="身价（存档单位）"
            min={filters.valueMin}
            max={filters.valueMax}
            onMin={(valueMin) => patchFilters({ valueMin })}
            onMax={(valueMax) => patchFilters({ valueMax })}
            step={1000}
            placeholderMin="0"
            placeholderMax="∞"
          />
          <RangeInput
            label="周薪（存档单位）"
            min={filters.wageMin}
            max={filters.wageMax}
            onMin={(wageMin) => patchFilters({ wageMin })}
            onMax={(wageMax) => patchFilters({ wageMax })}
            step={100}
            placeholderMin="0"
            placeholderMax="∞"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <Label>到期早于</Label>
              <input
                type="date"
                value={filters.contractEndBefore ?? ""}
                onChange={(event) =>
                  patchFilters({ contractEndBefore: event.target.value || null })
                }
                className="h-7 w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-1.5 text-[10px]"
              />
            </div>
            <div className="space-y-1">
              <Label>到期晚于</Label>
              <input
                type="date"
                value={filters.contractEndAfter ?? ""}
                onChange={(event) =>
                  patchFilters({ contractEndAfter: event.target.value || null })
                }
                className="h-7 w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-1.5 text-[10px]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>租借状态</Label>
            <Select
              value={filters.onLoan == null ? "" : filters.onLoan ? "yes" : "no"}
              onChange={(event) =>
                patchFilters({
                  onLoan:
                    event.target.value === "" ? null : event.target.value === "yes",
                })
              }
              className="h-7 text-[11px]"
            >
              <option value="">全部</option>
              <option value="yes">仅租借</option>
              <option value="no">非租借</option>
            </Select>
          </div>
        </Section>
      </div>

      <div className="border-t border-[var(--line)] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-[var(--ink)]">隐藏属性</div>
            <div className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
              仅限单机分析，线上联赛可能视为作弊
            </div>
          </div>
          <Switch
            checked={hiddenEnabled}
            onChange={(enabled) => {
              if (!enabled) {
                setHiddenEnabled(false);
                return;
              }
              pushToast({
                title: "已开启隐藏属性",
                description: "仅限单机使用。请勿在线上联赛中依赖这些信息。",
                tone: "default",
              });
              setHiddenEnabled(true);
            }}
            label="隐藏属性"
          />
        </div>
        {hiddenEnabled && (
          <div className="mt-2 flex items-center gap-1.5">
            <Badge tone="danger">仅单机</Badge>
            <span className="text-[10px] text-[var(--muted)]">隐藏属性筛选已启用</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink)]">
        <span className="text-[var(--muted)]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function nextYear(date: string): string {
  const year = Number(date.slice(0, 4));
  return `${year + 1}${date.slice(4)}`;
}

function matchesFilters(filters: Filters, patch: Partial<Filters>): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).every((key) => {
    const expected = (key in patch ? patch[key] : EMPTY_FILTERS[key]) as unknown;
    const actual = filters[key] as unknown;
    if (Array.isArray(expected) || Array.isArray(actual)) {
      return JSON.stringify(actual) === JSON.stringify(expected);
    }
    return actual === expected;
  });
}
