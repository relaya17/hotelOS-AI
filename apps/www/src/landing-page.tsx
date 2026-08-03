import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CEO_BARS,
  DIGITIZATION,
  ORG_NODES,
  OUTCOMES,
  TAGLINES,
} from "./content.js";

const PILOT_MAIL =
  "mailto:pilot@hotelos.ai?subject=HotelOS%20AI%20Pilot&body=שלום%2C%20אשמח%20לדבר%20על%20פיילוט%20HotelOS%20AI%20לרשת%20שלנו.";

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

  return (
    <div className="site">
      <a className="skip" href="#outcomes">
        דלג לתוכן
      </a>

      <header className={navSolid ? "top is-solid" : "top"}>
        <a className="top__brand" href="#top" aria-label="HotelOS AI — ראש העמוד">
          HotelOS AI
        </a>
        <nav className="top__nav" aria-label="ניווט ראשי">
          <a href="#outcomes">תוצאות</a>
          <a href="#os">מערכת הפעלה</a>
          <a href="#digitization">דיגיטליזציה</a>
          <a href="#ceo-value">ערך למנכ״ל</a>
          <a href="#contact" className="top__cta">
            פיילוט
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-brand">
          <div className="hero__media" aria-hidden="true" />
          <div className="hero__veil" aria-hidden="true" />
          <div className="hero__copy">
            <p id="hero-brand" className="hero__brand">
              HotelOS AI
            </p>
            <h1 className="hero__title">
              The Intelligence Layer for Hotels
            </h1>
            <p className="hero__lead">
              We connect people, operations, finance, AI, compliance and guest
              experience into one unified operating system.
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#contact">
                בקשת פיילוט לרשת
              </a>
              <a className="btn btn--ghost" href="#outcomes">
                ראו את התוצאות
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
            מנהלי מלונות לא מחפשים עוד מסך — הם מחפשים פחות זמן על דוחות, חדרים
            מוכנים, ותקלות שמטופלות לפני שהאורח מתלונן.
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

        <RevealSection id="os" className="section os" aria-labelledby="os-title">
          <p className="eyebrow">השקף החזק</p>
          <h2 id="os-title">HotelOS AI = Operating System for Hotels</h2>
          <p className="section__lead">
            שכבה אחת בין ההנהלה למחלקות — ולכל אורח. לא מחליפה את ה־PMS; מחברת
            את הארגון סביבו.
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
              <small>Intelligence Layer</small>
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
            המרכזית שלהם.
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
            רוב הרשתות תקועות בין Excel/וואטסאפ לבין מערכת הזמנות — בלי שכבה
            שמחברת הכול להחלטות בזמן אמת.
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
          id="contact"
          className="section contact"
          aria-labelledby="contact-title"
        >
          <h2 id="contact-title">פיילוט לרשת. תוצאות מדידות.</h2>
          <p className="section__lead">
            מתחילים מדומיין אחד־שניים מעל ה־PMS הקיים שלכם — Opera, Protel,
            Fidelio, Clock או אחר — ומודדים תדריכים, תקלות, ניקיון ו־upsell.
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
          <a href="#outcomes">תוצאות</a>
          <a href="#os">OS</a>
          <a href="#taglines">מסרים</a>
          <a href={PILOT_MAIL}>צור קשר</a>
        </p>
      </footer>
    </div>
  );
}
