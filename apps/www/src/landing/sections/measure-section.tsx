import { MeasurePlanner } from "../measure-planner.js";
import { RevealSection } from "../reveal-section.js";

export function MeasureSection() {
  return (
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
  );
}
