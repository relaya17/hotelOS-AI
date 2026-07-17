export const SUPPORTED_LOCALES = [
  "he",
  "en",
  "ar",
  "ru",
  "es",
  "th",
  "zh",
  "hi",
  "tr",
  "el",
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export type LocaleMeta = {
  readonly code: LocaleCode;
  readonly nativeName: string;
  readonly englishName: string;
  readonly dir: "rtl" | "ltr";
  /** UI dictionary entries are human-curated and marked verified. */
  readonly uiVerification: "verified";
};

export const LOCALE_META: readonly LocaleMeta[] = [
  { code: "he", nativeName: "עברית", englishName: "Hebrew", dir: "rtl", uiVerification: "verified" },
  { code: "en", nativeName: "English", englishName: "English", dir: "ltr", uiVerification: "verified" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", uiVerification: "verified" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr", uiVerification: "verified" },
  { code: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", uiVerification: "verified" },
  { code: "th", nativeName: "ไทย", englishName: "Thai", dir: "ltr", uiVerification: "verified" },
  { code: "zh", nativeName: "中文", englishName: "Chinese", dir: "ltr", uiVerification: "verified" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr", uiVerification: "verified" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish", dir: "ltr", uiVerification: "verified" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek", dir: "ltr", uiVerification: "verified" },
] as const;

export function isLocaleCode(value: string): value is LocaleCode {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function localeDirection(locale: LocaleCode): "rtl" | "ltr" {
  return LOCALE_META.find((item) => item.code === locale)?.dir ?? "ltr";
}
