import { type CSSProperties } from "react";
import { CEO_BARS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function CeoSection() {
  return (
    <RevealSection
      id="ceo-value"
      className="section ceo"
      aria-labelledby="ceo-title"
    >
      <p className="eyebrow">ערך למנכ״ל</p>
      <h2 id="ceo-title">לפני · אחרי HotelOS</h2>
      <p className="section__lead ceo__disclaimer">
        המחשה בלבד — לא מחקר. את המספרים שלכם תמדדו בפיילוט (
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
  );
}
