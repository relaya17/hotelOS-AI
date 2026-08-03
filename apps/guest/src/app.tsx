import { useEffect, useState, type FormEvent } from "react";
import { Button, CookieBanner, TextField, SkipLink } from "@hotelos/ui";
import {
  APP_URLS,
  fetchLegalDocument,
  getConsentSubjectKey,
  lookupGuestStay,
  saveCookieConsent,
  type GuestStayDto,
  type LegalDocDetail,
} from "@hotelos/web-client";
import { BookFlow } from "./book-flow.js";
import { LandingPage } from "./landing-page.js";
import { StayHub } from "./stay-hub.js";

type GuestView = "landing" | "find-stay" | "book";

function GuestCookieBanner() {
  return (
    <CookieBanner
      legalCookiesUrl={APP_URLS.legal("cookies")}
      onConsent={(consent) => {
        void saveCookieConsent({
          subjectKey: getConsentSubjectKey("guest"),
          necessary: consent.necessary,
          functional: consent.functional,
        });
      }}
    />
  );
}

function readLegalDoc(): string | null {
  return new URLSearchParams(window.location.search).get("doc");
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__legal">
        <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
        {" · "}
        <a href={APP_URLS.legal("cookies")}>עוגיות</a>
        {" · "}
        <a href={APP_URLS.legal("security")}>אבטחה</a>
        {" · "}
        <a href={APP_URLS.legal("privacy")}>פרטיות</a>
      </p>
      <p className="site-footer__staff">
        <a href={APP_URLS.admin}>ops</a>
        {" · "}
        <a href={APP_URLS.executive}>hq</a>
      </p>
      <style>{`
        .site-footer {
          margin-top: auto;
          padding-top: var(--space-6);
          display: grid;
          gap: var(--space-2);
          font-size: var(--text-small);
          color: var(--color-ink-soft);
          border-top: 1px solid var(--color-line);
        }
        .site-footer p { margin: 0; }
        .site-footer__staff { opacity: .55; font-size: .8rem; }
        .site-footer a { color: inherit; font-weight: 600; text-decoration: none; }
        .site-footer a:hover { text-decoration: underline; }
      `}</style>
    </footer>
  );
}

