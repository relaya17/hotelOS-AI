import { useEffect, useId, useState } from "react";
import { CookieBanner } from "@hotelos/ui";
import {
  APP_URLS,
  getConsentSubjectKey,
  saveCookieConsent,
} from "@hotelos/web-client";
import { TAGLINES } from "../content.js";
import { SiteFooter } from "./site-footer.js";
import { SiteHeader } from "./site-header.js";
import { CeoSection } from "./sections/ceo-section.js";
import { ChatSection } from "./sections/chat-section.js";
import { CompareSection } from "./sections/compare-section.js";
import { ContactSection } from "./sections/contact-section.js";
import { DemoSection } from "./sections/demo-section.js";
import { DigitizationSection } from "./sections/digitization-section.js";
import { ExcellenceSection } from "./sections/excellence-section.js";
import { FaqSection } from "./sections/faq-section.js";
import { HeroSection } from "./sections/hero-section.js";
import { HowPilotSection } from "./sections/how-pilot-section.js";
import { IntelligenceSection } from "./sections/intelligence-section.js";
import { IntegrationsSection } from "./sections/integrations-section.js";
import { MeasureSection } from "./sections/measure-section.js";
import { OsSection } from "./sections/os-section.js";
import { OutcomesSection } from "./sections/outcomes-section.js";
import { PackagesSection } from "./sections/packages-section.js";
import { PartnersSection } from "./sections/partners-section.js";
import { PlatformSection } from "./sections/platform-section.js";
import { ProfitSection } from "./sections/profit-section.js";
import { StatusLandingSection } from "./sections/status-landing-section.js";
import { TaglinesSection } from "./sections/taglines-section.js";
import { TrustSection } from "./sections/trust-section.js";
import { WedgeSection } from "./sections/wedge-section.js";

export function LandingPage() {
  const [activeTag, setActiveTag] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTag((prev) => (prev + 1) % TAGLINES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => {
      if (!mq.matches) setMenuOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site">
      <a className="skip" href="#outcomes">
        דלג לתוכן
      </a>

      <SiteHeader
        navSolid={navSolid}
        menuOpen={menuOpen}
        menuId={menuId}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={closeMenu}
      />

      <main id="top">
        <HeroSection />
        <PlatformSection />
        <OutcomesSection />
        <WedgeSection />
        <CompareSection />
        <IntelligenceSection />
        <ChatSection />
        <OsSection />
        <TaglinesSection
          activeTag={activeTag}
          onSelectTag={setActiveTag}
        />
        <DigitizationSection />
        <CeoSection />
        <DemoSection />
        <PartnersSection />
        <HowPilotSection />
        <PackagesSection />
        <ProfitSection />
        <MeasureSection />
        <IntegrationsSection />
        <TrustSection />
        <StatusLandingSection />
        <FaqSection />
        <ExcellenceSection />
        <ContactSection />
      </main>

      <SiteFooter />

      <CookieBanner
        legalCookiesUrl={APP_URLS.legal("cookies")}
        onConsent={(consent) => {
          void saveCookieConsent({
            subjectKey: getConsentSubjectKey("www"),
            necessary: consent.necessary,
            functional: consent.functional,
          });
        }}
      />
    </div>
  );
}
