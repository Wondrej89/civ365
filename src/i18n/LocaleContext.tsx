import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  formatNumber as number,
  formatDuration as duration,
} from "../game/utils/numbers";
import {
  translate,
  translateError,
  translateMessage,
  translateLegacyEvent,
  localeNames,
} from "./core";
import type { Amount, GameEvent } from "../game/types";
import type { Language, MessageValues } from "./types";
function createLocale(language: Language) {
  return {
    language,
    locale: localeNames[language],
    t: (key: string, values?: MessageValues) =>
      translate(language, key, values),
    formatNumber: (value: Amount, digits = 2) =>
      number(value, digits, language),
    formatDuration: (seconds: number) => duration(seconds, language),
    formatTime: (time: number, options?: Intl.DateTimeFormatOptions) =>
      new Date(time).toLocaleTimeString(localeNames[language], options),
    formatEvent: (event: GameEvent | undefined) =>
      event
        ? event.translation
          ? translateMessage(language, event.translation)
          : translateLegacyEvent(language, event.message)
        : "",
    formatError: (error: string) => translateError(language, error),
  };
}
const LocaleContext = createContext<ReturnType<typeof createLocale> | null>(
  null,
);
export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const locale = useMemo(() => createLocale(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
export function useI18n() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("Locale provider is missing.");
  return locale;
}
