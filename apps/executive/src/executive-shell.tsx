import { useEffect, useState } from "react";
import {
  LOCALE_META,
  localeDirection,
  tUi,
  type LocaleCode,
} from "@hotelos/i18n";
import { AttendancePage, LegalFooter } from "@hotelos/features";
import { Button, CookieBanner } from "@hotelos/ui";
import {
  APP_URLS,
  getConsentSubjectKey,
  logout,
  saveCookieConsent,
  type StoredUser,
} from "@hotelos/web-client";
import { BriefingMeetPage } from "./briefing-meet-page.js";
import { BriefingRoomsPage } from "./briefing-rooms-page.js";
import { ChainDashboard } from "./chain-dashboard.js";
import { CioDigestPage } from "./cio-digest-page.js";
import { OpsDashboardPage } from "./ops-dashboard-page.js";
import { TrustPaymentsPage } from "./trust-payments-page.js";
import { TurboAccountingPage } from "./turbo-accounting-page.js";
import { TurboAutomationsPage } from "./turbo-automations-page.js";
import { TurboChatPage } from "./turbo-chat-page.js";
import { TurboVoicePage } from "./turbo-voice-page.js";

export type ExecutiveShellProps = {
  readonly user: StoredUser;
  readonly onLogout: () => void;
};

type View =
  | { readonly kind: "portfolio" }
  | { readonly kind: "briefings" }
  | { readonly kind: "meet"; readonly roomId: string }
  | { readonly kind: "accounting" }
  | { readonly kind: "chat" }
  | { readonly kind: "automations" }
  | { readonly kind: "voice" }
  | { readonly kind: "attendance" }
  | { readonly kind: "trust" }
  | { readonly kind: "ops" }
  | { readonly kind: "cio" };

const LOCALE_KEY = "hotelos.locale";

function readLocale(): LocaleCode {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored && LOCALE_META.some((item) => item.code === stored)) {
    return stored as LocaleCode;
  }
  return "he";
}

export function ExecutiveShell({ user, onLogout }: ExecutiveShellProps) {
  const [view, setView] = useState<View>({ kind: "portfolio" });
  const [locale, setLocale] = useState<LocaleCode>(readLocale);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  return (
    <div className="shell">
      <nav className="nav" aria-label="HotelOS Turbo OS">
        <div className="brand">
          <strong>{tUi(locale, "app.brand")}</strong>
          <span>{tUi(locale, "app.turbo")}</span>
        </div>
        <div className="tabs hotelos-nav-scroll">
          {(
            [
              ["portfolio", tUi(locale, "nav.portfolio")],
              ["ops", tUi(locale, "nav.ops")],
              ["cio", tUi(locale, "nav.cio")],
              ["briefings", tUi(locale, "nav.briefings")],
              ["accounting", tUi(locale, "nav.accounting")],
              ["chat", tUi(locale, "nav.chat")],
              ["automations", tUi(locale, "nav.automations")],
              ["voice", tUi(locale, "nav.voice")],
              ["attendance", tUi(locale, "nav.attendance")],
              ["trust", tUi(locale, "nav.trust")],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={
                view.kind === kind ||
                (kind === "briefings" && view.kind === "meet")
                  ? "tab tab--on"
                  : "tab"
              }
              onClick={() => setView({ kind })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="nav__actions">
          <label className="locale">
            <span className="sr">Language</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as LocaleCode)}
            >
              {LOCALE_META.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nativeName}
                </option>
              ))}
            </select>
          </label>
          <a href={APP_URLS.admin}>{tUi(locale, "action.openHotelOps")}</a>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              void logout().then(onLogout);
            }}
          >
            {tUi(locale, "action.logout")}
          </Button>
        </div>
      </nav>

      <main
        className={
          view.kind === "portfolio" ? "shell__main shell__main--portfolio" : "shell__main"
        }
      >
        {view.kind === "portfolio" ? (
          <ChainDashboard
            user={user}
            onLogout={onLogout}
            embedded
            locale={locale}
          />
        ) : null}
        {view.kind === "ops" ? <OpsDashboardPage /> : null}
        {view.kind === "cio" ? <CioDigestPage /> : null}
        {view.kind === "briefings" ? (
          <BriefingRoomsPage
            onOpenRoom={(roomId) => setView({ kind: "meet", roomId })}
          />
        ) : null}
        {view.kind === "meet" ? (
          <BriefingMeetPage
            roomId={view.roomId}
            onBack={() => setView({ kind: "briefings" })}
          />
        ) : null}
        {view.kind === "accounting" ? (
          <TurboAccountingPage locale={locale} />
        ) : null}
        {view.kind === "chat" ? <TurboChatPage locale={locale} /> : null}
        {view.kind === "automations" ? (
          <TurboAutomationsPage locale={locale} />
        ) : null}
        {view.kind === "voice" ? <TurboVoicePage locale={locale} /> : null}
        {view.kind === "attendance" ? <AttendancePage /> : null}
        {view.kind === "trust" ? <TrustPaymentsPage /> : null}
      </main>

      <LegalFooter legalUrl={APP_URLS.legal} />

      <CookieBanner
        legalCookiesUrl={APP_URLS.legal("cookies")}
        onConsent={(consent) => {
          void saveCookieConsent({
            subjectKey: getConsentSubjectKey("exec", user.id),
            necessary: consent.necessary,
            functional: consent.functional,
            tenantId: user.tenantId,
          });
        }}
      />

      <p className="hotelos-mobile-hint">{tUi(locale, "mobile.installHint")}</p>

      <style>{`
        .shell { min-height:100vh; display:grid; grid-template-rows:auto 1fr auto; }
        .nav { display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; justify-content:space-between; padding:var(--space-3) clamp(1rem,3vw,2rem); border-bottom:1px solid rgb(16 36 31 / 10%); background:rgb(255 250 242 / 72%); backdrop-filter:blur(10px); position:sticky; top:0; z-index:5; }
        .brand { display:grid; gap:.1rem; }
        .brand strong { font-family:var(--font-display); font-size:1.2rem; }
        .brand span { font-size:var(--text-small); color:var(--color-ink-soft); }
        .tabs { display:flex; gap:var(--space-2); max-width:100%; }
        .tab { font:inherit; font-weight:600; border:1px solid transparent; background:transparent; padding:.65rem 1rem; border-radius:var(--radius-sm); cursor:pointer; color:var(--color-ink-soft); white-space:nowrap; }
        .tab--on { color:var(--color-sea-deep); background:rgb(15 106 92 / 10%); border-color:rgb(15 106 92 / 18%); }
        .nav__actions { display:flex; gap:var(--space-3); align-items:center; flex-wrap:wrap; }
        .nav__actions a { font-weight:600; color:var(--color-sea-deep); }
        .locale select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.45rem .6rem; background:var(--color-paper-elevated); }
        .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
        .shell__main { padding:clamp(1rem,3vw,2.5rem); }
        .shell__main--portfolio { padding-top:var(--space-3); }
        @media (max-width:768px){
          .nav{
            display:grid;
            grid-template-columns:1fr auto;
            grid-template-rows:auto auto;
            gap:var(--space-2);
            padding:var(--space-2) var(--space-3);
          }
          .brand{ grid-column:1; grid-row:1; }
          .nav__actions{ grid-column:2; grid-row:1; justify-self:end; }
          .tabs{ grid-column:1 / -1; grid-row:2; flex-wrap:nowrap; width:100%; }
          .shell__main{ padding:var(--space-3); }
          .shell__main--portfolio{ padding:var(--space-2) var(--space-3) var(--space-3); }
        }
      `}</style>
    </div>
  );
}
