import { StatusSectionContent } from "../../status-section.js";
import { RevealSection } from "../reveal-section.js";

export function StatusLandingSection() {
  return (
    <RevealSection
      id="status"
      className="section status"
      aria-labelledby="status-title"
    >
      <StatusSectionContent />
    </RevealSection>
  );
}
