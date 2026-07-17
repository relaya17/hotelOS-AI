export type LegalFooterProps = {
  readonly legalUrl: (doc: "terms" | "cookies" | "security" | "privacy") => string;
};

export function LegalFooter({ legalUrl }: LegalFooterProps) {
  return (
    <footer className="legal-bar">
      <a href={legalUrl("terms")}>תנאי שימוש</a>
      <a href={legalUrl("cookies")}>עוגיות</a>
      <a href={legalUrl("security")}>אבטחה</a>
      <a href={legalUrl("privacy")}>פרטיות</a>
      <style>{`
        .legal-bar{display:flex;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-3) clamp(1rem,3vw,2rem);border-top:1px solid rgb(16 36 31 / 10%);font-size:var(--text-small)}
        .legal-bar a{color:var(--color-sea-deep);font-weight:600}
      `}</style>
    </footer>
  );
}
