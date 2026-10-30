import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FilterSidebar } from "./components/FilterSidebar";
import { PlayerTable } from "./components/PlayerTable";
import { Inspector } from "./components/Inspector";
import { Toolbar } from "./components/Toolbar";
import { Onboarding } from "./components/Onboarding";
import { CompareDialog } from "./components/CompareDialog";
import { AnalysisDialog } from "./components/AnalysisDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { HelpDialog } from "./components/HelpDialog";
import { ParseOverlay } from "./components/ParseOverlay";
import { Toasts } from "./components/Toasts";
import { useOpenSave } from "./lib/openSave";
import { listenMenuAction, listenOpenFile, logMessage, takePendingOpen } from "./lib/api";
import { useAppStore } from "./store/app";

export default function App() {
  const saveId = useAppStore((state) => state.saveId);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const inspectorOpen = useAppStore((state) => state.inspectorOpen);
  const selectedUid = useAppStore((state) => state.selectedUid);
  const setSelectedUid = useAppStore((state) => state.setSelectedUid);
  const setExportOpen = useAppStore((state) => state.setExportOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setCompareOpen = useAppStore((state) => state.setCompareOpen);
  const setAnalysisOpen = useAppStore((state) => state.setAnalysisOpen);
  const setHelpOpen = useAppStore((state) => state.setHelpOpen);
  const compareOpen = useAppStore((state) => state.compareOpen);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const exportOpen = useAppStore((state) => state.exportOpen);
  const helpOpen = useAppStore((state) => state.helpOpen);
  const theme = useAppStore((state) => state.theme);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen);
  const setHiddenEnabled = useAppStore((state) => state.setHiddenEnabled);
  const pushToast = useAppStore((state) => state.pushToast);
  const { chooseAndOpen, openPath } = useOpenSave();
  const queryClient = useQueryClient();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void chooseAndOpen();
        return;
      }
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.getElementById("global-search")?.focus();
        return;
      }
      if (meta && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setExportOpen(true);
        return;
      }
      if (meta && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (event.key === "Escape") {
        if (compareOpen) setCompareOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (exportOpen) setExportOpen(false);
        else if (helpOpen) setHelpOpen(false);
        else if (selectedUid != null) setSelectedUid(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    chooseAndOpen,
    compareOpen,
    exportOpen,
    helpOpen,
    selectedUid,
    setCompareOpen,
    setExportOpen,
    setHelpOpen,
    setSelectedUid,
    setSettingsOpen,
    settingsOpen,
  ]);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["players"] });
  }, [queryClient]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timer: number | undefined;
    const consumePending = async () => {
      try {
        const path = await takePendingOpen();
        if (path?.toLowerCase().endsWith(".fm")) {
          if (timer) window.clearInterval(timer);
          await openPath(path);
          return true;
        }
      } catch (error) {
        await logMessage(`takePendingOpen error: ${String(error)}`);
      }
      return false;
    };
    let attempts = 0;
    timer = window.setInterval(() => {
      attempts += 1;
      void consumePending();
      if (attempts >= 12) window.clearInterval(timer);
    }, 1000);
    void consumePending();
    void listenOpenFile(() => {
      void consumePending();
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      window.clearInterval(timer);
      unlisten?.();
    };
  }, [openPath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenMenuAction((action) => {
      switch (action) {
        case "open":
          void chooseAndOpen();
          break;
        case "export":
          setExportOpen(true);
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "sidebar":
          setSidebarOpen(!useAppStore.getState().sidebarOpen);
          break;
        case "inspector":
          setInspectorOpen(!useAppStore.getState().inspectorOpen);
          break;
        case "hidden": {
          const next = !useAppStore.getState().hiddenEnabled;
          setHiddenEnabled(next);
          if (next) {
            pushToast({
              title: "隐藏属性已开启",
              description: "仅限单机使用，线上联赛可能被视为作弊。",
              tone: "default",
            });
          }
          break;
        }
        case "compare":
          if (useAppStore.getState().compareUids.length >= 2) setCompareOpen(true);
          break;
        case "analysis":
          setAnalysisOpen(true);
          break;
        case "help":
          setHelpOpen(true);
          break;
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => unlisten?.();
  }, [
    chooseAndOpen,
    pushToast,
    setAnalysisOpen,
    setCompareOpen,
    setExportOpen,
    setHelpOpen,
    setHiddenEnabled,
    setInspectorOpen,
    setSettingsOpen,
    setSidebarOpen,
  ]);

  return (
    <div className="app-bg flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {saveId == null ? (
          <Onboarding />
        ) : (
          <>
            {sidebarOpen && <FilterSidebar />}
            <PlayerTable />
            {inspectorOpen && <Inspector />}
          </>
        )}
      </div>
      <CompareDialog />
      <AnalysisDialog />
      <SettingsDialog />
      <ExportDialog />
      <HelpDialog />
      <ParseOverlay />
      <Toasts />
    </div>
  );
}
