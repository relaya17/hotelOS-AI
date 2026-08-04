import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { LegalFooter } from "@hotelos/features";
import { CookieBanner } from "@hotelos/ui";
import {
  APP_URLS,
  getConsentSubjectKey,
  saveCookieConsent,
} from "@hotelos/web-client";
import {
  CAPABILITIES,
  CEO_BARS,
  CHAT_DEMO,
  DEMO_BEATS,
  DIGITIZATION,
  EXCELLENCE_LINKS,
  FRAGMENTED_STACK,
  INTEGRATIONS,
  ORG_NODES,
  OUTCOMES,
  PACKAGES,
  PILOT_STEPS,
  TAGLINES,
  TRUST_CONTROLS,
  WORLD_COMPARISON,
} from "./content.js";
import { StatusSectionContent } from "./status-section.js";

const PILOT_MAIL =
  "mailto:pilot@hotelos.ai?subject=HotelOS%20AI%20Pilot&body=שלום%2C%20אשמח%20לדבר%20על%20פיילוט%20HotelOS%20AI%20לרשת%20שלנו.";

const CALENDLY_URL = (
  import.meta.env["VITE_CALENDLY_URL"] as string | undefined
)?.trim();

const DEMO_VIDEO_URL = (
  import.meta.env["VITE_DEMO_VIDEO_URL"] as string | undefined
)?.trim();

const PARTNER_NAMES = (
  import.meta.env["VITE_PARTNER_NAMES"] as string | undefined
)
  ?.split(",")
  .map((name) => name.trim())
  .filter((name) => name.length > 0) ?? [];

const NAV_LINKS = [
  { href: "#outcomes", label: "תוצאות" },
  { href: "#demo", label: "דמו" },
  { href: "#how-pilot", label: "פיילוט" },
  { href: "#packages", label: "חבילות" },
  { href: "#measure", label: "מדידה" },
  { href: "#trust", label: "אמון" },
  { href: "#excellence", label: "מצוינות" },
  { href: "#faq", label: "שאלות" },
] as const;

