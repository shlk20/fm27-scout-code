import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/app";
import {
  resolveLocale,
  translate,
  type Locale,
  type TranslationKey,
} from "./i18n";

export function useI18n() {
  const language = useAppStore((state) => state.language);
  const [systemLocale, setSystemLocale] = useState<Locale>(() => resolveLocale("system"));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSystemLocale(resolveLocale("system"));
    update();
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  const locale: Locale = language === "system" ? systemLocale : language;

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );

  return { t, locale, language };
}
