import { useEffect, useState } from "react";
import {
  LOCALE_META,
  localeDirection,
  tUi,
  type LocaleCode,
} from "@hotelos/i18n";
import { LegalFooter } from "@hotelos/features";
import { Button, CookieBanner, SkipLink } from "@hotelos/ui";
import {
  APP_URLS,
  getConsentSubjectKey,
  logout,
  saveCookieConsent,
  type StoredUser,
} from "@hotelos/web-client";
import { AiApprovalsPage } from "./ai-approvals-page.js";
import { BriefingMeetPage } from "./briefing-meet-page.js";
import { BriefingRoomsPage } from "./briefing-rooms-page.js";
import { ChainDashboard } from "./chain-dashboard.js";
import { CioDigestPage } from "./cio-digest-page.js";
import { FinanceDoctorPage } from "./finance-doctor-page.js";
import { IncidentCenterPage } from "./incident-center-page.js";
import { KnowledgeCommandPage } from "./knowledge-command-page.js";
import { OpsDashboardPage } from "./ops-dashboard-page.js";
import { PilotRoiPage } from "./pilot-roi-page.js";
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
  | { readonly kind: "trust" }
  | { readonly kind: "ops" }
  | { readonly kind: "incidents" }
  | { readonly kind: "cio" }
  | { readonly kind: "pilot-roi" }
  | { readonly kind: "finance" }
  | { readonly kind: "approvals" }
  | { readonly kind: "knowledge" };

const HASH_VIEWS: Partial<Record<string, View["kind"]>> = {
  ops: "ops",
  "ops-briefing": "ops",
  "ops-pm": "ops",
  incidents: "incidents",
  knowledge: "knowledge",
  cio: "cio",
  "pilot-roi": "pilot-roi",
  finance: "finance",
  approvals: "approvals",
  briefings: "briefings",
  accounting: "accounting",
  chat: "chat",
  automations: "automations",
  voice: "voice",
  trust: "trust",
  portfolio: "portfolio",
};

const OPS_SCROLL_TARGETS: Partial<Record<string, string>> = {
  "ops-briefing": "briefing",
  "ops-pm": "pm-panel",
};

function parseLocationHash(): {
  kind: View["kind"];
  scrollTarget?: string;
  roomId?: string;
} {
  const raw = window.location.hash.slice(1);
  if (!raw) {
    return { kind: "portfolio" };
  }
  if (raw.startsWith("meet/")) {
    const roomId = raw.slice("meet/".length).trim();
    if (roomId.length > 0) {
      return { kind: "meet", roomId };
    }
  }
  const kind = HASH_VIEWS[raw];
  if (kind && kind !== "meet") {
    const scrollTarget = OPS_SCROLL_TARGETS[raw];
    if (scrollTarget) {
      return { kind, scrollTarget };
    }
    return { kind };
  }
  return { kind: "portfolio" };
}

