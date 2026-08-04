import { WORLD_COMPARISON } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function CompareSection() {
  return (
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
        בדרך כלל מציעים לכם suite מלאה, כלי AI נקודתי, או דשבורד של אתמול.
        כאן מתחילים מ־wedge מעל ה־PMS שלכם — סוכנים, תמונה חיה, ופעולה עם
        אישור שלכם.
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
  );
}
