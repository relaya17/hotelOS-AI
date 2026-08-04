import { useState } from "react";

export function MeasurePlanner() {
  const [briefingMin, setBriefingMin] = useState(45);
  const [managers, setManagers] = useState(3);
  const [days, setDays] = useState(6);
  const hoursNow = (briefingMin * managers * days) / 60;

  return (
    <div className="measure">
      <p className="measure__disclaimer">
        מחשבים רק את נקודת הפתיחה שלכם לתדריך. יעד השיפור נקבע אחרי baseline
        ב־Pilot ROI Scorecard — בלי אחוז קבוע מראש באתר.
      </p>
      <div className="measure__controls">
        <label>
          <span>דק׳ תדריך בוקר היום</span>
          <input
            type="range"
            min={15}
            max={90}
            value={briefingMin}
            onChange={(event) => setBriefingMin(Number(event.target.value))}
          />
          <strong>{briefingMin}</strong>
        </label>
        <label>
          <span>מנהלים בתדריך</span>
          <input
            type="range"
            min={1}
            max={8}
            value={managers}
            onChange={(event) => setManagers(Number(event.target.value))}
          />
          <strong>{managers}</strong>
        </label>
        <label>
          <span>ימי תדריך / שבוע</span>
          <input
            type="range"
            min={3}
            max={7}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          />
          <strong>{days}</strong>
        </label>
      </div>
      <dl className="measure__out">
        <div>
          <dt>שעות תדריך / שבוע — מצב נוכחי</dt>
          <dd>{hoursNow.toFixed(1)}</dd>
        </div>
      </dl>
      <p className="section__note">
        אחרי שבוע 0 ממלאים יעד משלכם ב־
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
          scorecard
        </a>
        {" · "}
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/sales-pack/case-study-frame.md">
          תבנית case study
        </a>
        .
      </p>
    </div>
  );
}
