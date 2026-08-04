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

export type WorldComparisonRow = {
  readonly id: string;
  readonly category: string;
  readonly typicalPain: string;
  readonly hotelosAnswer: string;
  readonly isHotelos?: boolean;
};

export type TrustControl = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
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
    id: "incidents",
    pain: "תקלות שלא מטופלות בזמן",
    cost: "פיצויים ותלונות",
    outcome: "Incident Center · Predictive Maint · Alerts",
    href: "#ceo-value",
  },
  {
    id: "foresight",
    pain: "החלטות בלי ראיית עתיד",
    cost: "תפוסה, כוח אדם ותחזוקה מגיבים מאוחר",
    outcome: "סוכנים שרואים תחזיות ואנומליות מראש",
    href: "#intelligence",
  },
  {
    id: "rooms",
    pain: "חדרים לא מוכנים בזמן",
    cost: "אובדן הכנסות ואי־שביעות רצון",
    outcome: "Housekeeping AI ותיעדוף משימות",
    href: "#outcomes",
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
    outcome: "צ׳אט צוות ב־Executive (i18n) · Work: משימות ו־Copilot לפי תפקיד",
    href: "#chat",
  },
] as const;

/** Category comparison vs typical market approaches — no vendor names. */
export const WORLD_COMPARISON: readonly WorldComparisonRow[] = [
  {
    id: "pms-suite",
    category: "PMS / suite מלאה",
    typicalPain:
      "פרויקט החלפה ארוך, התנגדות צוות, ועדיין בלי סוכנים שמפעילים תהליכים",
    hotelosAnswer:
      "מחברים את ה-PMS הקיים — Intelligence Layer מעל, לא rip-and-replace",
  },
  {
    id: "point-ai",
    category: "כלי AI נקודתי / צ׳אטבוט",
    typicalPain:
      "עונה על שאלות — לא יוצר משימות, לא מאחד מערכות, בלי אישור אנושי",
    hotelosAnswer:
      "סוכנים + Suggest → Approve → Act על תדריך, תקלות ותחזוקה",
  },
  {
    id: "bi-only",
    category: "דשבורד BI בלבד",
    typicalPain: "מראה אתמול — לא מציע פעולה; עוד מסך לנתח ידנית",
    hotelosAnswer:
      "תמונה חיה + תחזית + אוטומציות עם HITL — לא רק גרפים",
  },
  {
    id: "staff-app",
    category: "אפליקציית עובדים מבודדת",
    typicalPain:
      "צ׳אט פנימי בלי PMS, תחזוקה או כספים — עוד silo במקום תמונה אחת",
    hotelosAnswer:
      "Work: משימות, נוכחות, מסמכי HR ומבחנים + Copilot לפי תפקיד — על אותם אותות מהשכבה",
  },
  {
    id: "hotelos",
    category: "HotelOS Intelligence Layer",
    typicalPain:
      "דורש אינטגרציות אמינות — לא קסם ביום אחד; מתחילים מ-wedge מצומצם",
    hotelosAnswer:
      "פיילוט: תדריך מנכ״ל + תקלות + תחזוקה חזויה — land & expand אחרי הוכחה",
    isHotelos: true,
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
    title: "צ׳אט הנהלה + Copilot לעובד",
    body: "Staff chat רב־לשוני חי ב־Executive (Turbo i18n). ב־Work — משימות מחלקתיות, מבחנים ו־Copilot לפי תפקיד (לא צ׳אט מתורגם מלא לעובד ב־MVP).",
    proof: "Executive Turbo chat · Work tasks/HR · Role-based agents",
  },
  {
    id: "ops",
    title: "תפעול חוצה־רשת",
    body: "Multi-hotel, מוניטין→משימות, Incident Center, אנרגיה ו־VMS — תובנות לרשת במקום דוחות לכל מלון בנפרד.",
    proof: "Chain dashboard · Incidents · Energy · VMS",
  },
] as const;

/**
 * Only controls that actually exist in the shipped standard/codebase — no
 * SOC2/ISO/compliance-certification claims until an audit backs them.
 * See docs/engineering-standard/08-security.md · docs/security/README.md ·
 * docs/security/live-stream-threat-model.md · docs/adr/0008-ai-gateway.md.
 */
export const TRUST_CONTROLS: readonly TrustControl[] = [
  {
    id: "hitl",
    title: "אישור אנושי על פעולות רגישות (HITL)",
    body: "Suggest → Approve → Act: המלצות תמחור, סגירת חודש ופעולות כספיות אחרות ממתינות לאישור CFO/מנהל לפני ביצוע — בלי אוטונומיה כספית עיוורת.",
  },
  {
    id: "webauthn",
    title: "כניסה עם Passkeys (WebAuthn)",
    body: "לצוות Admin/Executive — כניסה ביומטרית/מפתח מכשיר לצד Google OAuth, מעבר לסיסמה בלבד.",
  },
  {
    id: "rate-limit",
    title: "הגבלת קצב לכל משטח API",
    body: "Buckets ייעודיים ל־API, לקריאות AI ולזרמי מידע חיים — מונעים עומס והתקפות brute-force/DoS.",
  },
  {
    id: "stream-acl",
    title: "הרשאת מלון על זרמי מידע חיים",
    body: "כל חיבור לזרם אירועים דורש JWT + בדיקת הרשאת מלון (ACL) לפני הרשמה — וללא טוקן גלוי בכתובת URL.",
  },
  {
    id: "no-pan",
    title: "לא נשמר מספר כרטיס אשראי (PAN)",
    body: "תשלומים עוברים Tokenization/Vault חיצוני; מסד הנתונים העסקי אינו מאחסן PAN, בהתאם להפרדת scope תשלומים.",
  },
  {
    id: "ai-gateway",
    title: "AI Gateway מרכזי — לא קריאה חופשית למודלים",
    body: "כל קריאת AI עוברת שכבת AI Platform מרכזית עם הרשאות מצומצמות לכל סוכן (least privilege) — קוד עסקי לא פונה למודל ישירות.",
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
