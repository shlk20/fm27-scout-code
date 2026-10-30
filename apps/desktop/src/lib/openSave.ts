import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listenParseProgress, logMessage, openSave, pickSaveFile } from "./api";
import { useAppStore } from "@/store/app";

export function useOpenSave() {
  const setSession = useAppStore((state) => state.setSession);
  const setParsing = useAppStore((state) => state.setParsing);
  const setParseProgress = useAppStore((state) => state.setParseProgress);
  const pushToast = useAppStore((state) => state.pushToast);
  const queryClient = useQueryClient();

  const openPath = useCallback(
    async (path: string, force = false) => {
      setParsing(true);
      setParseProgress({ stage: "opening", current: 0, total: 0, message: "正在打开存档" });
      let unlisten: () => void = () => undefined;
      try {
        unlisten = await listenParseProgress((progress) => setParseProgress(progress));
        const result = await openSave(path, force);
        setSession(result.save_id, result.summary);
        await queryClient.invalidateQueries();
        pushToast({
          title: result.cached ? "已加载缓存存档" : "存档解析完成",
          description: result.cached
            ? `${result.summary.save_name} · 使用本地缓存`
            : `${result.report?.players.toLocaleString("en-US") ?? 0} 名球员 · ${(
                (result.report?.elapsed_ms ?? 0) / 1000
              ).toFixed(2)} 秒`,
          tone: "success",
        });
      } catch (error) {
        await logMessage(`openSave failed: ${String(error)}`);
        pushToast({
          title: "无法打开存档",
          description: String(error),
          tone: "error",
        });
      } finally {
        unlisten();
        setParsing(false);
      }
    },
    [pushToast, queryClient, setParseProgress, setParsing, setSession],
  );

  const chooseAndOpen = useCallback(async () => {
    const path = await pickSaveFile();
    if (path) await openPath(path);
  }, [openPath]);

  return { openPath, chooseAndOpen };
}
