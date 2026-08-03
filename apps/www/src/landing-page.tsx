import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CAPABILITIES,
  CEO_BARS,
  CHAT_DEMO,
  DIGITIZATION,
  FRAGMENTED_STACK,
  ORG_NODES,
  OUTCOMES,
  TAGLINES,
  WORLD_COMPARISON,
} from "./content.js";

const PILOT_MAIL =
  "mailto:pilot@hotelos.ai?subject=HotelOS%20AI%20Pilot&body=שלום%2C%20אשמח%20לדבר%20על%20פיילוט%20HotelOS%20AI%20לרשת%20שלנו.";

const NAV_LINKS = [
  { href: "#outcomes", label: "תוצאות" },
  { href: "#wedge", label: "הבידול" },
  { href: "#compare", label: "השוואה" },
  { href: "#intelligence", label: "סוכנים" },
  { href: "#chat", label: "צ׳אט" },
  { href: "#os", label: "מערכת הפעלה" },
  { href: "#ceo-value", label: "ערך למנכ״ל" },
  { href: "#faq", label: "שאלות" },
] as const;

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
}: {
  readonly id: string;
  readonly className: string;
  readonly children: ReactNode;
  readonly "aria-labelledby": string;
}) {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      id={id}
      className={`reveal ${className}`}
      aria-labelledby={labelledBy}
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
              מתחילים מ־wedge ברור מעל ה־PMS: תדריך מנכ״ל יומי, מרכז תקלות עם
              התראות, ותחזוקה חזויה — תמונה אחת של מה קורה עכשיו ומה צפוי מחר.
              בלי להחליף Opera / Protel; עם Suggest → Approve → Act על מה
              שקריטי.
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#contact">
                בקשת פיילוט לרשת
              </a>
              <a className="btn btn--ghost" href="#intelligence">
                מה הסוכנים עושים
              </a>
            </div>
          </div>
        </section>

        <RevealSection
          id="outcomes"
          className="section outcomes"
          aria-labelledby="outcomes-title"
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
          <h2 id="chat-title">כותבים בשפתכם. הם קוראים בשלהם.</h2>
          <p className="section__lead">
            אותו הודעה — שתי שפות. ובאותה שיחה: משימה, תזכורת והעברה — בלי
            להעתיק לוואטסאפ.
          </p>
          <div className="chat-demo" aria-label="הדגמת צ׳אט מתורגם">
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
              <span>תרגום חי</span>
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
          id="contact"
          className="section contact"
          aria-labelledby="contact-title"
        >
          <h2 id="contact-title">פיילוט לרשת. תוצאות מדידות.</h2>
          <p className="section__lead">
            מתחילים מדומיין אחד־שניים מעל ה־PMS הקיים — עם סוכנים, צ׳אט מתורגם
            ואוטומציות — ומודדים תדריכים, תקלות, ניקיון ו־upsell.
          </p>
          <div className="contact__actions">
            <a className="btn btn--primary" href={PILOT_MAIL}>
              דברו איתנו על פיילוט
            </a>
            <a
              className="btn btn--ghost"
              href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/gtm-outcomes-pitch.md"
            >
              קראו את הנרטיב המלא
            </a>
          </div>
        </RevealSection>
      </main>

      <footer className="foot">
        <p>
          <strong>HotelOS AI</strong> — Intelligence Layer for Hotels
        </p>
        <p className="foot__links">
          <a href="#intelligence">סוכנים</a>
          <a href="#chat">צ׳אט</a>
          <a href="#outcomes">תוצאות</a>
          <a href={PILOT_MAIL}>צור קשר</a>
        </p>
      </footer>
    </div>
  );
}