function ContactLeadForm() {
  const [name, setName] = useState("");
  const [hotel, setHotel] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = [
      "שלום,",
      "",
      "אשמח לדבר על פיילוט HotelOS AI.",
      "",
      `שם: ${name.trim() || "—"}`,
      `מלון / רשת: ${hotel.trim() || "—"}`,
      `אימייל: ${email.trim() || "—"}`,
      note.trim() ? `הערה: ${note.trim()}` : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n");
    const href = `mailto:pilot@hotelos.ai?subject=${encodeURIComponent(
      "HotelOS AI Pilot",
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      <div className="lead-form__grid">
        <label className="lead-form__field">
          <span>שם</span>
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="lead-form__field">
          <span>מלון / רשת</span>
          <input
            name="hotel"
            value={hotel}
            onChange={(event) => setHotel(event.target.value)}
            required
          />
        </label>
        <label className="lead-form__field lead-form__field--full">
          <span>אימייל</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="lead-form__field lead-form__field--full">
          <span>הערה (אופציונלי)</span>
          <textarea
            name="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <div className="lead-form__actions">
        <button className="btn btn--primary" type="submit">
          שליחה לפתיחת מייל
        </button>
        {CALENDLY_URL ? (
          <a
            className="btn btn--ghost"
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
          >
            קביעת שיחה ביומן
          </a>
        ) : (
          <a className="btn btn--ghost" href={PILOT_MAIL}>
            או מייל ישיר
          </a>
        )}
      </div>
      <p className="lead-form__hint">
        הטופס פותח את תוכנת המייל שלכם עם הפרטים — בלי שרת לידים. אפשר להגדיר{" "}
        <code>VITE_CALENDLY_URL</code> לקישור יומן.
      </p>
    </form>
  );
}

function MeasurePlanner() {
  const [briefingMin, setBriefingMin] = useState(45);
  const [managers, setManagers] = useState(3);
  const [days, setDays] = useState(6);
  const hoursNow = (briefingMin * managers * days) / 60;

  return (
    <div className="measure">
      <p className="measure__disclaimer">
        מחשבים רק את נקודת הפתיחה שלכם לתדריך. יעד השיפור נקבע אחרי baseline
        ב־Pilot ROI Scorecard — בלי אחוז קבוע מראש באתר.
      </p>
      <div className="measure__controls">
        <label>
          <span>דק׳ תדריך בוקר היום</span>
          <input
            type="range"
            min={15}
            max={90}
            value={briefingMin}
            onChange={(event) => setBriefingMin(Number(event.target.value))}
          />
          <strong>{briefingMin}</strong>
        </label>
        <label>
          <span>מנהלים בתדריך</span>
          <input
            type="range"
            min={1}
            max={8}
            value={managers}
            onChange={(event) => setManagers(Number(event.target.value))}
          />
          <strong>{managers}</strong>
        </label>
        <label>
          <span>ימי תדריך / שבוע</span>
          <input
            type="range"
            min={3}
            max={7}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          />
          <strong>{days}</strong>
        </label>
      </div>
      <dl className="measure__out">
        <div>
          <dt>שעות תדריך / שבוע — מצב נוכחי</dt>
          <dd>{hoursNow.toFixed(1)}</dd>
        </div>
      </dl>
      <p className="section__note">
        אחרי שבוע 0 ממלאים יעד משלכם ב־
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
          scorecard
        </a>
        {" · "}
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/sales-pack/case-study-frame.md">
          תבנית case study
        </a>
        .
      </p>
    </div>
  );
}

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({
  id,
  className,
  children,
  "aria-labelledby": labelledBy,
  tabIndex,
}: {
  readonly id: string;
  readonly className: string;
  readonly children: ReactNode;
  readonly "aria-labelledby": string;
  readonly tabIndex?: number;
}) {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      id={id}
      className={`reveal ${className}`}
      aria-labelledby={labelledBy}
      tabIndex={tabIndex}
    >
      {children}
    </section>
  );
}

export function LandingPage() {
  const [activeTag, setActiveTag] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTag((prev) => (prev + 1) % TAGLINES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => {
      if (!mq.matches) setMenuOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site">
      <a className="skip" href="#outcomes">
        דלג לתוכן
      </a>

      <header className={navSolid || menuOpen ? "top is-solid" : "top"}>
        <a
          className="top__brand"
          href="#top"
          aria-label="HotelOS AI — ראש העמוד"
          onClick={closeMenu}
        >
          <span className="top__brand-text">
            HotelOS <span className="top__brand-ai">AI</span>
          </span>
        </a>

        <button
          type="button"
          className={menuOpen ? "top__burger is-open" : "top__burger"}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav
          id={menuId}
          className={menuOpen ? "top__nav is-open" : "top__nav"}
          aria-label="ניווט ראשי"
        >
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <a href="#contact" className="top__cta" onClick={closeMenu}>
            פיילוט
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-brand">
          <div className="hero__media" aria-hidden="true" />
          <div className="hero__veil" aria-hidden="true" />
          <div className="hero__copy">
            <div className="hero__identity">
              <p id="hero-brand" className="hero__wordmark">
                HotelOS <span className="hero__wordmark-ai">AI</span>
              </p>
              <img
                className="hero__mark"
                src="/brand-mark.svg"
                width={64}
                height={72}
                alt=""
                decoding="async"
                fetchPriority="high"
              />
            </div>
            <h1 className="hero__title">
              The Intelligence Layer for Hotels
            </h1>
            <p className="hero__lead">
              תמונה אחת מעל ה־PMS: מה קורה עכשיו, מה צפוי מחר — בלי להחליף את
              מערכת ההזמנות.
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#contact">
                בקשת פיילוט לרשת
              </a>
              <a className="btn btn--ghost" href="#demo">
                סיור דמו · 3 פעימות
              </a>
            </div>
          </div>
        </section>

        <p className="truth-strip" role="note">
          לא מחליפים PMS · HITL על פעולות רגישות · בלי SOC2 עדיין · בלי שמירת
          PAN · HotelOS אינה ספק סליקה
        </p>

        <RevealSection
          id="outcomes"
          className="section outcomes"
          aria-labelledby="outcomes-title"
          tabIndex={-1}
        >
          <p className="eyebrow">קונים תוצאות — לא תוכנה</p>
          <h2 id="outcomes-title">הכאב. העלות. מה HotelOS עושה.</h2>
          <p className="section__lead">
            לא עוד מסך הזמנות — אלא אוטומציה, סוכנים שצופים קדימה, כספים
            בהשגחה, ושיח בין מחלקות בלי מחסום שפה.
          </p>
          <div className="outcome-table" role="table" aria-label="כאב עלות תוצאה">
            <div className="outcome-table__head" role="row">
              <span role="columnheader">כאב של המלון</span>
              <span role="columnheader">העלות למלון</span>
              <span role="columnheader">מה HotelOS AI עושה</span>
            </div>
            {OUTCOMES.map((row) => (
              <a
                key={row.id}
                className="outcome-row"
                href={row.href}
                role="row"
                aria-label={`${row.pain} — ${row.outcome}`}
              >
                <span role="cell">{row.pain}</span>
                <span role="cell">{row.cost}</span>
                <span role="cell" className="outcome-row__result">
                  {row.outcome}
                </span>
              </a>
            ))}
          </div>
        </RevealSection>

        <RevealSection
          id="wedge"
          className="section wedge"
          aria-labelledby="wedge-title"
        >
          <p className="eyebrow">למה זה שונה</p>
          <h2 id="wedge-title">שבע מערכות. מידע אחד חסר.</h2>
          <p className="section__lead">
            מלונות רצים על PMS, HR, הנה״ח, CRM, תחזוקה, BI ואפליקציית עובדים —
            בנפרד. העבודה כפולה; ההחלטות מאוחרות. HotelOS היא שכבת האינטליגנציה
            שמאחדת — בלי להחליף את התשתית.
          </p>
          <ul className="wedge-stack" aria-label="מערכות מפוצלות היום">
            {FRAGMENTED_STACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="wedge-punch">
            AI שרק עונה בצ׳אט — לא מספיק. אנחנו מפעילים תהליכים, עם אישור אנושי
            על מה שקריטי.
          </p>
        </RevealSection>

        <RevealSection
          id="compare"
          className="section compare"
          aria-labelledby="compare-title"
        >
          <p className="eyebrow">מול העולם</p>
          <h2 id="compare-title">
            Intelligence Layer — לא החלפת מערכות ולא צ׳אט בלבד
          </h2>
          <p className="section__lead">
            השוק מציע בדרך כלל אחת משלוש: suite מלאה, כלי AI נקודתי, או דשבורד
            שמספר אתמול. HotelOS מתחילה מ-wedge מעל ה-PMS — סוכנים, תמונה חיה
            ופעולה עם אישור אנושי.
          </p>
          <div
            className="compare-table"
            role="table"
            aria-label="השוואת קטגוריות מול Intelligence Layer"
          >
            <div className="compare-table__head" role="row">
              <span role="columnheader">קטגוריה בשוק</span>
              <span role="columnheader">כאב טיפוסי</span>
              <span role="columnheader">תשובת HotelOS</span>
            </div>
            {WORLD_COMPARISON.map((row) => (
              <div
                key={row.id}
                className={
                  row.isHotelos
                    ? "compare-row compare-row--hotelos"
                    : "compare-row"
                }
                role="row"
              >
                <span role="cell" className="compare-row__category">
                  {row.category}
                </span>
                <span role="cell">{row.typicalPain}</span>
                <span role="cell" className="compare-row__answer">
                  {row.hotelosAnswer}
                </span>
              </div>
            ))}
          </div>
        </RevealSection>

        <RevealSection
          id="intelligence"
          className="section intelligence"
          aria-labelledby="intelligence-title"
        >
          <p className="eyebrow">אוטומציה · סוכנים · עתיד</p>
          <h2 id="intelligence-title">
            רוחב היכולות — אחרי שמוכיחים ערך בפיילוט
          </h2>
          <p className="section__lead">
            אחרי שה־wedge מוכיח ערך — תדריך, תקלות ותחזוקה חזויה — מרחיבים
            land &amp; expand לכספים, אורח, צ׳אט מתורגם והזמנות. אותה שכבה מעל
            ה־PMS; בלי פרויקט החלפת מערכת.
          </p>
          <ul className="cap-grid">
            {CAPABILITIES.map((cap) => (
              <li key={cap.id} className="cap">
                <h3 className="cap__title">{cap.title}</h3>
                <p className="cap__body">{cap.body}</p>
                <p className="cap__proof">{cap.proof}</p>
              </li>
            ))}
          </ul>
        </RevealSection>

        <RevealSection
          id="chat"
          className="section chat"
          aria-labelledby="chat-title"
        >
          <p className="eyebrow">צ׳אט + אוטומציה</p>
          <h2 id="chat-title">הנהלה מדברת. העובד מקבל משימה.</h2>
          <p className="section__lead">
            הדגמה של צ׳אט מתורגם (משטח Executive). ב־Work — תור משימות, נוכחות
            ו־Copilot לפי תפקיד, לא צ׳אט דו־כיווני מתורגם מלא ב־MVP.
          </p>
          <div className="chat-demo" aria-label="הדגמת צ׳אט מתורגם (Executive)">
            <div className="chat-demo__pane">
              <p className="chat-demo__meta">
                <span>{CHAT_DEMO.senderLabel}</span>
                <span>{CHAT_DEMO.senderLang}</span>
              </p>
              <p className="chat-demo__bubble chat-demo__bubble--out">
                {CHAT_DEMO.outgoing}
              </p>
            </div>
            <div className="chat-demo__bridge" aria-hidden="true">
              <span>תרגום · הדגמה</span>
              <span>+ אוטומציה</span>
            </div>
            <div className="chat-demo__pane">
              <p className="chat-demo__meta">
                <span>{CHAT_DEMO.receiverLabel}</span>
                <span>{CHAT_DEMO.receiverLang}</span>
              </p>
              <p className="chat-demo__bubble chat-demo__bubble--in">
                {CHAT_DEMO.incoming}
              </p>
            </div>
            <p className="chat-demo__auto">{CHAT_DEMO.automation}</p>
          </div>
        </RevealSection>

        <RevealSection id="os" className="section os" aria-labelledby="os-title">
          <p className="eyebrow">השקף החזק</p>
          <h2 id="os-title">HotelOS AI = Operating System for Hotels</h2>
          <p className="section__lead">
            שכבה אחת בין ההנהלה למחלקות — ולכל אורח. לא מחליפה את ה־PMS; מחברת
            את הארגון סביבו עם סוכנים ואוטומציות.
          </p>
          <div className="os-map" aria-hidden="false">
            <div className="os-map__exec">
              <span className="os-node os-node--ceo">{ORG_NODES.executives[0]}</span>
              <div className="os-map__cfo-coo">
                <span className="os-node">{ORG_NODES.executives[1]}</span>
                <span className="os-node">{ORG_NODES.executives[2]}</span>
              </div>
            </div>
            <div className="os-map__spine" aria-hidden="true" />
            <p className="os-map__core">
              <span>HotelOS AI</span>
              <small>Agents · Automations · Foresight</small>
            </p>
            <div className="os-map__spine" aria-hidden="true" />
            <ul className="os-map__depts">
              {ORG_NODES.departments.map((dept) => (
                <li key={dept} className="os-node os-node--dept">
                  {dept}
                </li>
              ))}
            </ul>
            <div className="os-map__spine" aria-hidden="true" />
            <p className="os-node os-node--guest">Guest</p>
          </div>
        </RevealSection>

        <RevealSection
          id="taglines"
          className="section taglines"
          aria-labelledby="taglines-title"
        >
          <h2 id="taglines-title" className="visually-hidden">
            מסרים שיווקיים
          </h2>
          <p className="taglines__live" aria-live="polite">
            {TAGLINES[activeTag]}
          </p>
          <ul className="taglines__list">
            {TAGLINES.map((line, index) => (
              <li key={line}>
                <button
                  type="button"
                  className={
                    index === activeTag
                      ? "taglines__dot is-on"
                      : "taglines__dot"
                  }
                  aria-label={`מסר ${index + 1}`}
                  aria-pressed={index === activeTag}
                  onClick={() => setActiveTag(index)}
                />
              </li>
            ))}
          </ul>
          <p className="taglines__note">
            מסרים שמפחיתים התנגדות — רוב המלונות לא רוצים להחליף את המערכת
            המרכזית שלהם. הם רוצים שהיא תעבוד חכם יותר.
          </p>
        </RevealSection>

        <RevealSection
          id="digitization"
          className="section digitization"
          aria-labelledby="digitization-title"
        >
          <p className="eyebrow">רמת הדיגיטליזציה</p>
          <h2 id="digitization-title">
            יש לכם PMS. חסרה שכבת האינטליגנציה.
          </h2>
          <p className="section__lead">
            רוב הרשתות תקועות בין Excel/וואטסאפ לבין מערכת הזמנות — בלי סוכנים,
            בלי תחזיות, בלי צ׳אט מתורגם שיוצר משימות לבד.
          </p>
          <ol className="digi-bars">
            {DIGITIZATION.map((item) => (
              <li key={item.label}>
                <div className="digi-bars__meta">
                  <span>{item.label}</span>
                  <span>{item.level}%</span>
                </div>
                <div
                  className="digi-bars__track"
                  role="img"
                  aria-label={`${item.label}: ${item.level} אחוז`}
                >
                  <div
                    className="digi-bars__fill"
                    style={
                      { "--level": `${item.level}%` } as CSSProperties
                    }
                  />
                </div>
              </li>
            ))}
          </ol>
        </RevealSection>

        <RevealSection
          id="ceo-value"
          className="section ceo"
          aria-labelledby="ceo-title"
        >
          <p className="eyebrow">ערך למנכ״ל</p>
          <h2 id="ceo-title">לפני · אחרי HotelOS</h2>
          <p className="section__lead ceo__disclaimer">
            ההמחשה למצגת בלבד — אינה מבוססת מחקר. מספרים אמיתיים יימדדו בפיילוט
            בלבד (
            <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
              Pilot ROI Scorecard
            </a>
            ).
          </p>
          <div className="ceo-grid">
            <div>
              <h3>לפני HotelOS</h3>
              <ul className="ceo-bars">
                {CEO_BARS.before.map((bar) => (
                  <li key={`b-${bar.label}`}>
                    <span>{bar.label}</span>
                    <div
                      className="ceo-bars__track"
                      role="img"
                      aria-label={`${bar.label} לפני: איור`}
                    >
                      <div
                        className="ceo-bars__fill ceo-bars__fill--before"
                        style={
                          { "--level": `${bar.value}%` } as CSSProperties
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>אחרי HotelOS</h3>
              <ul className="ceo-bars">
                {CEO_BARS.after.map((bar) => (
                  <li key={`a-${bar.label}`}>
                    <span>{bar.label}</span>
                    <div
                      className="ceo-bars__track"
                      role="img"
                      aria-label={`${bar.label} אחרי: איור`}
                    >
                      <div
                        className="ceo-bars__fill ceo-bars__fill--after"
                        style={
                          { "--level": `${bar.value}%` } as CSSProperties
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </RevealSection>

        <RevealSection
          id="demo"
          className="section demo"
          aria-labelledby="demo-title"
        >
          <p className="eyebrow">דמו מוצר</p>
          <h2 id="demo-title">סיור wedge ב־3 פעימות</h2>
          <p className="section__lead">
            זה מה שמראים בשיחה של רבע שעה. כשיהיה וידאו מוקלט — הוא יופיע כאן
            אוטומטית.
          </p>
          {DEMO_VIDEO_URL ? (
            <div className="demo-video">
              <iframe
                title="HotelOS AI product demo"
                src={DEMO_VIDEO_URL}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          <ol className="demo-beats">
            {DEMO_BEATS.map((beat, index) => (
              <li key={beat.id} className="demo-beat">
                <span className="demo-beat__n">{index + 1}</span>
                <div>
                  <h3>{beat.title}</h3>
                  <p>{beat.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </RevealSection>

        {PARTNER_NAMES.length > 0 ? (
          <RevealSection
            id="partners"
            className="section partners"
            aria-labelledby="partners-title"
          >
            <p className="eyebrow">Design partners</p>
            <h2 id="partners-title">רשתות בפיילוט / שותפות</h2>
            <p className="section__lead">
              שמות מוצגים רק בהסכמה כתובה — דרך{" "}
              <code>VITE_PARTNER_NAMES</code>.
            </p>
            <ul className="partner-list">
              {PARTNER_NAMES.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </RevealSection>
        ) : null}

        <RevealSection
          id="how-pilot"
          className="section how-pilot"
          aria-labelledby="how-pilot-title"
        >
          <p className="eyebrow">איך נראה הפיילוט</p>
          <h2 id="how-pilot-title">ארבעה שבועות. תוצאות מדידות.</h2>
          <p className="section__lead">
            בלי להחליף את ה־PMS. מתחילים מדומיין אחד־שניים ומודדים מול baseline —
            לא מול שקף מצגת.
          </p>
          <ol className="pilot-steps">
            {PILOT_STEPS.map((step) => (
              <li key={step.id} className="pilot-step">
                <p className="pilot-step__week">{step.week}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="section__note">
            תבנית המדידה:{" "}
            <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
              Pilot ROI Scorecard
            </a>
            {" · "}
            <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/one-pager-hotel.md">
              One-pager לרשת
            </a>
            .
          </p>
        </RevealSection>

        <RevealSection
          id="packages"
          className="section packages"
          aria-labelledby="packages-title"
        >
          <p className="eyebrow">איך קונים</p>
          <h2 id="packages-title">Pilot · Network · Enterprise</h2>
          <p className="section__lead">
            מחירון רשימה אחיד ב־USD לכל העולם (כולל ישראל). סגירה בשיחה —
            בלי ROI מומצא ובלי תעודות שלא קיימות.
          </p>
          <ul className="package-grid">
            {PACKAGES.map((tier) => (
              <li key={tier.id} className="package-tier">
                <h3>{tier.name}</h3>
                <p className="package-tier__audience">{tier.audience}</p>
                <ul>
                  {tier.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </RevealSection>

        <RevealSection
          id="measure"
          className="section measure-section"
          aria-labelledby="measure-title"
        >
          <p className="eyebrow">מדידה</p>
          <h2 id="measure-title">מתכננים את הפיילוט — לא ממציאים תוצאות</h2>
          <p className="section__lead">
            כוונו את נקודת הפתיחה לתדריך. יעד השיפור נקבע רק אחרי baseline בפיילוט
            — לא כאחוז קבוע באתר.
          </p>
          <MeasurePlanner />
        </RevealSection>

        <RevealSection
          id="integrations"
          className="section integrations"
          aria-labelledby="integrations-title"
        >
          <p className="eyebrow">אינטגרציות</p>
          <h2 id="integrations-title">מעל המערכות שכבר רצות אצלכם</h2>
          <p className="section__lead">
            PMS נשאר מקור האמת להזמנות. HotelOS מוסיף אותות, המלצות ואישורים —
            לא מחליף את מערכת החדרים.
          </p>
          <ul className="integrate-grid">
            {INTEGRATIONS.map((item) => (
              <li key={item.id} className="integrate-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </RevealSection>

        <RevealSection
          id="trust"
          className="section trust"
          aria-labelledby="trust-title"
        >
          <p className="eyebrow">אבטחה ואמון</p>
          <h2 id="trust-title">בקרות אמיתיות — לא תעודות שיווק</h2>
          <p className="section__lead">
            אין לנו הצהרת SOC2 או ISO — ולא נטען שיש. אלה הבקרות שקיימות
            בפועל במערכת היום.
          </p>
          <ul className="trust-grid">
            {TRUST_CONTROLS.map((control) => (
              <li key={control.id} className="trust-control">
                <h3>{control.title}</h3>
                <p>{control.body}</p>
              </li>
            ))}
          </ul>
          <p className="trust-note">
            הפירוט המלא, כולל מדיניות אימות ונתונים רגישים, במסמך{" "}
            <a href={APP_URLS.legal("security")}>מדיניות האבטחה</a>
            {" · "}
            <a href={APP_URLS.legal("subprocessors")}>ספקי עיבוד</a>
            {" · "}
            <a href={APP_URLS.legal("dpa")}>תבנית DPA</a>
            {" · "}
            <a href={APP_URLS.legal("accessibility")}>הצהרת נגישות</a>
            {" · "}
            <a href="/.well-known/security.txt">security.txt</a>
            {" · "}
            <a href="#status">סטטוס API</a>.
          </p>
        </RevealSection>

        <RevealSection
          id="status"
          className="section status"
          aria-labelledby="status-title"
        >
          <StatusSectionContent />
        </RevealSection>

        <RevealSection
          id="faq"
          className="section faq"
          aria-labelledby="faq-title"
        >
          <p className="eyebrow">שאלות נפוצות</p>
          <h2 id="faq-title">מה שרשתות שואלות לפני פיילוט</h2>
          <div className="faq__list">
            <details className="faq__item" open>
              <summary>האם HotelOS מחליף את ה־PMS?</summary>
              <p>
                לא. אנחנו שכבת אינטליגנציה מעל Opera / Protel / Fidelio / Clock
                ועוד —{" "}
                <a href="#taglines">
                  We don&apos;t replace your PMS. We make it smarter.
                </a>
              </p>
            </details>
            <details className="faq__item">
              <summary>מה הסוכנים באמת עושים?</summary>
              <p>
                תדריכים, תחזיות, אנומליות, upsell, תחזוקה חזויה, מזכירת ישיבות,
                והמלצות כספים — דרך AI Gateway, עם אישור אנושי לפעולות רגישות.{" "}
                <a href="#intelligence">למפת היכולות</a>.
              </p>
            </details>
            <details className="faq__item">
              <summary>איך עובד הצ׳אט בין שפות?</summary>
              <p>
                כותבים בשפה שלכם; הצד השני מקבל בשפתו. על אותה שיחה אפשר להריץ
                אוטומציות (משימה, תזכורת, העברה) —{" "}
                <a href="#chat">ראו הדגמה</a>.
              </p>
            </details>
            <details className="faq__item">
              <summary>מה מקבלים בפיילוט?</summary>
              <p>
                דומיין אחד־שניים עם מדידת תוצאות: תדריכים, תקלות, ניקיון חדרים,
                upsell — לפי{" "}
                <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
                  Pilot ROI Scorecard
                </a>
                .
              </p>
            </details>
          </div>
        </RevealSection>

        <RevealSection
          id="excellence"
          className="section excellence"
          aria-labelledby="excellence-title"
        >
          <p className="eyebrow">מצוינות לסגירה</p>
          <h2 id="excellence-title">Data room מוכן — בלי שיווק מזויף</h2>
          <p className="section__lead">
            כל מה שצריך לסגור רשת או משקיע: playbook, שאלון אבטחה, נתיב SOC2,
            unit economics. מה שדורש חתימה חיצונית מופיע כצ׳קליסט — לא כתעודה.
          </p>
          <ul className="excellence-links">
            {EXCELLENCE_LINKS.map((link) => (
              <li key={link.id}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </RevealSection>

        <RevealSection
          id="contact"
          className="section contact"
          aria-labelledby="contact-title"
        >
          <h2 id="contact-title">פיילוט לרשת. תוצאות מדידות.</h2>
          <p className="section__lead">
            מלאו פרטים — נפתח מייל מוכן ל־pilot@hotelos.ai. אפשר גם לקבוע שיחה
            אם הוגדר יומן.
          </p>
          <ContactLeadForm />
          <div className="contact__actions contact__actions--secondary">
            <a
              className="btn btn--ghost"
              href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/one-pager-hotel.md"
            >
              One-pager לרשת
            </a>
            <a
              className="btn btn--ghost"
              href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pitch-deck-12-slides.md"
            >
              Deck למשקיע (12 שקפים)
            </a>
          </div>
        </RevealSection>
      </main>

      <div className="foot">
        <div className="foot__brand">
          <p>
            <strong>HotelOS AI</strong>
          </p>
          <p className="foot__tag">Intelligence Layer for Hotels</p>
        </div>
        <div className="foot__grid" aria-label="ניווט תחתון">
          <div className="foot__col">
            <h3>מוצר</h3>
            <a href="#outcomes">תוצאות</a>
            <a href="#demo">דמו</a>
            <a href="#how-pilot">פיילוט</a>
            <a href="#packages">חבילות</a>
            <a href="#measure">מדידה</a>
            <a href="#excellence">מצוינות / data room</a>
            <a href="/sales-pack/index.html">Sales pack · PDF</a>
          </div>
          <div className="foot__col">
            <h3>אמון</h3>
            <a href="#trust">בקרות אבטחה</a>
            <a href="#status">סטטוס API</a>
            <a href={APP_URLS.legal("security")}>מדיניות אבטחה</a>
            <a href={APP_URLS.legal("subprocessors")}>ספקי עיבוד</a>
            <a href={APP_URLS.legal("dpa")}>תבנית DPA</a>
            <a href={APP_URLS.legal("accessibility")}>הצהרת נגישות</a>
            <a href={APP_URLS.legal("privacy")}>פרטיות</a>
            <a href={APP_URLS.legal("cookies")}>עוגיות</a>
            <a href="/.well-known/security.txt">security.txt</a>
          </div>
          <div className="foot__col">
            <h3>התחלה</h3>
            <a href={PILOT_MAIL}>פיילוט</a>
            <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
            <a href={APP_URLS.legal("meetings")}>מדיניות פגישות</a>
            <a href="#faq">שאלות נפוצות</a>
          </div>
        </div>
        <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />
      </div>

      <CookieBanner
        legalCookiesUrl={APP_URLS.legal("cookies")}
        onConsent={(consent) => {
          void saveCookieConsent({
            subjectKey: getConsentSubjectKey("www"),
            necessary: consent.necessary,
            functional: consent.functional,
          });
        }}
      />
    </div>
  );
}
