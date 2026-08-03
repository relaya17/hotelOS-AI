export type OutcomeRow = {
  readonly id: string;
  readonly pain: string;
  readonly cost: string;
  readonly outcome: string;
  readonly href: string;
};

export type Capability = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly proof: string;
};

export const OUTCOMES: readonly OutcomeRow[] = [
  {
    id: "briefing",
    pain: "מנהלים מבזבזים זמן על דוחות",
    cost: "שעות עבודה רבות בכל שבוע",
    outcome: "AI Executive Briefing + סוכנים אוטומטיים",
    href: "#intelligence",
  },
  {
    id: "foresight",
    pain: "החלטות בלי ראיית עתיד",
    cost: "תפוסה, כוח אדם ותחזוקה מגיבים מאוחר",
    outcome: "סוכנים שרואים תחזיות ואנומליות מראש",
    href: "#intelligence",
  },
  {
    id: "finance",
    pain: "כספים וסגירת חודש ידניים",
    cost: "סיכון, עיכובים ועומס על CFO",
    outcome: "סוכן כספים + אישור אנושי (HITL)",
    href: "#intelligence",
  },
  {
    id: "bookings",
    pain: "הזמנות בלי אוטומציית הכנסה",
    cost: "פספוס upsell והכנסות נלוות",
    outcome: "הזמנות חכמות + הצעות upsell",
    href: "#intelligence",
  },
  {
    id: "chat",
    pain: "צוותים מדברים בשפות שונות",
    cost: "טעויות, עיכובים ואובדן הקשר",
    outcome: "צ׳אט: כותבים בשפתכם — הצד השני מקבל בשפתו",
    href: "#chat",
  },
  {
    id: "rooms",
    pain: "חדרים לא מוכנים בזמן",
    cost: "אובדן הכנסות ואי־שביעות רצון",
    outcome: "Housekeeping AI ותיעדוף משימות",
    href: "#outcomes",
  },
  {
    id: "incidents",
    pain: "תקלות שלא מטופלות בזמן",
    cost: "פיצויים ותלונות",
    outcome: "Incident Center · Predictive Maint · Alerts",
    href: "#ceo-value",
  },
] as const;

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "agents",
    title: "סוכני AI עם אוטומציה",
    body: "רשת של סוכנים (CIO, HR, Guest, CFO, Meeting Secretary ועוד) עובדת דרך AI Gateway — לא קריאות LLM פזורות בקוד עסקי.",
    proof: "Suggest → Approve → Act עם human-in-the-loop",
  },
  {
    id: "foresight",
    title: "רואים \"עתידות\" לפני שהן קורות",
    body: "תחזית 7 ימים (הגעות, תפוסה, כוח אדם), זיהוי אנומליות תפעול, ותחזוקה חזויה — כדי לנהל מחר היום.",
    proof: "Forecast · Anomaly detection · Predictive maintenance",
  },
  {
    id: "finance",
    title: "ניהול כספים חכם",
    body: "סוכן כספים מכין המלצות וסגירת חודש; רואה חשבון / CFO מאשר. בלי ביצוע כספי אוטונומי עיוור.",
    proof: "Ledger pack · Trusted sources · Accountant role",
  },
  {
    id: "bookings",
    title: "הזמנות + הכנסה נלווית",
    body: "שכבה מעל ההזמנות: upsell לאורח, תיעדוף חדרים, וקישור בין קבלה, משק בית והכנסות.",
    proof: "Upsell offers · Room prep · Revenue suggestions",
  },
  {
    id: "chat",
    title: "צ׳אט רב־לשוני אוטומטי",
    body: "עובד כותב בעברית / אנגלית / שפה אחרת — הצד השני מקבל הודעה בשפתו. אוטומציות על אותה שיחה: משימות, תזכורות, העברות.",
    proof: "Turbo i18n · Staff chat · Automations on threads",
  },
  {
    id: "ops",
    title: "תפעול שמגיב לבד (עם שליטה)",
    body: "מוניטין→משימות, מרכז תקלות, אנרגיה, VMS ותדריכי מנכ״ל — אוטומציה שמקצרת זמן ניהול בלי לאבד שליטה.",
    proof: "Reputation · Incidents · Energy · Meet secretary",
  },
] as const;

export const CHAT_DEMO = {
  senderLang: "עברית",
  receiverLang: "English",
  senderLabel: "קבלה · תל אביב",
  receiverLabel: "Housekeeping · Floor 4",
  outgoing: "החדר 412 צריך להיות מוכן ל־14:00. יש גם בקשת מיטת תינוק.",
  incoming: "Room 412 must be ready by 2:00 PM. Also a crib request.",
  automation: "נוצרה משימת Housekeeping · עדיפות גבוהה · תזכורת 13:30",
} as const;

export const TAGLINES = [
  "One AI Platform. Every Hotel. Every Employee. Every Guest.",
  "Agents that automate ops, finance, bookings — and see what's next.",
  "Write in your language. They read in theirs. Automations for both.",
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
