import { useEffect, useState, type FormEvent } from "react";
import { LegalFooter } from "@hotelos/features";
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
import { VoiceBookAssistant } from "./voice-book-assistant.js";

type GuestView = "landing" | "find-stay" | "book" | "voice-book";

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
    <div className="site-footer">
      <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />
      <p className="site-footer__staff">
        <a href={APP_URLS.work}>work</a>
        {" · "}
        <a href={APP_URLS.ops}>ops</a>
        {" · "}
        <a href={APP_URLS.hq}>hq</a>
      </p>
      <style>{`
        .site-footer {
          margin-top: auto;
          padding-top: var(--space-6);
          display: grid;
          gap: var(--space-2);
          font-size: var(--text-small);
          color: #3a4e48;
        }
        .site-footer p { margin: 0; }
        .site-footer__staff { font-size: .8rem; color: var(--color-sea-deep); }
        .site-footer__staff a { color: inherit; font-weight: 600; text-decoration: none; }
        .site-footer__staff a:hover { text-decoration: underline; }
      `}</style>
    </div>
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
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
  }, [view, legalId]);

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

  function goVoiceBook() {
    setView("voice-book");
    setError(undefined);
  }

  function goFormBook() {
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
          <header className="legal__head">
            <p className="hotelos-eyebrow">HotelOS AI · Legal</p>
            <h1>{legalDoc.titleHe}</h1>
            {legalDoc.titleEn ? (
              <p className="legal__title-en">{legalDoc.titleEn}</p>
            ) : null}
            <p className="meta">
              v{legalDoc.version} · עודכן {legalDoc.updatedAt}
            </p>
            <nav className="legal__toc" aria-label="סעיפים">
              {legalDoc.sections.map((section, index) => {
                const sectionId = `legal-section-${index + 1}`;
                return (
                  <a key={sectionId} href={`#${sectionId}`}>
                    {section.heading}
                  </a>
                );
              })}
            </nav>
          </header>
          {legalDoc.sections.map((section, index) => (
            <section
              key={`legal-section-${index + 1}`}
              id={`legal-section-${index + 1}`}
              className="legal__section"
            >
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <div className="legal__actions">
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
            {legalId === "security" ? (
              <a className="legal__security-txt" href={APP_URLS.legal("privacy")}>
                מדיניות פרטיות
              </a>
            ) : (
              <a
                className="legal__security-txt"
                href={APP_URLS.legal("security")}
              >
                מדיניות אבטחה
              </a>
            )}
          </div>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{`
            .legal{max-width:48rem;margin:0 auto;padding:clamp(1.5rem,4vw,3rem);display:grid;gap:var(--space-4);animation:hotelos-enter var(--motion-med) var(--ease-out) both}
            .legal__head{display:grid;gap:var(--space-2)}
            .legal__title-en{margin:0;color:var(--color-ink-soft);font-weight:600}
            .meta{color:var(--color-ink-soft);font-weight:500}
            .legal__toc{display:flex;flex-wrap:wrap;gap:.45rem .75rem;padding:var(--space-3);border:1px solid var(--color-line);border-radius:var(--radius-md);background:var(--color-paper-elevated)}
            .legal__toc a{font-size:var(--text-small);font-weight:600;color:var(--color-sea-deep);text-decoration:none}
            .legal__toc a:hover,.legal__toc a:focus-visible{text-decoration:underline}
            .legal__section{padding-top:var(--space-2);border-top:1px solid var(--color-line)}
            .legal__section h2{font-size:1.15rem;margin:0 0 var(--space-2);scroll-margin-top:5rem}
            .legal__section p{margin:0;color:var(--color-ink-soft);line-height:1.75;font-weight:500;white-space:pre-wrap}
            .legal__actions{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center}
            .legal__security-txt{font-weight:700;color:var(--color-sea-deep)}
            @media (max-width:480px){
              .legal__toc{flex-direction:column}
            }
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

  if (view === "voice-book") {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="shell shell--find" tabIndex={-1}>
          <section className="panel hotelos-surface">
            <VoiceBookAssistant
              onCancel={() => {
                setView("landing");
                setError(undefined);
              }}
              onBooked={handleBooked}
            />
            <div className="book-switch">
              <span>או</span>
              <Button type="button" variant="ghost" onClick={goFormBook}>
                הזמנה בטופס
              </Button>
            </div>
          </section>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{`${stayShellStyles}
            .book-switch {
              margin-top: var(--space-4);
              display: flex; gap: var(--space-2); align-items: center; justify-content: center;
              color: var(--color-ink-soft); font-weight: 600;
            }
          `}</style>
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
            <div className="book-switch">
              <span>או</span>
              <Button type="button" variant="ghost" onClick={goVoiceBook}>
                הזמנה בקול / שיחה
              </Button>
            </div>
          </section>
          <SiteFooter />
          <GuestCookieBanner />
          <style>{`${stayShellStyles}
            .book-switch {
              margin-top: var(--space-4);
              display: flex; gap: var(--space-2); align-items: center; justify-content: center;
              color: var(--color-ink-soft); font-weight: 600;
            }
          `}</style>
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
        <LandingPage
          onVoiceBook={goVoiceBook}
          onFormBook={goFormBook}
          onFindStay={goFindStay}
        />
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
