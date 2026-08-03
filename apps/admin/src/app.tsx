import { useEffect, useState } from "react";
import { LegalFooter } from "@hotelos/features";
import { Button, CookieBanner, SkipLink } from "@hotelos/ui";
import {
  APP_URLS,
  clearSession,
  consumeOAuthRedirectHash,
  fetchMe,
  getConsentSubjectKey,
  logout,
  readAccessToken,
  readStoredUser,
  saveCookieConsent,
  type StoredUser,
} from "@hotelos/web-client";
import { DashboardPage } from "./dashboard-page.js";
import { FacilitiesPage } from "./facilities-page.js";
import { KashrutPage } from "./kashrut-page.js";
import { LoginPage } from "./login-page.js";

const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

type View = "ops" | "facilities" | "kashrut";

function readInviteToken(): string | undefined {
  const fromQuery = new URLSearchParams(window.location.search).get("invite");
  if (fromQuery && fromQuery.length > 10) return fromQuery;
  return undefined;
}

function readInitialView(): View {
  const params = new URLSearchParams(window.location.search);
  const panel = params.get("panel");
  if (params.get("hotelId") || (panel && panel.length > 0)) {
    return "facilities";
  }
  return "ops";
}

export function App() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>(readInitialView);
  const inviteToken = readInviteToken();

  useEffect(() => {
    if (!inviteToken) return;
    window.location.replace(`${APP_URLS.work}/invite/${inviteToken}`);
  }, [inviteToken]);

  useEffect(() => {
    if (booting || inviteToken || !user) return;
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
  }, [view, user, booting, inviteToken]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const fromOAuth = consumeOAuthRedirectHash();
      if (fromOAuth) {
        if (!cancelled) {
          setUser(fromOAuth);
          setBooting(false);
        }
        return;
      }

      const token = readAccessToken();
      const stored = readStoredUser();
      if (!token || !stored) {
        if (!cancelled) setBooting(false);
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setUser({
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            roles: me.roles,
            tenantId: me.scope.tenantId,
            ...(me.scope.hotelId !== undefined
              ? { hotelId: me.scope.hotelId }
              : {}),
          });
        }
      } catch {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting || inviteToken) {
    return (
      <main className="boot">
        {inviteToken
          ? "מעביר לפורטל העובדים…"
          : "HotelOS AI · Admin"}
      </main>
    );
  }

  return (
    <div className="admin-root">
      {user ? (
        <>
          <SkipLink />
          <nav className="admin-nav hotelos-app-bar" aria-label="Admin">
            <div className="admin-nav__brand">
              <strong>HotelOS AI</strong>
              <span>תפעול מלון</span>
            </div>
            <div
              className="admin-nav__tabs hotelos-nav-scroll hotelos-seg"
              role="tablist"
            >
              {(
                [
                  ["ops", "חדרים והזמנות"],
                  ["facilities", "מחלקות ותפעול"],
                  ["kashrut", "כשרות"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  className={
                    view === key
                      ? "hotelos-seg__item hotelos-seg__item--on hotelos-touch-target"
                      : "hotelos-seg__item hotelos-touch-target"
                  }
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="admin-nav__actions">
              <a className="link" href={APP_URLS.work}>
                Work · עובדים
              </a>
              <a className="link" href={APP_URLS.executive}>
                Executive
              </a>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void logout().then(() => {
                    setUser(null);
                    setView("ops");
                  });
                }}
              >
                התנתקות
              </Button>
            </div>
          </nav>
          {view === "ops" ? <DashboardPage user={user} /> : null}
          {view === "facilities" ? (
            <main
              id="main-content"
              className="facilities-wrap"
              tabIndex={-1}
            >
              <FacilitiesPage />
            </main>
          ) : null}
          {view === "kashrut" ? (
            <main id="main-content" className="kashrut-wrap" tabIndex={-1}>
              <KashrutPage />
            </main>
          ) : null}
          <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />
        </>
      ) : (
        <LoginPage
          onLoggedIn={(next) => {
            setUser(next);
          }}
        />
      )}
      <CookieBanner
        legalCookiesUrl={APP_URLS.legal("cookies")}
        onConsent={(consent) => {
          void saveCookieConsent({
            subjectKey: getConsentSubjectKey(
              user ? "admin" : "anon",
              user?.id,
            ),
            necessary: consent.necessary,
            functional: consent.functional,
            tenantId: user?.tenantId ?? DEMO_TENANT_ID,
          });
        }}
      />
      <style>{`
        .admin-root{min-height:100vh}
        .admin-nav{display:grid;grid-template-columns:auto 1fr auto;gap:var(--space-3);align-items:center;padding:var(--space-3) clamp(1rem,3vw,2rem);min-width:0}
        .admin-nav__brand{display:grid;gap:.15rem;min-width:0}
        .admin-nav__brand strong{font-family:var(--font-display);font-size:1.3rem;letter-spacing:var(--tracking-display);line-height:1.1}
        .admin-nav__brand span{font-size:var(--text-micro);font-weight:600;color:var(--color-ink-faint);letter-spacing:.04em}
        .admin-nav__tabs{justify-self:center;max-width:100%;min-width:0}
        .admin-nav__actions{display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .link{color:var(--color-sea-deep);font-weight:600;white-space:nowrap;font-size:var(--text-small);text-decoration:none}
        .link:hover{text-decoration:underline}
        .facilities-wrap,.kashrut-wrap{
          width:min(100%,var(--content-max));
          margin-inline:auto;
          padding:var(--space-page);
          min-width:0;
          animation:hotelos-enter var(--motion-med) var(--ease-out) both;
        }
        @media (max-width:900px){
          .admin-nav{grid-template-columns:1fr;gap:var(--space-2);padding:var(--space-2) var(--space-3)}
          .admin-nav__tabs{justify-self:stretch;width:100%}
          .admin-nav__actions{justify-content:flex-start}
        }
      `}</style>
    </div>
  );
}
