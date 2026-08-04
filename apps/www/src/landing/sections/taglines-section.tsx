import { TAGLINES } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function TaglinesSection({
  activeTag,
  onSelectTag,
}: {
  readonly activeTag: number;
  readonly onSelectTag: (index: number) => void;
}) {
  return (
    <RevealSection
      id="taglines"
      className="section taglines"
      aria-labelledby="taglines-title"
    >
      <h2 id="taglines-title" className="visually-hidden">
        איך זה נשמע אצלכם
      </h2>
      <p className="taglines__live" aria-live="polite">
        {TAGLINES[activeTag]}
      </p>
      <ul className="taglines__list">
        {TAGLINES.map((line, index) => (
          <li key={line}>
            <button
              type="button"
              className={
                index === activeTag
                  ? "taglines__dot is-on"
                  : "taglines__dot"
              }
              aria-label={`מסר ${index + 1}`}
              aria-pressed={index === activeTag}
              onClick={() => onSelectTag(index)}
            />
          </li>
        ))}
      </ul>
      <p className="taglines__note">
        אתם לא צריכים להחליף את מערכת ההזמנות המרכזית. אתם צריכים שהיא
        תעבוד חכם יותר — עם שכבת בינה מעליה.
      </p>
    </RevealSection>
  );
}
