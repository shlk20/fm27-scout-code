import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getAnalysisOverview,
  getFilterOptions,
  getPlayer,
  getSquadAnalysis,
  listSaves,
  queryPlayers,
} from "./api";
import type { PlayerQuery } from "./types";
import { useAppStore, type Filters } from "@/store/app";

export function buildPlayerQuery(
  saveId: number,
  filters: Filters,
  sortBy: string,
  sortDir: "asc" | "desc",
  page: number,
  pageSize: number,
  includeHidden: boolean,
): PlayerQuery {
  return {
    save_id: saveId,
    search: filters.search || null,
    uids: [],
    club_uids: filters.clubUids,
    nation_ids: filters.nationIds,
    age_min: filters.ageMin,
    age_max: filters.ageMax,
    ca_min: filters.caMin,
    ca_max: filters.caMax,
    pa_min: filters.paMin,
    pa_max: filters.paMax,
    pa_ca_gap_min: filters.paCaGapMin,
    pa_unknown: filters.paUnknown,
    positions: filters.positions,
    position_min: filters.positionMin,
    attributes: filters.attributes.map((rule) => ({
      key: rule.key,
      min: rule.min,
      max: rule.max,
    })),
    value_min: filters.valueMin,
    value_max: filters.valueMax,
    wage_min: filters.wageMin,
    wage_max: filters.wageMax,
    contract_end_before: filters.contractEndBefore,
    contract_end_after: filters.contractEndAfter,
    on_loan: filters.onLoan,
    include_hidden: includeHidden,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    page_size: pageSize,
  };
}

export function useSaves() {
  return useQuery({
    queryKey: ["saves"],
    queryFn: listSaves,
    staleTime: 10_000,
  });
}

export function usePlayerPage() {
  const saveId = useAppStore((state) => state.saveId);
  const filters = useAppStore((state) => state.filters);
  const sortBy = useAppStore((state) => state.sortBy);
  const sortDir = useAppStore((state) => state.sortDir);
  const page = useAppStore((state) => state.page);
  const pageSize = useAppStore((state) => state.pageSize);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  const query = saveId
    ? buildPlayerQuery(saveId, filters, sortBy, sortDir, page, pageSize, hiddenEnabled)
    : null;
  return useQuery({
    queryKey: ["players", query],
    queryFn: () => queryPlayers(query!),
    enabled: query != null,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function usePlayerDetail(uid: number | null) {
  const saveId = useAppStore((state) => state.saveId);
  const hiddenEnabled = useAppStore((state) => state.hiddenEnabled);
  return useQuery({
    queryKey: ["player", saveId, uid, hiddenEnabled],
    queryFn: () => getPlayer(saveId!, uid!, hiddenEnabled),
    enabled: saveId != null && uid != null,
    staleTime: 60_000,
  });
}

export function useAnalysisOverview(enabled = true) {
  const saveId = useAppStore((state) => state.saveId);
  return useQuery({
    queryKey: ["analysis-overview", saveId],
    queryFn: () => getAnalysisOverview(saveId!),
    enabled: saveId != null && enabled,
    staleTime: 60_000,
  });
}

export function useSquadAnalysis(clubUid: number | null) {
  const saveId = useAppStore((state) => state.saveId);
  return useQuery({
    queryKey: ["squad-analysis", saveId, clubUid],
    queryFn: () => getSquadAnalysis(saveId!, clubUid!),
    enabled: saveId != null && clubUid != null,
    staleTime: 60_000,
  });
}

export function useFilterOptions() {
  const saveId = useAppStore((state) => state.saveId);
  return useQuery({
    queryKey: ["filter-options", saveId],
    queryFn: () => getFilterOptions(saveId!),
    enabled: saveId != null,
    staleTime: 60_000,
  });
}
