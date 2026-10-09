export const languages = ['en', 'cs'] as const;
export type Language = (typeof languages)[number];
export type MessageValues = Record<string, string | number>;
export interface Message {
  key: string;
  values?: MessageValues;
}
export type Translate = (key: string, values?: MessageValues) => string;
export function isLanguage(value: unknown): value is Language {
  return languages.some((language) => language === value);
}
