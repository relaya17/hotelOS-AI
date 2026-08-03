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
import { StayHub } from "./stay-hub.js";

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

const highlights: readonly { readonly title: string; readonly body: string }[] =
  [
    {
      title: "החדר מוכן מתי שצריך",
      body: "מעקב ניקיון והזמנה לחדר — בלי להתקשר לקבלה בכל רבע שעה.",
    },
    {
      title: "בקשות שירות במקום",
      body: "מגבות, כריות או שאלה קצרה — נשלח ישירות לצוות.",
    },
    {
      title: "אומדן חשבון שקוף",
      body: "רואים לינה וארוחת בוקר לפני הצ׳ק־אאוט.",
    },
  ];

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
        {" · "}
        <a href="#accessibility">הצהרת נגישות</a>
      </p>
      <p className="site-footer__staff">
        <a href={APP_URLS.admin}>צוות</a>
        {" · "}
        <a href={APP_URLS.executive}>הנהלה</a>
      </p>
      <style>{`
        .site-footer {
          grid-column: 1 / -1;
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
  const [email, setEmail] = useState("noa@example.com");
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
            }}
          >
            חזרה לאפליקציית אורחים
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

  return (
    <>
      <SkipLink />
      <main
        id="main-content"
        className={`shell${hasStay ? " shell--stay" : ""}`}
        tabIndex={-1}
      >
        {!hasStay ? (
          <section className="hero" aria-labelledby="guest-hero-title">
            <p className="brand">HotelOS AI</p>
            <h1 id="guest-hero-title">השהייה שלכם, חכמה יותר</h1>
            <p className="lede">
              שכבת האינטליגנציה של המלון — חדר, שירות וחשבון בזמן אמת, בלי תור
              בקבלה.
            </p>
            <ul className="highlights">
              {highlights.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="panel hotelos-surface">
          {hasStay ? (
            <StayHub
              email={email}
              stays={stays}
              selectedIndex={selectedStayIndex}
              onSelectStay={setSelectedStayIndex}
              onStayUpdated={handleStayUpdated}
              onSearchAgain={handleSearchAgain}
            />
          ) : (
            <form className="form" onSubmit={onSubmit} noValidate>
              <h2>השהייה שלי</h2>
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
                {...(error !== undefined ? { error } : {})}
              />
              <Button type="submit" disabled={loading}>
                {loading ? "מחפש…" : "מצא שהייה"}
              </Button>
            </form>
          )}
        </section>

        <SiteFooter />
        <GuestCookieBanner />

        <style>{`
          .shell {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 1.08fr .92fr;
            gap: clamp(1.5rem, 4vw, 3.5rem);
            padding: clamp(1.5rem, 4vw, 4rem);
            padding-bottom: clamp(5rem, 12vw, 7rem);
            align-items: center;
            animation: hotelos-enter var(--motion-med) var(--ease-out) both;
          }
          .shell--stay {
            grid-template-columns: 1fr;
            max-width: 42rem;
            margin-inline: auto;
            width: 100%;
            align-items: start;
          }
          .hero { display: grid; gap: var(--space-4); max-width: 34rem; }
          .brand {
            margin: 0;
            font-family: var(--font-display);
            font-size: clamp(2.1rem, 5vw, 3rem);
            letter-spacing: var(--tracking-display);
            color: var(--color-sea-deep);
            line-height: 1.05;
          }
          h1 {
            font-size: clamp(1.65rem, 3.4vw, 2.25rem);
            color: var(--color-ink);
          }
          .lede {
            max-width: 36ch;
            color: var(--color-ink-soft);
            font-size: 1.1rem;
            font-weight: 500;
            line-height: 1.65;
          }
          .highlights {
            list-style: none;
            margin: var(--space-2) 0 0;
            padding: 0;
            display: grid;
            gap: var(--space-3);
          }
          .highlights li { display: grid; gap: .3rem; }
          .highlights h3 { font-size: 1.05rem; color: var(--color-sea-deep); }
          .highlights p {
            color: var(--color-ink-soft);
            font-size: var(--text-small);
            font-weight: 500;
            line-height: 1.55;
          }
          .panel {
            padding: clamp(1.4rem, 3vw, 2.2rem);
            display: grid;
            gap: var(--space-5);
          }
          .form { display: grid; gap: var(--space-4); }
          .form h2 { font-size: var(--text-title); }
          .form-lede {
            color: var(--color-ink-soft);
            font-size: var(--text-small);
            font-weight: 500;
            line-height: 1.6;
          }
          @media (max-width: 900px) {
            .shell {
              grid-template-columns: 1fr;
              padding: var(--space-5) var(--space-3) clamp(5rem, 12vw, 7rem);
              gap: var(--space-5);
              align-items: start;
            }
            .brand { font-size: clamp(1.9rem, 8vw, 2.5rem); }
            .lede { max-width: none; }
          }
        `}</style>
      </main>
    </>
  );
}
