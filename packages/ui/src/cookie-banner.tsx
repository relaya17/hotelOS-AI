import { useEffect, useState } from "react";
import { Button } from "./button.js";

const STORAGE_KEY = "hotelos.cookieConsent.v2026.1";

export type CookieBannerProps = {
  readonly legalCookiesUrl: string;
  readonly onConsent?: (input: {
    readonly necessary: boolean;
    readonly functional: boolean;
  }) => void;
};

export function CookieBanner({
  legalCookiesUrl,
  onConsent,
}: CookieBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) setVisible(true);
  }, []);

  function accept(functional: boolean) {
    const payload = { necessary: true, functional, at: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    onConsent?.({ necessary: true, functional });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="cookie"
      role="dialog"
      aria-modal="true"
      aria-label="הסכמת עוגיות"
    >
      <p>
        אנו משתמשים באחסון הכרחי לסשן ואבטחה. עוגיות פונקציונליות לשפה והעדפות.{" "}
        <a href={legalCookiesUrl}>מדיניות עוגיות</a>
      </p>
      <div className="actions">
        <Button type="button" variant="ghost" onClick={() => accept(false)}>
          הכרחי בלבד
        </Button>
        <Button type="button" onClick={() => accept(true)}>
          אישור מלא
        </Button>
      </div>
      <style>{`
        .cookie{position:fixed;inset-inline:var(--space-3);bottom:var(--space-3);z-index:40;display:grid;gap:var(--space-3);padding:var(--space-4);max-width:42rem;margin-inline:auto;background:rgb(255 250 242 / 96%);border:1px solid rgb(16 36 31 / 12%);border-radius:var(--radius-md);box-shadow:var(--shadow-soft)}
        .cookie p{margin:0;color:var(--color-ink-soft);font-size:var(--text-small)}
        .actions{display:flex;gap:var(--space-2);flex-wrap:wrap}
      `}</style>
    </aside>
  );
}
