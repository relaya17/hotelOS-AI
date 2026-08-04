export function HeroSection() {
  return (
    <>
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
            שכבת הבינה למלונות
          </h1>
          <p className="hero__lead">
            מערכת הפעלה לרשת מעל ה־PMS: תמונה חיה, סוכנים עם אישור אדם,
            והוכחת ערך בפיילוט — בלי להחליף את מערכת ההזמנות.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#contact">
              שיחת פיילוט לרשת
            </a>
            <a className="btn btn--ghost" href="#platform">
              למה זה קטגוריה אחרת
            </a>
          </div>
        </div>
      </section>

      <p className="truth-strip" role="note">
        לא מחליפים PMS · HITL על פעולות רגישות · בלי SOC2 עדיין · בלי שמירת
        PAN · HotelOS אינה ספק סליקה
      </p>
    </>
  );
}
