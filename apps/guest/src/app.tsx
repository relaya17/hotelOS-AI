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

const highlights: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "איתור שהייה מיידי",
    body: "מייל אחד — וכל פרטי ההזמנה, החדר ותאריכי הצ׳ק-אין/אאוט מולכם.",
  },
  {
    title: "שכבת AI חכמה",
    body: "אותה תשתית שמפעילה את הצוות וההנהלה של הרשת, מותאמת לשירות האורח.",
  },
  {
    title: "פרטיות ואבטחה תחילה",
    body: "עמידה בתנאי שימוש, מדיניות עוגיות ופרטיות ברורים — לא רק תג משפטי.",
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
      </p>
      <p className="site-footer__staff">
        <a href={APP_URLS.admin}>צוות</a>
        {" · "}
        <a href={APP_URLS.executive}>הנהלה</a>
      </p>
      <style>{`
        .site-footer { margin-top:auto; padding-top:var(--space-6); display:grid; gap:var(--space-2); font-size:var(--text-small); color:var(--color-ink-soft); }
        .site-footer p { margin:0; }
        .site-footer__staff { opacity:.55; font-size:.8rem; }
        .site-footer a { color:inherit; }
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
            loadError instanceof Error ? loadError.message : "Legal load failed",
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
        <p className="eyebrow">HotelOS AI · Legal</p>
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
          .legal{max-width:48rem;margin:0 auto;padding:clamp(1.5rem,4vw,3rem);display:grid;gap:var(--space-4)}
          .eyebrow{margin:0;letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
          h1{margin:0;font-size:var(--text-display)}
          .meta{margin:0;color:var(--color-ink-soft)}
          section h2{margin:0 0 var(--space-2);font-size:1.2rem}
          section p{margin:0;color:var(--color-ink-soft);line-height:1.7}
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
        <section className="hero">
          <p className="eyebrow">Guest App · HotelOS AI</p>
          <h1>השהייה שלכם, חכמה יותר</h1>
          <p className="lede">
            <strong>HotelOS AI</strong> היא שכבת האינטליגנציה של הרשת שלכם —
            צפו בשהייה, בחדר ובשירותי המלון בזמן אמת, בלי לעמוד בתור בקבלה
            ובלי אפליקציה נפרדת להתקין.
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

      <section className="panel">
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
          min-height:100vh;
          display:grid;
          grid-template-columns:1.05fr .95fr;
          gap:var(--space-6);
          padding:clamp(1.5rem,4vw,4rem);
          padding-bottom:clamp(5rem,12vw,7rem);
          align-items:start;
        }
        .shell--stay { grid-template-columns:1fr; max-width:42rem; margin-inline:auto; width:100%; }
        .eyebrow { margin:0 0 var(--space-3); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .lede { margin:var(--space-4) 0 0; max-width:40ch; color:var(--color-ink-soft); font-size:1.15rem; line-height:1.6; }
        .highlights { list-style:none; margin:var(--space-5) 0 0; padding:0; display:grid; gap:var(--space-3); max-width:40ch; }
        .highlights li { display:grid; gap:.2rem; }
        .highlights h3 { margin:0; font-size:1rem; font-family:var(--font-display); color:var(--color-sea-deep); }
        .highlights p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); line-height:1.6; }
        .panel { background:rgb(255 250 242 / 88%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .15rem); box-shadow:var(--shadow-soft); padding:clamp(1.4rem,3vw,2.2rem); display:grid; gap:var(--space-5); }
        .form { display:grid; gap:var(--space-4); }
        .form h2 { margin:0; font-size:var(--text-title); }
        .form-lede { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); line-height:1.6; }
        @media (max-width:900px){ .shell{ grid-template-columns:1fr; } }
      `}</style>
    </main>
    </>
  );
}
