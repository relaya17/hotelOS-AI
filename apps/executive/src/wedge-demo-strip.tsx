const STEPS = [
  { n: 1, label: "תדריך", href: "#ops-briefing", targetId: "briefing" },
  { n: 2, label: "תקלות", href: "#incidents" },
  { n: 3, label: "תחזוקה חזויה", href: "#ops-pm", targetId: "pm-panel" },
  { n: 4, label: "אישורי AI", href: "#approvals" },
] as const;

function scrollToTarget(id: string): void {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function WedgeDemoStrip() {
  return (
    <nav
      className="wedge-strip"
      aria-label="מסלול דמו Wedge — תדריך, תקלות, תחזוקה, אישורים"
    >
      <p className="wedge-strip__tagline">Wedge הפיילוט — לא מחליפים PMS</p>
      <ol className="wedge-strip__steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <a
              className="wedge-strip__step"
              href={step.href}
              onClick={(event) => {
                if ("targetId" in step && step.targetId) {
                  const onOps =
                    window.location.hash === "#ops" ||
                    window.location.hash.startsWith("#ops-");
                  if (onOps) {
                    event.preventDefault();
                    scrollToTarget(step.targetId);
                  }
                }
              }}
            >
              <span className="wedge-strip__num" aria-hidden="true">
                {step.n}
              </span>
              {step.label}
            </a>
          </li>
        ))}
      </ol>

      <style>{`
        .wedge-strip {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: linear-gradient(135deg, #f0f7ff 0%, #faf8f3 100%);
          border: 1px solid var(--color-line-strong);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-soft);
        }
        .wedge-strip__tagline {
          margin: 0;
          font-size: var(--text-small);
          font-weight: 700;
          color: var(--color-sea-deep);
          white-space: nowrap;
        }
        .wedge-strip__steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          flex: 1;
          justify-content: flex-start;
        }
        .wedge-strip__step {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: .35rem .75rem;
          border: 1px solid var(--color-line);
          border-radius: 999px;
          background: var(--color-paper-elevated);
          font-size: var(--text-small);
          font-weight: 600;
          color: var(--color-ink);
          text-decoration: none;
          transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
        }
        .wedge-strip__step:hover,
        .wedge-strip__step:focus-visible {
          border-color: var(--color-sea-deep);
          box-shadow: 0 0 0 2px rgba(15, 76, 129, 0.12);
          outline: none;
        }
        .wedge-strip__num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 50%;
          background: var(--color-sea-deep);
          color: #fff;
          font-size: var(--text-micro);
          font-weight: 700;
          line-height: 1;
        }
        @media (max-width: 640px) {
          .wedge-strip { flex-direction: column; align-items: stretch; }
          .wedge-strip__steps { justify-content: center; }
          .wedge-strip__tagline { white-space: normal; }
        }
      `}</style>
    </nav>
  );
}
