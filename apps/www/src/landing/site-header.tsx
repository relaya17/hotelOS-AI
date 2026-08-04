import { NAV_LINKS } from "../nav-links.js";

export function SiteHeader({
  navSolid,
  menuOpen,
  menuId,
  onToggleMenu,
  onCloseMenu,
}: {
  readonly navSolid: boolean;
  readonly menuOpen: boolean;
  readonly menuId: string;
  readonly onToggleMenu: () => void;
  readonly onCloseMenu: () => void;
}) {
  return (
    <header className={navSolid || menuOpen ? "top is-solid" : "top"}>
      <a
        className="top__brand"
        href="#top"
        aria-label="HotelOS AI — ראש העמוד"
        onClick={onCloseMenu}
      >
        <span className="top__brand-text">
          HotelOS <span className="top__brand-ai">AI</span>
        </span>
      </a>

      <button
        type="button"
        className={menuOpen ? "top__burger is-open" : "top__burger"}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
        onClick={onToggleMenu}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <nav
        id={menuId}
        className={menuOpen ? "top__nav is-open" : "top__nav"}
        aria-label="ניווט ראשי"
      >
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={onCloseMenu}>
            {link.label}
          </a>
        ))}
        <a href="#contact" className="top__cta" onClick={onCloseMenu}>
          פיילוט
        </a>
      </nav>
    </header>
  );
}
