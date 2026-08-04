import { type CSSProperties } from "react";
import { DIGITIZATION } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function DigitizationSection() {
  return (
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
        אתם תקועים בין Excel/וואטסאפ לבין מערכת הזמנות — בלי סוכנים, בלי
        תחזיות, בלי צ׳אט שיוצר משימות. כאן נכנסת שכבת הבינה.
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
  );
}
