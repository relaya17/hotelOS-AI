import { FRAGMENTED_STACK } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function WedgeSection() {
  return (
    <RevealSection
      id="wedge"
      className="section wedge"
      aria-labelledby="wedge-title"
    >
      <p className="eyebrow">למה זה שונה</p>
      <h2 id="wedge-title">שבע מערכות רצות. התמונה עדיין חסרה.</h2>
      <p className="section__lead">
        PMS, HR, הנה״ח, CRM, תחזוקה, BI ואפליקציית עובדים — כל אחת חזקה
        לבד. אצלכם יחד הן מייצרות ציד בוקר וכפילויות. HotelOS מאחדת את
        האותות להחלטה — בלי לקרוע את התשתית שלכם.
      </p>
      <ul className="wedge-stack" aria-label="מערכות מפוצלות היום">
        {FRAGMENTED_STACK.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="wedge-punch">
        צ׳אט GPT על Excel אינו מערכת הפעלה. HotelOS מפעילה תהליכים —
        עם אישור אדם על מה שנוגע בכסף ובסיכון.
      </p>
    </RevealSection>
  );
}
