import { ContactLeadForm } from "../contact-lead-form.js";
import { RevealSection } from "../reveal-section.js";

export function ContactSection() {
  return (
    <RevealSection
      id="contact"
      className="section contact"
      aria-labelledby="contact-title"
    >
      <h2 id="contact-title">פיילוט לרשת שלכם. תוצאות שאתם מודדים.</h2>
      <p className="section__lead">
        השאירו פרטים — נפתח מייל מוכן ל־pilot@hotelos.ai. אפשר גם לקבוע
        שיחה אם הוגדר יומן.
      </p>
      <ContactLeadForm />
      <div className="contact__actions contact__actions--secondary">
        <a
          className="btn btn--ghost"
          href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/one-pager-hotel.md"
        >
          One-pager לרשת
        </a>
        <a
          className="btn btn--ghost"
          href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pitch-deck-12-slides.md"
        >
          Deck למשקיע (12 שקפים)
        </a>
      </div>
    </RevealSection>
  );
}
