import { OUTCOMES } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function OutcomesSection() {
  return (
    <RevealSection
      id="outcomes"
      className="section outcomes"
      aria-labelledby="outcomes-title"
    >
      <p className="eyebrow">תוצאות שנמדדות</p>
      <h2 id="outcomes-title">הכאב עולה לכם כסף. כאן מחזירים שליטה.</h2>
      <p className="section__lead">
        אתם לא קונים עוד פיצ׳רים — אתם רוצים פחות שעות ציד בבוקר, פחות
        תקלות שנופלות בין כיסאות, והחלטות בזמן. זה מה שנמדד ב־scorecard.
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
  );
}