export function App() {
  const [legalId, setLegalId] = useState<string | null>(readLegalDoc);
  const [legalDoc, setLegalDoc] = useState<LegalDocDetail | null>(null);
  const [view, setView] = useState<GuestView>("landing");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [stays, setStays] = useState<readonly GuestStayDto[] | null>(null);
  const [selectedStayIndex, setSelectedStayIndex] = useState(0);

  useEffect(() => {
    if (!legalId) {
      setLegalDoc(null);
      return;
    }
    let cancelled = false;
    void fetchLegalDocument(legalId)
      .then((doc) => {
        if (!cancelled) setLegalDoc(doc);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Legal load failed",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [legalId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const data = await lookupGuestStay(email);
      setStays(data);
      setSelectedStayIndex(0);
      if (data.length === 0) {
        setError("לא נמצאה שהייה פעילה לאימייל זה");
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error ? lookupError.message : "שגיאה בחיפוש",
      );
      setStays(null);
    } finally {
      setLoading(false);
    }
  }

  function handleStayUpdated(updated: GuestStayDto) {
    setStays((current) => {
      if (!current) return current;
      return current.map((item) =>
        item.bookingId === updated.bookingId ? updated : item,
      );
    });
  }

  function handleSearchAgain() {
    setStays(null);
    setError(undefined);
    setSelectedStayIndex(0);
    setView("find-stay");
  }

  function goFindStay() {
    setView("find-stay");
    setError(undefined);
  }

  function goBookIntent() {
    setView("book");
    setError(undefined);
  }

  async function handleBooked(input: {
    readonly email: string;
    readonly bookingId: string;
  }) {
    setEmail(input.email);
    setLoading(true);
    setError(undefined);
    try {
      const data = await lookupGuestStay(input.email);
      setStays(data);
      const index = data.findIndex((stay) => stay.bookingId === input.bookingId);
      setSelectedStayIndex(index >= 0 ? index : 0);
      if (data.length === 0) {
        setError("ההזמנה נוצרה אך לא נמצאה בחיפוש — נסו כניסה לשהייה");
        setView("find-stay");
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error ? lookupError.message : "שגיאה בטעינת שהייה",
      );
      setView("find-stay");
    } finally {
      setLoading(false);
    }
  }

  const hasStay = stays !== null && stays.length > 0;

  if (legalDoc) {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="legal" tabIndex={-1}>
          <p className="hotelos-eyebrow">HotelOS AI · Legal</p>
          <h1>{legalDoc.titleHe}</h1>
          <p className="meta">
            v{legalDoc.version} · עודכן {legalDoc.updatedAt}
          </p>
          {legalDoc.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              window.history.replaceState({}, "", "/");
              setLegalId(null);
              setView("landing");
            }}
          >
            חזרה לדף הבית
          </Button>
          <GuestCookieBanner />
          <style>{`
            .legal{max-width:48rem;margin:0 auto;padding:clamp(1.5rem,4vw,3rem);display:grid;gap:var(--space-4);animation:hotelos-enter var(--motion-med) var(--ease-out) both}
            .meta{color:var(--color-ink-soft);font-weight:500}
            section h2{font-size:1.2rem;margin-bottom:var(--space-2)}
            section p{color:var(--color-ink-soft);line-height:1.7;font-weight:500}
          `}</style>
        </main>
      </>
    );
  }

  if (hasStay) {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="shell shell--stay" tabIndex={-1}>
          <section className="panel hotelos-surface">
            <StayHub
              email={email}
              stays={stays}
              selectedIndex={selectedStayIndex}
              onSelectStay={setSelectedStayIndex}
              onStayUpdated={handleStayUpdated}
              onSearchAgain={handleSearchAgain}
            />
          </section>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{stayShellStyles}</style>
        </main>
      </>
    );
  }

  if (view === "book") {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="shell shell--find" tabIndex={-1}>
          <section className="panel hotelos-surface">
            <BookFlow
              onCancel={() => {
                setView("landing");
                setError(undefined);
              }}
              onBooked={handleBooked}
            />
          </section>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{stayShellStyles}</style>
        </main>
      </>
    );
  }

  if (view === "find-stay") {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="shell shell--find" tabIndex={-1}>
          <section className="panel hotelos-surface">
            <form className="form" onSubmit={onSubmit} noValidate>
              <p className="hotelos-eyebrow">HotelOS</p>
              <h1>השהייה שלי</h1>
              <p className="form-lede">
                הזינו את האימייל שבו נעשה ההזמנה — ונציג את פרטי השהייה.
              </p>
              <TextField
                label="אימייל בהזמנה"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                {...(error !== undefined ? { error } : {})}
              />
              <div className="form-actions">
                <Button type="submit" disabled={loading}>
                  {loading ? "מחפש…" : "מצא שהייה"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setView("landing");
                    setError(undefined);
                  }}
                >
                  חזרה לדף הבית
                </Button>
              </div>
            </form>
          </section>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{stayShellStyles}</style>
        </main>
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <main id="main-content" tabIndex={-1}>
        <LandingPage onBookIntent={goBookIntent} onFindStay={goFindStay} />
        <GuestCookieBanner />
      </main>
    </>
  );
}

const stayShellStyles = `
  .shell {
    min-height: 100vh;
    display: grid;
    gap: clamp(1.5rem, 4vw, 3.5rem);
    padding: clamp(1.5rem, 4vw, 4rem);
    padding-bottom: clamp(5rem, 12vw, 7rem);
    align-items: start;
    animation: hotelos-enter var(--motion-med) var(--ease-out) both;
  }
  .shell--stay,
  .shell--find {
    grid-template-columns: 1fr;
    max-width: 42rem;
    margin-inline: auto;
    width: 100%;
  }
  .panel {
    padding: clamp(1.4rem, 3vw, 2.2rem);
    display: grid;
    gap: var(--space-5);
  }
  .form { display: grid; gap: var(--space-4); }
  .form h1 { font-size: clamp(1.6rem, 3vw, 2rem); }
  .form-lede {
    color: var(--color-ink-soft);
    font-size: var(--text-small);
    font-weight: 500;
    line-height: 1.6;
  }
  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  @media (max-width: 900px) {
    .shell {
      padding: var(--space-5) var(--space-3) clamp(5rem, 12vw, 7rem);
    }
  }
`;
