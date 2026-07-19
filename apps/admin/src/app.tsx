import { useEffect, useState } from "react";
import { AttendancePage, LegalFooter } from "@hotelos/features";
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
import { InvitePage } from "./invite-page.js";
import { KashrutPage } from "./kashrut-page.js";
import { LoginPage } from "./login-page.js";

const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

type View = "ops" | "facilities" | "kashrut" | "attendance";

function readInviteToken(): string | undefined {
  const fromQuery = new URLSearchParams(window.location.search).get("invite");
  if (fromQuery && fromQuery.length > 10) return fromQuery;
  return undefined;
}

export function App() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("ops");
  const inviteToken = readInviteToken();

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

  if (booting) {
    return <main className="boot">HotelOS AI · Admin</main>;
  }

  if (inviteToken) {
    return (
      <>
        <SkipLink />
        <InvitePage token={inviteToken} />
      </>
    );
  }

  return (
    <div className="admin-root">
      <SkipLink />
      {user ? (
        <>
          <nav className="admin-nav" aria-label="Admin">
            <button
              type="button"
              className={
                view === "ops"
                  ? "tab tab--on hotelos-touch-target"
                  : "tab hotelos-touch-target"
              }
              onClick={() => setView("ops")}
            >
              חדרים והזמנות
            </button>
            <button
              type="button"
              className={
                view === "facilities"
                  ? "tab tab--on hotelos-touch-target"
                  : "tab hotelos-touch-target"
              }
              onClick={() => setView("facilities")}
            >
              מחלקות ותפעול
            </button>
            <button
              type="button"
              className={
                view === "kashrut"
                  ? "tab tab--on hotelos-touch-target"
                  : "tab hotelos-touch-target"
              }
              onClick={() => setView("kashrut")}
            >
              כשרות
            </button>
            <button
              type="button"
              className={
                view === "attendance"
                  ? "tab tab--on hotelos-touch-target"
                  : "tab hotelos-touch-target"
              }
              onClick={() => setView("attendance")}
            >
              נוכחות מהטלפון
            </button>
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
          {view === "attendance" ? (
            <main
              id="main-content"
              className="attendance-wrap"
              tabIndex={-1}
            >
              <AttendancePage />
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
        .admin-nav{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;padding:var(--space-3) clamp(1rem,3vw,2rem);border-bottom:1px solid rgb(16 36 31 / 10%);background:rgb(255 250 242 / 80%)}
        .tab{border:1px solid rgb(16 36 31 / 14%);background:transparent;border-radius:var(--radius-sm);padding:.55rem .9rem;font:inherit;cursor:pointer;font-weight:600}
        .tab--on{background:var(--color-sea-deep);color:#fff;border-color:transparent}
        .link{margin-inline-start:auto;color:var(--color-sea-deep);font-weight:600}
        .attendance-wrap,.facilities-wrap,.kashrut-wrap{padding:clamp(1rem,3vw,2rem)}
      `}</style>
    </div>
  );
}
