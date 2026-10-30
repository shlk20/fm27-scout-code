import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  EyeOff,
  Loader2,
  SearchX,
  Users,
} from "lucide-react";
import { usePlayerPage } from "@/lib/query";
import { ATTRIBUTE_LABELS, type PlayerRow } from "@/lib/types";
import { caTone, cn, formatValue, formatWage, initials } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { Badge, Button, EmptyState } from "./ui";

const TECHNICAL_COLUMNS = ["passing", "dribbling", "finishing", "first_touch", "technique", "crossing"];
const MENTAL_COLUMNS = ["vision", "decisions", "anticipation", "teamwork", "work_rate", "determination"];
const PHYSICAL_COLUMNS = ["pace", "acceleration", "stamina", "strength", "jumping_reach", "agility"];
const GOALKEEPING_COLUMNS = ["handling", "aerial_reach", "command_of_area", "communication", "kicking", "reflexes"];
const ATTRIBUTE_TABLE_KEYS = [...TECHNICAL_COLUMNS, ...MENTAL_COLUMNS, ...PHYSICAL_COLUMNS, ...GOALKEEPING_COLUMNS];
const OVERVIEW_VISIBILITY: VisibilityState = Object.fromEntries(
  ATTRIBUTE_TABLE_KEYS.map((key) => [`attr_${key}`, false]),
);

