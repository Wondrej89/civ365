import en from './locales/en.json';
import cs from './locales/cs.json';
import eventTemplates from './event-templates.json';
import type { Language, Message, MessageValues } from './types';
export const localeNames: Record<Language, string> = {
  en: 'en-GB',
  cs: 'cs-CZ',
};
const catalogs: Record<Language, Record<string, string>> = { en, cs };
/** English source phrases are message IDs, with named placeholders for dynamic values. */
export function translate(
  language: Language,
  key: string,
  values: MessageValues = {},
): string {
  const entry = (catalog: Record<string, string>) =>
    Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  const template = entry(catalogs[language]) ?? entry(catalogs.en) ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}
export function message(key: string, values?: MessageValues): Message {
  return values ? { key, values } : { key };
}
export function translateMessage(language: Language, value: Message): string {
  return translate(
    language,
    value.key,
    Object.fromEntries(
      Object.entries(value.values ?? {}).map(([key, parameter]) => [
        key,
        typeof parameter === 'string'
          ? translate(language, parameter)
          : parameter,
      ]),
    ),
  );
}
const legacyTemplates = eventTemplates.map((key) => {
  const names: string[] = [];
  const pattern = key
    .split(/(\{\w+\})/)
    .map((part) => {
      if (/^\{\w+\}$/.test(part)) {
        names.push(part.slice(1, -1));
        return '(.+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return { key, names, pattern: new RegExp(`^${pattern}$`) };
});
/** Recognize previous English event formats so existing histories can change language too. */
export function translateLegacyEvent(language: Language, text: string) {
  for (const template of legacyTemplates) {
    const match = template.pattern.exec(text);
    if (match)
      return translateMessage(language, {
        key: template.key,
        values: Object.fromEntries(
          template.names.map((name, i) => [name, match[i + 1]]),
        ),
      });
  }
  return translate(language, text);
}
/** Browser/OS errors retain their text, with a safe English fallback. */
export function translateError(language: Language, text: string): string {
  const prefix = 'Could not import save: ';
  if (text.startsWith(prefix))
    return translate(language, 'Could not import save: {reason}', {
      reason: translateError(language, text.slice(prefix.length)),
    });
  const recovery = ' A recovery copy was kept in browser storage.';
  if (text.endsWith(recovery))
    return translate(
      language,
      '{reason} A recovery copy was kept in browser storage.',
      {
        reason: translateError(language, text.slice(0, -recovery.length)),
      },
    );
  return translate(language, text);
}
