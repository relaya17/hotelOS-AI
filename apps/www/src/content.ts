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

/** Systems hotels run separately today — the fragmentation story. */
export const FRAGMENTED_STACK = [
  "PMS",
  "HR",
  "הנה״ח",
  "CRM",
  "תחזוקה",
  "BI",
  "אפליקציית עובדים",
] as const;

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "layer",
    title: "שכבה אחת מעל המערכות — לא במקומן",
    body: "PMS, HR, כספים, תחזוקה ו־BI נשארים. HotelOS מאחד אותות ומציג החלטות למנכ״ל ולעובד — בלי פרויקט החלפת תשתית.",
    proof: "Intelligence Layer · connectors מודולריים · GR-016",
  },
  {
    id: "agents",
    title: "סוכני AI שמפעילים תהליך — לא רק עונים",
    body: "רשת סוכנים (CIO, HR, Guest, CFO, Meeting Secretary…) דרך AI Gateway: מציעים, מתזמנים, מתריעים — ואתם מאשרים מה שקריטי.",
    proof: "Suggest → Approve → Act עם human-in-the-loop",
  },
  {
    id: "foresight",
    title: "Digital Twin · תחזית · תחזוקה חזויה",
    body: "תמונת מלון חיה, תחזית 7 ימים, אנומליות ותחזוקה חזויה — כדי לנהל מחר היום, לא רק לדווח אתמול.",
    proof: "Twin · Forecast · Predictive maintenance",
  },
  {
    id: "finance",
    title: "כספים ו־Revenue עם שליטה",
    body: "המלצות תמחור וסגירת חודש עם אישור CFO/רו״ח — בלי ביצוע כספי אוטונומי עיוור.",
    proof: "Revenue HITL · Ledger · Accountant role",
  },
  {
    id: "chat",
    title: "צ׳אט רב־לשוני + Copilot לעובד",
    body: "כותבים בשפתכם; הצד השני מקבל בשפתו. על אותה שיחה — משימות ואוטומציות לפי תפקיד.",
    proof: "Turbo i18n · Staff chat · Role-based agents",
  },
  {
    id: "ops",
    title: "תפעול חוצה־רשת",
    body: "Multi-hotel, מוניטין→משימות, Incident Center, אנרגיה ו־VMS — תובנות לרשת במקום דוחות לכל מלון בנפרד.",
    proof: "Chain dashboard · Incidents · Energy · VMS",
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