function navigateToView(kind: View["kind"], roomId?: string): void {
  const nextHash =
    kind === "meet" && roomId !== undefined ? `meet/${roomId}` : kind;
  if (window.location.hash !== `#${nextHash}`) {
    window.location.hash = nextHash;
  }
}

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
  const [opsScrollTarget, setOpsScrollTarget] = useState<string | undefined>();
  const [locale, setLocale] = useState<LocaleCode>(readLocale);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  useEffect(() => {
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
  }, [view.kind]);

  useEffect(() => {
    function applyHash() {
      const parsed = parseLocationHash();
      if (parsed.kind === "meet" && parsed.roomId) {
        setView({ kind: "meet", roomId: parsed.roomId });
      } else {
        setView({ kind: parsed.kind } as View);
      }
      setOpsScrollTarget(parsed.scrollTarget);
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
    };
  }, []);

  useEffect(() => {
    if (view.kind !== "ops" || !opsScrollTarget) {
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(opsScrollTarget)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [view.kind, opsScrollTarget]);

  const navItems = [
    ["portfolio", tUi(locale, "nav.portfolio")],
    ["ops", tUi(locale, "nav.ops")],
    ["incidents", tUi(locale, "nav.incidents")],
    ["knowledge", tUi(locale, "nav.knowledge")],
    ["cio", tUi(locale, "nav.cio")],
    ["pilot-roi", "מדדי פיילוט"],
    ["finance", tUi(locale, "nav.finance")],
    ["approvals", tUi(locale, "nav.approvals")],
    ["briefings", tUi(locale, "nav.briefings")],
    ["accounting", tUi(locale, "nav.accounting")],
    ["chat", tUi(locale, "nav.chat")],
    ["automations", tUi(locale, "nav.automations")],
    ["voice", tUi(locale, "nav.voice")],
    ["trust", tUi(locale, "nav.trust")],
  ] as const;

  return (
    <div className="shell">
      <SkipLink />
      <nav className="nav hotelos-app-bar" aria-label="HotelOS Turbo OS">
        <div className="nav__top">
          <div className="brand">
            <strong>{tUi(locale, "app.brand")}</strong>
            <span className="brand__sub">{tUi(locale, "app.turbo")}</span>
          </div>
          <div className="nav__actions">
            <label className="locale">
              <span className="sr">Language</span>
              <select
                className="hotelos-select locale__select"
                value={locale}
                onChange={(event) =>
                  setLocale(event.target.value as LocaleCode)
                }
              >
                {LOCALE_META.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <a className="nav__ops" href={APP_URLS.work}>
              {tUi(locale, "action.openWork")}
            </a>
            <a className="nav__ops" href={APP_URLS.admin}>
              {tUi(locale, "action.openHotelOps")}
            </a>
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
        </div>
        <div className="tabs hotelos-nav-scroll hotelos-seg" role="tablist">
          {navItems.map(([kind, label]) => {
            const on =
              view.kind === kind ||
              (kind === "briefings" && view.kind === "meet");
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={on}
                className={
                  on
                    ? "hotelos-seg__item hotelos-seg__item--on hotelos-touch-target"
                    : "hotelos-seg__item hotelos-touch-target"
                }
                onClick={() => {
                  setView({ kind });
                  navigateToView(kind);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className={
          view.kind === "portfolio"
            ? "shell__main shell__main--portfolio hotelos-page"
            : "shell__main hotelos-page"
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
        {view.kind === "incidents" ? <IncidentCenterPage /> : null}
        {view.kind === "knowledge" ? (
          <KnowledgeCommandPage
            onOpenCio={() => {
              setView({ kind: "cio" });
              navigateToView("cio");
            }}
            onOpenFinance={() => {
              setView({ kind: "finance" });
              navigateToView("finance");
            }}
            onOpenApprovals={() => {
              setView({ kind: "approvals" });
              navigateToView("approvals");
            }}
          />
        ) : null}
        {view.kind === "cio" ? <CioDigestPage /> : null}
        {view.kind === "pilot-roi" ? <PilotRoiPage /> : null}
        {view.kind === "finance" ? <FinanceDoctorPage /> : null}
        {view.kind === "approvals" ? <AiApprovalsPage /> : null}
        {view.kind === "briefings" ? (
          <BriefingRoomsPage
            onOpenRoom={(roomId) => {
              setView({ kind: "meet", roomId });
              navigateToView("meet", roomId);
            }}
          />
        ) : null}
        {view.kind === "meet" ? (
          <BriefingMeetPage
            roomId={view.roomId}
            onBack={() => {
              setView({ kind: "briefings" });
              navigateToView("briefings");
            }}
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
        {view.kind === "trust" ? <TrustPaymentsPage /> : null}
      </main>

      <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />

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
        .nav { display:grid; gap:var(--space-3); padding:var(--space-3) clamp(1rem,3vw,2rem) var(--space-2); }
        .nav__top { display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; justify-content:space-between; min-width:0; }
        .brand { display:grid; gap:.2rem; min-width:0; }
        .brand strong {
          font-family:var(--font-display);
          font-size:clamp(1.35rem,2.2vw,1.65rem);
          line-height:1.1;
          letter-spacing:var(--tracking-display);
        }
        .brand__sub { font-size:var(--text-micro); font-weight:600; color:var(--color-ink-faint); letter-spacing:.04em; }
        .tabs { width:fit-content; max-width:100%; min-width:0; }
        .nav__actions { display:flex; gap:var(--space-2); align-items:center; flex-wrap:wrap; justify-content:flex-end; min-width:0; }
        .nav__ops { font-weight:600; font-size:var(--text-small); color:var(--color-sea-deep); white-space:nowrap; text-decoration:none; }
        .nav__ops:hover { text-decoration:underline; }
        .locale__select { width:auto; min-height:2.5rem; padding:.45rem .7rem; max-width:9.5rem; }
        .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
        .shell__main { padding:0; }
        .shell__main--portfolio { padding-top:0; }
        @media (max-width:768px){
          .nav{ gap:var(--space-2); padding:var(--space-2) var(--space-3); }
          .brand__sub{ display:none; }
          .nav__actions{ width:100%; justify-content:flex-start; }
          .nav__ops{ display:none; }
          .tabs{ width:100%; }
        }
      `}</style>
    </div>
  );
}
