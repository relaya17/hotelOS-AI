/** Header anchors on the Hebrew www landing — keep in sync with section `id`s. */
export const NAV_LINKS = [
  { href: "#platform", label: "הפלטפורמה" },
  { href: "#outcomes", label: "תוצאות" },
  { href: "#demo", label: "דמו" },
  { href: "#profit", label: "רווחיות" },
  { href: "#how-pilot", label: "שלבי פיילוט" },
  { href: "#packages", label: "חבילות" },
  { href: "#measure", label: "מדידה" },
  { href: "#trust", label: "אמון" },
  { href: "#faq", label: "שאלות" },
  { href: "#excellence", label: "מסמכים" },
  { href: "#contact", label: "צור קשר" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
