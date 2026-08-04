import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  APP_URLS,
  fetchPaymentPublicStatus,
  type PaymentPublicStatusDto,
} from "@hotelos/web-client";

export type LandingPageProps = {
  readonly onVoiceBook: () => void;
  readonly onFormBook: () => void;
  readonly onFindStay: () => void;
};

/**
 * Public marketing surface (book.*) — hero first, then one-job sections.
 * Two equal booking paths: conversational agent and classic form.
 */
export function LandingPage({
  onVoiceBook,
  onFormBook,
  onFindStay,
}: LandingPageProps) {
  const [paymentStatus, setPaymentStatus] = useState<
    PaymentPublicStatusDto | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPaymentPublicStatus()
      .then((status) => {
        if (!cancelled) setPaymentStatus(status);
      })
      .catch(() => {
        if (!cancelled) setPaymentStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing">
      <header className="landing-top">
        <p className="landing-top__brand">HotelOS</p>
        <button type="button" className="landing-top__link" onClick={onFindStay}>
          כניסה לשהייה
        </button>
      </header>

      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero__media" aria-hidden="true">
          <img
            className="landing-hero__img"
            src="/hero-room.png"
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
          />
          <div className="landing-hero__veil" />
        </div>

        <div className="landing-hero__copy">
          <p className="landing-hero__brand">HotelOS</p>
          <h1 id="landing-hero-title">לינה חכמה. חדר מוכן. בלי לחכות.</h1>
          <p className="landing-hero__lede">
            הזמינו עם סוכן קולי — או בטופס הרגיל. אחר כך נכנסים לאזור האישי.
          </p>
          <div className="landing-hero__cta">
            <Button type="button" onClick={onVoiceBook}>
              הזמנה בקול / שיחה
            </Button>
            <Button type="button" variant="ghost" onClick={onFormBook}>
              הזמנה בטופס
            </Button>
          </div>
        </div>
      </section>

      <section
        id="book-intent"
        className="landing-section"
        aria-labelledby="book-intent-title"
      >
        <h2 id="book-intent-title">שתי דרכים להזמין</h2>
        <p className="landing-section__lede">
          בחרו מה נוח לכם — שתי האפשרויות מגיעות לאותו אישור (
          {paymentStatus?.labelHe ?? "טוען מצב תשלום…"}) ואז לאזור האישי.
        </p>
        <div className="landing-section__actions">
          <Button type="button" onClick={onVoiceBook}>
            סוכן קול / שיחה
          </Button>
          <Button type="button" variant="ghost" onClick={onFormBook}>
            טופס תאריכים וחדר
          </Button>
          <Button type="button" variant="ghost" onClick={onFindStay}>
            כבר יש לי הזמנה
          </Button>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="stay-promise-title">
        <h2 id="stay-promise-title">אחרי ההזמנה</h2>
        <p className="landing-section__lede">
          באזור האישי רואים מתי החדר מוכן, שולחים בקשת שירות, ועוקבים אחרי
          החשבון — בלי תור בקבלה.
        </p>
        <ul className="landing-promise">
          <li>
            <h3>חדר מוכן בזמן</h3>
            <p>מעקב ניקיון והזמנה לחדר בלחיצה.</p>
          </li>
          <li>
            <h3>בקשות במקום</h3>
            <p>מגבות, כריות או שאלה — ישר לצוות.</p>
          </li>
          <li>
            <h3>חשבון שקוף</h3>
            <p>אומדן לינה ושירותים לפני הצ׳ק־אאוט.</p>
          </li>
        </ul>
      </section>

      <footer className="landing-footer">
        <p>
          <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
          {" · "}
          <a href={APP_URLS.legal("cookies")}>עוגיות</a>
          {" · "}
          <a href={APP_URLS.legal("security")}>אבטחה</a>
          {" · "}
          <a href={APP_URLS.legal("privacy")}>פרטיות</a>
        </p>
        <p className="landing-footer__staff">
          <a href={APP_URLS.work}>work</a>
          {" · "}
          <a href={APP_URLS.ops}>ops</a>
          {" · "}
          <a href={APP_URLS.hq}>hq</a>
        </p>
      </footer>

      <style>{`
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-ink);
          color: #f2f6f4;
        }

        .landing-top {
          position: absolute;
          z-index: 3;
          inset-inline: 0;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(1rem, 3vw, 1.6rem) clamp(1.1rem, 4vw, 2.5rem);
          animation: hotelos-enter var(--motion-med) var(--ease-out) both;
        }

        .landing-top__brand {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.15rem;
          letter-spacing: 0.02em;
          color: #f2f6f4;
        }

        .landing-top__link {
          border: 0;
          background: transparent;
          color: #f2f6f4;
          font: inherit;
          font-weight: 600;
          font-size: var(--text-small);
          cursor: pointer;
          padding: 0.4rem 0;
          text-underline-offset: 0.2em;
        }
        .landing-top__link:hover { color: #fff; text-decoration: underline; }
        .landing-top__link:focus-visible {
          outline: 3px solid #fff;
          outline-offset: 3px;
        }

        .landing-hero {
          position: relative;
          min-height: 100svh;
          display: grid;
          align-items: end;
          overflow: clip;
        }

        .landing-hero__media {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .landing-hero__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          transform: scale(1.04);
          animation: landing-kenburns 18s var(--ease-out) both;
        }

        .landing-hero__veil {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              to top,
              rgb(8 20 17 / 88%) 0%,
              rgb(8 20 17 / 42%) 42%,
              rgb(8 20 17 / 28%) 100%
            );
          animation: landing-veil var(--motion-med) var(--ease-out) both;
        }

        .landing-hero__copy {
          position: relative;
          z-index: 1;
          width: min(40rem, 100%);
          padding:
            clamp(5.5rem, 12vw, 7rem)
            clamp(1.1rem, 4vw, 2.5rem)
            clamp(2.4rem, 6vw, 4rem);
          display: grid;
          gap: var(--space-4);
          animation: landing-rise 700ms var(--ease-out) both;
        }

        .landing-hero__brand {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.6rem, 8vw, 4.4rem);
          line-height: 0.95;
          letter-spacing: var(--tracking-display);
          color: #f7faf8;
        }

        .landing-hero h1 {
          font-size: clamp(1.45rem, 3.6vw, 2.05rem);
          font-weight: 500;
          color: #f7faf8;
          max-width: 22ch;
        }

        .landing-hero__lede {
          max-width: 34ch;
          color: #edf3f0;
          font-size: 1.08rem;
          font-weight: 500;
          line-height: 1.65;
        }

        .landing-hero__cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: var(--space-2);
        }

        .landing-hero__cta .hotelos-button--primary {
          background: #f2f6f4;
          color: var(--color-sea-deep);
          border-color: #f2f6f4;
        }
        .landing-hero__cta .hotelos-button--primary:hover:not(:disabled) {
          background: #fff;
          border-color: #fff;
        }
        .landing-hero__cta .hotelos-button--ghost {
          background: transparent;
          color: #f2f6f4;
          border-color: rgb(242 246 244 / 70%);
        }
        .landing-hero__cta .hotelos-button--ghost:hover:not(:disabled) {
          background: rgb(242 246 244 / 10%);
          border-color: rgb(242 246 244 / 70%);
        }

        .landing-section {
          background: var(--color-paper);
          color: var(--color-ink);
          padding: clamp(3rem, 8vw, 5.5rem) clamp(1.1rem, 4vw, 2.5rem);
          display: grid;
          gap: var(--space-4);
          max-width: 52rem;
          margin-inline: auto;
          width: 100%;
        }

        .landing-section + .landing-section {
          padding-top: 0;
        }

        .landing-section h2 {
          font-size: clamp(1.6rem, 3vw, 2.1rem);
          color: var(--color-sea-deep);
        }

        .landing-section__lede {
          max-width: 40ch;
          color: #3a4e48;
          font-size: 1.05rem;
          font-weight: 500;
          line-height: 1.7;
        }

        .landing-section__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: var(--space-2);
        }

        .landing-promise {
          list-style: none;
          margin: var(--space-3) 0 0;
          padding: 0;
          display: grid;
          gap: clamp(1.4rem, 3vw, 2rem);
        }

        .landing-promise li {
          display: grid;
          gap: 0.35rem;
          padding-block: var(--space-3);
          border-top: 1px solid var(--color-line);
        }

        .landing-promise h3 {
          font-size: 1.15rem;
          color: var(--color-sea-deep);
        }

        .landing-promise p {
          color: #3a4e48;
          font-weight: 500;
          line-height: 1.6;
          max-width: 36ch;
        }

        .landing-footer {
          background: var(--color-paper);
          padding: var(--space-6) clamp(1.1rem, 4vw, 2.5rem) clamp(5rem, 12vw, 7rem);
          display: grid;
          gap: var(--space-2);
          font-size: var(--text-small);
          color: #3a4e48;
          border-top: 1px solid var(--color-line);
        }

        .landing-footer a {
          color: var(--color-sea-deep);
          font-weight: 600;
          text-decoration: none;
        }
        .landing-footer a:hover { text-decoration: underline; }
        .landing-footer__staff { color: var(--color-sea-deep); }

        @keyframes landing-kenburns {
          from { transform: scale(1.08); }
          to { transform: scale(1.02); }
        }

        @keyframes landing-veil {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }

        @keyframes landing-rise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-hero__img,
          .landing-hero__veil,
          .landing-hero__copy,
          .landing-top {
            animation: none !important;
          }
          .landing-hero__img { transform: none; }
        }

        @media (max-width: 720px) {
          .landing-hero__brand { font-size: clamp(2.3rem, 12vw, 3.2rem); }
          .landing-hero h1 { max-width: none; }
          .landing-hero__lede { max-width: none; }
        }
      `}</style>
    </div>
  );
}
