export type OutcomeRow = {
  readonly id: string;
  readonly pain: string;
  readonly cost: string;
  readonly outcome: string;
  readonly href: string;
};

export const OUTCOMES: readonly OutcomeRow[] = [
  {
    id: "briefing",
    pain: "מנהלים מבזבזים זמן על דוחות",
    cost: "שעות עבודה רבות בכל שבוע",
    outcome: "AI Executive Briefing אוטומטי",
    href: "#os",
  },
  {
    id: "hr",
    pain: "מחסור בעובדים",
    cost: "ירידה בשירות ועלייה בעלויות",
    outcome: "AI HR + תרגום + אוטומציות",
    href: "#os",
  },
  {
    id: "rooms",
    pain: "חדרים לא מוכנים בזמן",
    cost: "אובדן הכנסות ואי־שביעות רצון",
    outcome: "Housekeeping AI ותיעדוף משימות",
    href: "#outcomes",
  },
  {
    id: "data",
    pain: "מידע מפוזר בין מערכות",
    cost: "החלטות איטיות",
    outcome: "Dashboard אחד לכל הרשת",
    href: "#digitization",
  },
  {
    id: "incidents",
    pain: "תקלות שלא מטופלות בזמן",
    cost: "פיצויים ותלונות",
    outcome: "AI Alerts ואוטומציות",
    href: "#ceo-value",
  },
  {
    id: "comms",
    pain: "תקשורת בין מחלקות",
    cost: "טעויות ועיכובים",
    outcome: "Chat מתורגם לכל שפה",
    href: "#taglines",
  },
] as const;

export const TAGLINES = [
  "One AI Platform. Every Hotel. Every Employee. Every Guest.",
  "The Intelligence Layer Above Every Hotel System.",
  "We don't replace your PMS. We make it smarter.",
] as const;

export const ORG_NODES = {
  executives: ["CEO", "CFO", "COO"] as const,
  departments: [
    "Reception",
    "Housekeeping",
    "HR",
    "Finance",
    "Security",
  ] as const,
} as const;

export const DIGITIZATION = [
  { label: "Excel / WhatsApp / Email", level: 12 },
  { label: "PMS", level: 42 },
  { label: "HotelOS AI", level: 92 },
] as const;

export const CEO_BARS = {
  before: [
    { label: "זמן ניהול", value: 92 },
    { label: "זמן החלטות", value: 78 },
    { label: "עבודת ניירת", value: 88 },
    { label: "שיתוף מידע", value: 40 },
  ],
  after: [
    { label: "זמן ניהול", value: 28 },
    { label: "זמן החלטות", value: 22 },
    { label: "עבודת ניירת", value: 14 },
    { label: "שיתוף מידע", value: 90 },
  ],
} as const;