export function PlayerTable() {
  const page = usePlayerPage();
  const sort = useAppStore((state) => state.sort);
  const setSort = useAppStore((state) => state.setSort);
  const selectedUid = useAppStore((state) => state.selectedUid);
  const setSelectedUid = useAppStore((state) => state.setSelectedUid);
  const compareUids = useAppStore((state) => state.compareUids);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const currentPage = useAppStore((state) => state.page);
  const setPage = useAppStore((state) => state.setPage);
  const pageSize = useAppStore((state) => state.pageSize);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    height: false,
    foot: false,
    ...OVERVIEW_VISIBILITY,
  });
  const [columnsOpen, setColumnsOpen] = useState(false);

  const columns = useMemo<ColumnDef<PlayerRow>[]>(() => {
    const sortable = (id: string, label: string, align = "left") => ({
      id,
      accessorFn: (row: PlayerRow) => (row as unknown as Record<string, unknown>)[id],
      header: label,
      cell: () => null,
      meta: { align },
    });
    const baseColumns: ColumnDef<PlayerRow>[] = [
      {
        id: "compare",
        header: "",
        size: 30,
        cell: ({ row }) => (
          <button
            type="button"
            aria-label="加入对比"
            onClick={(event) => {
              event.stopPropagation();
              toggleCompare(row.original.uid);
            }}
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-[4px] border text-[9px] font-bold transition-colors",
              compareUids.includes(row.original.uid)
                ? "border-[var(--gold)] bg-[var(--gold)] text-[#221b0b]"
                : "border-[var(--line-strong)] bg-[var(--surface)] text-transparent hover:border-[var(--gold)]",
            )}
          >
            ✓
          </button>
        ),
      },
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "球员",
        size: 224,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[9px] font-bold text-[var(--muted)]">
              {initials(row.original.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold leading-tight text-[var(--ink)]">
                {row.original.name ?? "未命名球员"}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-tight text-[var(--muted)]">
                <span>{row.original.age ?? "?"} 岁</span>
                <span className="text-[var(--line-strong)]">·</span>
                <span className="truncate">
                  {row.original.nation_name ??
                    (row.original.nation_id != null
                      ? `国家 #${row.original.nation_id}`
                      : "国籍未知")}
                </span>
                {row.original.gender === 1 && (
                  <span className="rounded bg-[var(--blue-soft)] px-1 text-[8px] font-semibold text-[var(--blue)]">
                    女
                  </span>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "club",
        accessorFn: (row) => row.club_name,
        header: "俱乐部",
        size: 154,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium text-[var(--ink)]">
              {row.original.club_name ?? "自由球员"}
            </div>
            {row.original.on_loan && (
              <span className="mt-0.5 inline-flex items-center rounded-full bg-[var(--blue-soft)] px-1.5 py-px text-[9px] font-semibold text-[var(--blue)]">
                租借
              </span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) =>
          row.injury_status === "injured"
            ? "injured"
            : row.suspension_count > 0
              ? "suspended"
              : row.on_loan
                ? "loan"
                : row.club_uid == null
                  ? "free"
                  : "available",
        header: "状态",
        size: 66,
        cell: ({ row }) => <StatusBadges row={row.original} />,
      },
      {
        id: "positions",
        accessorFn: (row) => row.positions_text,
        header: "位置",
        size: 78,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] font-semibold text-[var(--accent-strong)]">
            {row.original.positions_text || "—"}
          </span>
        ),
      },
      {
        id: "role",
        accessorFn: (row) => row.best_role_score,
        header: "最佳角色",
        size: 116,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium text-[var(--ink)]">
              {row.original.best_role_name ?? "—"}
            </div>
            <div className="text-[9px] text-[var(--muted)]">
              {row.original.best_role_score != null
                ? `${row.original.best_role_score} / 20 · ${row.original.best_role_position ?? ""}`
                : "—"}
            </div>
          </div>
        ),
      },
      {
        id: "ca",
        accessorFn: (row) => row.ca,
        header: "CA",
        size: 42,
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex h-5 min-w-8 items-center justify-center rounded border px-1.5 font-mono text-[10px] font-bold",
              caTone(row.original.ca),
            )}
          >
            {row.original.ca}
          </span>
        ),
      },
      {
        id: "pa",
        accessorFn: (row) => row.pa,
        header: "PA",
        size: 42,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] font-semibold text-[var(--muted)]">
            {row.original.pa != null ? row.original.pa : row.original.pa_range_code != null ? "?" : "—"}
          </span>
        ),
      },
      {
        id: "value",
        accessorFn: (row) => row.transfer_value,
        header: "身价",
        size: 76,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--ink)]">
            {formatValue(row.original.transfer_value)}
          </span>
        ),
      },
      {
        id: "wage",
        accessorFn: (row) => row.wage,
        header: "周薪",
        size: 82,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-[var(--muted)]">
            {row.original.wage != null ? formatWage(row.original.wage) : "—"}
          </span>
        ),
      },
      {
        id: "contract",
        accessorFn: (row) => row.contract_end,
        header: "合同到期",
        size: 80,
        cell: ({ row }) => (
          <span
            className={cn(
              "whitespace-nowrap font-mono text-[10px] tabular-nums",
              row.original.contract_end && row.original.contract_end < "2027-07-01"
                ? "text-[var(--gold)]"
                : "text-[var(--muted)]",
            )}
          >
            {row.original.contract_end ?? "—"}
          </span>
        ),
      },
      {
        id: "height",
        accessorFn: (row) => row.height_cm,
        header: "身高",
        size: 56,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-[var(--muted)]">
            {row.original.height_cm ? `${row.original.height_cm} cm` : "—"}
          </span>
        ),
      },
      {
        id: "foot",
        accessorFn: (row) => row.left_foot,
        header: "脚",
        size: 46,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-[var(--muted)]">
            {row.original.left_foot != null && row.original.right_foot != null
              ? `${row.original.left_foot}/${row.original.right_foot}`
              : "—"}
          </span>
        ),
      },
      ...ATTRIBUTE_TABLE_KEYS.map<ColumnDef<PlayerRow>>((key) => ({
        id: `attr_${key}`,
        accessorFn: (row) => row.attributes[key],
        header: ATTRIBUTE_LABELS[key] ?? key,
        size: 62,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] font-semibold text-[var(--ink)]">
            {row.original.attributes[key] ?? "—"}
          </span>
        ),
      })),
      {
        id: "hidden",
        header: "隐藏",
        size: 52,
        cell: ({ row }) =>
          hiddenEnabled && row.original.personality ? (
            <span className="font-mono text-[10px] font-semibold text-[var(--gold)]">
              职 {row.original.personality.professionalism}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--line-strong)]">—</span>
          ),
      },
    ];
    return baseColumns.map((column) =>
      column.id && ["name", "club", "positions", "ca", "pa", "value", "wage", "contract", "height", "foot"].includes(column.id)
        ? { ...column, meta: { ...(column.meta ?? {}), sortable: true } }
        : column,
    );
  }, [compareUids, hiddenEnabled, toggleCompare]);

  const table = useReactTable({
    data: page.data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 44, maxSize: 520 },
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const total = page.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortableIds: Record<string, string> = {
    name: "name",
    club: "club",
    positions: "positions",
    role: "role",
    status: "injury_status",
    ca: "ca",
    pa: "pa",
    value: "value",
    wage: "wage",
    contract: "contract_end",
    height: "height",
    foot: "left_foot",
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--canvas)]">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--ink)]">
            {page.isFetching ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                <Loader2 size={11} className="animate-spin" />
                正在查询
              </span>
            ) : (
              `${total.toLocaleString("en-US")} 名球员`
            )}
          </span>
          {page.isPlaceholderData && (
            <span className="text-[10px] text-[var(--muted)]">更新中…</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => setColumnsOpen((value) => !value)}
            >
              <Columns3 size={12} />
              列
            </Button>
            {columnsOpen && (
              <div className="absolute right-0 top-7 z-30 w-44 rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)]">
                <div className="mb-1.5 grid grid-cols-2 gap-1 border-b border-[var(--line)] pb-1.5">
                  {[
                    ["概览", null],
                    ["技术", TECHNICAL_COLUMNS],
                    ["精神", MENTAL_COLUMNS],
                    ["身体", PHYSICAL_COLUMNS],
                    ["门将", GOALKEEPING_COLUMNS],
                  ].map(([label, keys]) => (
                    <button
                      key={label as string}
                      type="button"
                      onClick={() => {
                        const visibility: VisibilityState = {};
                        for (const column of table.getAllLeafColumns()) {
                          visibility[column.id] = !column.id.startsWith("attr_");
                        }
                        visibility.height = false;
                        visibility.foot = false;
                        if (keys) {
                          for (const key of keys as string[]) visibility[`attr_${key}`] = true;
                        }
                        setColumnVisibility(visibility);
                        setColumnsOpen(false);
                      }}
                      className="rounded-[5px] border border-[var(--line)] px-1.5 py-1 text-[10px] text-[var(--muted)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
                <div className="thin-scroll max-h-72 overflow-auto">
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.id !== "compare" && column.id !== "name")
                  .map((column) => (
                    <button
                      key={column.id}
                      type="button"
                      onClick={() => column.toggleVisibility()}
                      className="flex w-full items-center justify-between rounded-[5px] px-2 py-1.5 text-left text-[11px] hover:bg-[var(--surface-2)]"
                    >
                      <span>{String(column.columnDef.header)}</span>
                      <span className={column.getIsVisible() ? "text-[var(--accent)]" : "text-[var(--line-strong)]"}>
                        {column.getIsVisible() ? "显示" : <EyeOff size={11} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="h-4 w-px bg-[var(--line)]" />
          <span className="text-[10px] text-[var(--muted)]">
            {compareUids.length > 0 ? `已选 ${compareUids.length}/4 对比` : "勾选左侧加入对比"}
          </span>
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto">
        {page.isLoading ? (
          <TableSkeleton />
        ) : total === 0 ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="没有匹配的球员"
            description="尝试放宽筛选条件，或清空搜索。当前存档中的所有球员仍然保留在本地缓存中。"
          />
        ) : (
          <table className="w-full border-separate border-spacing-0 text-left" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-20 bg-[var(--surface)]/95 backdrop-blur">
              <tr>
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const sortKey = sortableIds[header.id];
                  const sortIndex = sortKey ? sort.findIndex((rule) => rule.by === sortKey) : -1;
                  const activeRule = sortIndex >= 0 ? sort[sortIndex] : null;
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        "border-b border-[var(--line)] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]",
                        header.id === "name" && "sticky left-0 z-30 bg-[var(--surface)]",
                        header.id === "compare" && "sticky left-0 z-30 bg-[var(--surface)]",
                        sortKey && "cursor-pointer select-none hover:text-[var(--ink)]",
                        "relative",
                      )}
                      onClick={(event) => sortKey && setSort(sortKey, event.shiftKey)}
                      title={sortKey ? "点击排序，Shift+点击加入多列排序" : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortKey &&
                          (activeRule ? (
                            <>
                              {activeRule.dir === "asc" ? (
                                <ArrowUp size={10} className="text-[var(--accent)]" />
                              ) : (
                                <ArrowDown size={10} className="text-[var(--accent)]" />
                              )}
                              {sort.length > 1 && (
                                <span className="rounded bg-[var(--accent-soft)] px-1 font-mono text-[8px] text-[var(--accent-strong)]">
                                  {sortIndex + 1}
                                </span>
                              )}
                            </>
                          ) : (
                            <ArrowUpDown size={10} className="opacity-30" />
                          ))}
                      </span>
                      {header.column.getCanResize() && (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-[var(--accent-line)]"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const isSelected = row.original.uid === selectedUid;
                const isCompare = compareUids.includes(row.original.uid);
                return (
                  <tr
                    key={row.id}
                    data-selected={isSelected}
                    data-compare={isCompare}
                    tabIndex={0}
                    aria-selected={isSelected}
                    className="table-row group focus-ring cursor-pointer border-b border-[var(--line)]/70"
                    onClick={() => setSelectedUid(row.original.uid)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedUid(row.original.uid);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          "h-[38px] border-b border-[var(--line)]/60 px-2 align-middle",
                          cell.column.id === "name" &&
                            "sticky left-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-2)]",
                          cell.column.id === "compare" &&
                            "sticky left-0 z-10 bg-[var(--surface)]",
                          (cell.column.id === "name" || cell.column.id === "compare") &&
                            isSelected &&
                            "bg-[var(--accent-soft)]",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--line)] bg-[var(--surface)] px-3">
        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
          <Users size={11} />
          <span>服务端分页 · 每页 {pageSize}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={currentPage <= 0}
            onClick={() => setPage(currentPage - 1)}
            aria-label="上一页"
          >
            <ChevronLeft size={13} />
          </Button>
          <span className="min-w-16 text-center font-mono text-[10px] text-[var(--muted)]">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={currentPage + 1 >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            aria-label="下一页"
          >
            <ChevronRight size={13} />
          </Button>
        </div>
      </div>
    </section>
  );
}

function StatusBadges({ row }: { row: PlayerRow }) {
  const badges: { label: string; tone: string; title?: string }[] = [];
  if (row.injury_status === "injured") {
    badges.push({
      label: "伤",
      tone: "bg-[var(--danger-soft)] text-[var(--danger)]",
      title: row.injury_until ? `预计 ${row.injury_until} 复出` : "伤病中",
    });
  } else if (row.recent_injury) {
    badges.push({
      label: "伤",
      tone: "bg-[var(--surface-3)] text-[var(--muted)]",
      title: `最近伤病 ${row.recent_injury}`,
    });
  }
  if (row.suspension_count > 0) {
    badges.push({
      label: "停",
      tone: "bg-[var(--gold-soft)] text-[var(--gold)]",
      title: `${row.suspension_count} 项停赛`,
    });
  }
  if (row.on_loan) {
    badges.push({
      label: "租",
      tone: "bg-[var(--blue-soft)] text-[var(--blue)]",
      title: "租借中",
    });
  }
  if (badges.length === 0) {
    return <span className="text-[10px] text-[var(--line-strong)]">—</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {badges.map((badge) => (
        <span
          key={badge.label}
          title={badge.title}
          className={cn(
            "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-bold",
            badge.tone,
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 14 }).map((_, index) => (
        <div
          key={index}
          className="flex h-9 items-center gap-3 rounded-[6px] bg-[var(--surface-2)] px-3"
          style={{ opacity: 1 - index * 0.045 }}
        >
          <div className="h-6 w-6 rounded-full bg-[var(--surface-3)]" />
          <div className="h-2.5 w-32 rounded bg-[var(--surface-3)]" />
          <div className="h-2.5 w-24 rounded bg-[var(--surface-3)]" />
          <div className="ml-auto h-2.5 w-10 rounded bg-[var(--surface-3)]" />
        </div>
      ))}
    </div>
  );
}
