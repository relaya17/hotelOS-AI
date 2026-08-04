import { isLocaleCode, tUi, type LocaleCode } from "@hotelos/i18n";

export type LegalFooterProps = {
  readonly legalUrl: (
    doc:
      | "terms"
      | "cookies"
      | "security"
      | "privacy"
      | "meetings"
      | "subprocessors",
  ) => string;
};

function resolveLegalLocale(defaultLocale: LocaleCode = "he"): LocaleCode {
  if (typeof document === "undefined") {
    return defaultLocale;
  }
  const raw =
    document.documentElement.lang ||
    document.documentElement.getAttribute("lang") ||
    "";
  const normalized = raw.trim().toLowerCase();
  if (normalized && isLocaleCode(normalized)) {
    return normalized;
  }
  return defaultLocale;
}

export function LegalFooter({ legalUrl }: LegalFooterProps) {
  const locale = resolveLegalLocale();
  return (
    <footer className="legal-bar" aria-label={tUi(locale, "legal.nav")}>
      <a href={legalUrl("terms")}>{tUi(locale, "legal.terms")}</a>
      <a href={legalUrl("cookies")}>{tUi(locale, "legal.cookies")}</a>
      <a href={legalUrl("security")}>{tUi(locale, "legal.security")}</a>
      <a href={legalUrl("privacy")}>{tUi(locale, "legal.privacy")}</a>
      <a href={legalUrl("meetings")}>{tUi(locale, "legal.meetings")}</a>
      <a href={legalUrl("subprocessors")}>{tUi(locale, "legal.subprocessors")}</a>
      <style>{`
        .legal-bar{display:flex;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-3) clamp(1rem,3vw,2rem);border-top:1px solid var(--color-line);font-size:var(--text-small)}
        .legal-bar a{color:var(--color-sea-deep);font-weight:600}
      `}</style>
    </footer>
  );
}
