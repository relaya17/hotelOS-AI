import { useEffect, useState } from "react";
import { AttendancePage, LegalFooter } from "@hotelos/features";
import { Button, CookieBanner, SkipLink } from "@hotelos/ui";
import {
  APP_URLS,
  clearSession,
  fetchMe,
  getConsentSubjectKey,
  readAccessToken,
  readStoredUser,
  saveCookieConsent,
  type StoredUser,
} from "@hotelos/web-client";
import { DocsPanel } from "./docs-panel.js";
import { HrAgentPanel } from "./hr-agent-panel.js";
import { MeetJoinPage } from "./meet-join-page.js";
import { InvitePage } from "./invite-page.js";
import { LoginPage } from "./login-page.js";
import {
  canAccessFinancePanel,
  FinancePanel,
} from "./finance-panel.js";
import {
  canAccessOpsCopilot,
  OpsCopilotPanel,
} from "./ops-copilot-panel.js";

type WorkTab = "attendance" | "agent" | "copilot" | "finance" | "docs";

function readInviteToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("invite");
  if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();
  const path = window.location.pathname;
  const match = path.match(/^\/invite\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function readMeetInvite(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("meetInvite");
  if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();
  const path = window.location.pathname;
  const match = path.match(/^\/meet\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function WorkCookieBanner() {
  return (
    <CookieBanner
      legalCookiesUrl={APP_URLS.legal("cookies")}
      onConsent={(consent) => {
        void saveCookieConsent({
          subjectKey: getConsentSubjectKey("work"),
          necessary: consent.necessary,
          functional: consent.functional,
        });
      }}
    />
  );
}

export function App() {
  const [inviteToken, setInviteToken] = useState<string | null>(readInviteToken);
  const [meetInviteToken, setMeetInviteToken] = useState<string | null>(
    readMeetInvite,
  );
  const [user, setUser] = useState<StoredUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<WorkTab>("attendance");
  const showCopilot = user ? canAccessOpsCopilot(user.roles) : false;
  const showFinance = user ? canAccessFinancePanel(user.roles) : false;

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!readAccessToken()) {
        if (!cancelled) {
          setUser(null);
          setBooting(false);
        }
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setUser(readStoredUser() ?? {
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

  if (meetInviteToken) {
    return (
      <>
        <SkipLink />
        {booting ? (
          <main className="work-boot">
            <p>טוען…</p>
          </main>
        ) : !user ? (
          <LoginPage onLoggedIn={setUser} />
        ) : (
          <MeetJoinPage
            token={meetInviteToken}
            onDone={() => {
              window.history.replaceState({}, "", "/");
              setMeetInviteToken(null);
            }}
          />
        )}
        <WorkCookieBanner />
      </>
    );
  }

  if (inviteToken) {
    return (
      <>
        <SkipLink />
        <InvitePage
          token={inviteToken}
          onDone={() => {
            window.history.replaceState({}, "", "/");
            setInviteToken(null);
          }}
        />
        <WorkCookieBanner />
      </>
    );
  }

  if (booting) {
    return (
      <main className="work-boot">
        <p>טוען…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLoggedIn={setUser} />
        <WorkCookieBanner />
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <div className="work-shell">
        <header className="work-bar">
          <div>
            <p className="work-bar__brand">HotelOS Work</p>
            <p className="work-bar__user">{user.displayName}</p>
          </div>
          <nav className="hotelos-seg hotelos-nav-scroll" aria-label="ניווט עובד">
            <button
              type="button"
              className={
                tab === "attendance"
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              aria-pressed={tab === "attendance"}
              onClick={() => setTab("attendance")}
            >
              נוכחות
            </button>
            <button
              type="button"
              className={
                tab === "agent"
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              aria-pressed={tab === "agent"}
              onClick={() => setTab("agent")}
            >
              סוכן HR
            </button>
            {showCopilot ? (
              <button
                type="button"
                className={
                  tab === "copilot"
                    ? "hotelos-seg__item hotelos-seg__item--on"
                    : "hotelos-seg__item"
                }
                aria-pressed={tab === "copilot"}
                onClick={() => setTab("copilot")}
              >
                Copilot תפעול
              </button>
            ) : null}
            {showFinance ? (
              <button
                type="button"
                className={
                  tab === "finance"
                    ? "hotelos-seg__item hotelos-seg__item--on"
                    : "hotelos-seg__item"
                }
                aria-pressed={tab === "finance"}
                onClick={() => setTab("finance")}
              >
                כספים
              </button>
            ) : null}
            <button
              type="button"
              className={
                tab === "docs"
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              aria-pressed={tab === "docs"}
              onClick={() => setTab("docs")}
            >
              מסמכים
            </button>
          </nav>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearSession();
              setUser(null);
            }}
          >
            יציאה
          </Button>
        </header>

        <main id="main-content" className="work-main" tabIndex={-1}>
          {tab === "attendance" ? (
            <>
              <p className="work-hint">
                החתמת נוכחות עם מיקום · אפשר מצב מהיר או אימות מלא
                (קול/חתימה/Passkey) לפי המדיניות של הרשת. פרטיות:{" "}
                <a href={APP_URLS.legal("privacy")}>מדיניות פרטיות</a>
                {" · "}
                <a href={APP_URLS.legal("security")}>אבטחה</a>.
              </p>
              <AttendancePage />
            </>
          ) : null}
          {tab === "agent" ? <HrAgentPanel /> : null}
          {tab === "copilot" && user ? <OpsCopilotPanel user={user} /> : null}
          {tab === "finance" && user ? (
            <FinancePanel roles={user.roles} />
          ) : null}
          {tab === "docs" ? <DocsPanel user={user} /> : null}
        </main>

        <footer className="work-footer">
          <a href={APP_URLS.ops}>ops</a>
          {" · "}
          <a href={APP_URLS.hq}>hq</a>
          {" · "}
          <a href={APP_URLS.book}>book</a>
          {" · "}
          <a href={APP_URLS.legal("dpa")}>תבנית DPA</a>
        </footer>
        <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />
      </div>
      <WorkCookieBanner />
      <style>{`
        .work-boot {
          min-height: 100vh;
          display: grid;
          place-items: center;
          color: var(--color-ink-soft);
        }
        .work-shell {
          min-height: 100vh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: var(--space-4);
          padding: clamp(1rem, 3vw, 1.75rem);
          padding-bottom: calc(clamp(4.5rem, 10vw, 6rem) + env(safe-area-inset-bottom, 0px));
        }
        .work-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--color-paper);
          padding-block: 0.5rem;
          width: 100%;
          min-width: 0;
        }
        .work-bar .hotelos-nav-scroll,
        .work-bar .hotelos-seg {
          max-width: 100%;
        }
        .work-bar__brand {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.25rem;
          color: var(--color-sea-deep);
        }
        .work-bar__user {
          margin: 0.15rem 0 0;
          color: var(--color-ink-soft);
          font-size: var(--text-small);
          font-weight: 500;
        }
        .work-main {
          max-width: 42rem;
          width: 100%;
          margin-inline: auto;
          animation: hotelos-enter var(--motion-med) var(--ease-out) both;
        }
        .work-hint {
          margin: 0 0 var(--space-3);
          color: var(--color-ink-soft);
          font-size: var(--text-small);
          line-height: 1.55;
          font-weight: 500;
        }
        .work-hint a {
          color: var(--color-sea-deep);
          font-weight: 700;
        }
        .work-footer {
          font-size: var(--text-small);
          color: var(--color-ink-faint);
          text-align: center;
        }
        .work-footer a {
          color: inherit;
          font-weight: 600;
          text-decoration: none;
        }
        .work-footer a:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
