import { PLATFORM_PILLARS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function PlatformSection() {
  return (
    <RevealSection
      id="platform"
      className="section platform"
      aria-labelledby="platform-title"
      tabIndex={-1}
    >
      <p className="eyebrow">הפלטפורמה</p>
      <h2 id="platform-title">
        יכולות. אמינות. יציבות. חדשנות — במערכת אחת לרשת שלכם.
      </h2>
      <p className="section__lead">
        לא עוד צ׳אטבוט על ה־Excel שלכם. Intelligence Layer: ארבע אפליקציות,
        AI Gateway אחד, ופיילוט שאתם מודדים לפני שמרחיבים דומיין.
      </p>
      <ul className="pillar-grid">
        {PLATFORM_PILLARS.map((pillar) => (
          <li key={pillar.id} className="pillar">
            <p className="pillar__eyebrow">{pillar.eyebrow}</p>
            <h3>{pillar.title}</h3>
            <p>{pillar.body}</p>
            <p className="pillar__proof">{pillar.proof}</p>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}
