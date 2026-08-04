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

export type PlatformPillar = {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly proof: string;
};

/** Four executive pillars — capabilities / reliability / stability / innovation. */
export const PLATFORM_PILLARS: readonly PlatformPillar[] = [
  {
    id: "capabilities",
    eyebrow: "יכולות",
    title: "מערכת הפעלה לרשת — לא עוד אפליקציה למחלקה",
    body: "Executive לרשת, Admin למלון, Work לעובד, Guest לאורח — על אותה ליבת אותות. תדריך מנכ״ל, מרכז תקלות, תחזית, תחזוקה חזויה, המלצות הכנסה, צ׳אט רב־לשוני וסוכנים דרך AI Gateway אחד.",
    proof: "ארבע אפליקציות · AI Gateway · Land & Expand",
  },
  {
    id: "reliability",
    eyebrow: "אמינות",
    title: "AI שמציע — אדם שמאשר — מערכת שמבצעת",
    body: "Suggest → Approve → Act על כסף ותעריף. בלי קופסה שחורה. בלי הבטחת «הסוכן סגר לבד». ככה רשת סוגרת פיילוט בלי פחד מוועדת כספים.",
    proof: "HITL · אישורי AI · Audit לתהליכים רגישים",
  },
  {
    id: "stability",
    eyebrow: "יציבות",
    title: "שכבה מעל ה־PMS — לא פרויקט החלפה של 18 חודשים",
    body: "Opera / Protel / Fidelio / Clock נשארים מקור האמת להזמנות. HotelOS מתחברת כשכבת בינה: פחות סיכון הטמעה, יותר מהירות לערך, בלי לשבור את חדר האוכל של המערכת הקיימת.",
    proof: "GR-016 · Intelligence Layer · ללא rip-and-replace",
  },
  {
    id: "innovation",
    eyebrow: "חדשנות",
    title: "נבנית כקטגוריה: Intelligence Layer למלונות",
    body: "לא צ׳אטבוט על Excel ולא דשבורד אתמול. סוכנים, Digital Twin ויזואלי, תחזית, אנרגיה, מוניטין→משימה, ו־10 שפות מאומתות — מוצר שמוגדר כמערכת הפעלה לרשת, לא כתוסף נקודתי.",
    proof: "Twin · Forecast · i18n verified · Turbo OS",
  },
] as const;

export const OUTCOMES: readonly OutcomeRow[] = [
  {
    id: "briefing",
    pain: "הבוקר מתחיל בציד מידע משבע מערכות",
    cost: "שעות הנהלה כל שבוע — לפני שהאורח בכלל בדלפק",
    outcome: "תדריך מנכ״ל אחד: מצב עכשיו + מה צפוי",
    href: "#intelligence",
  },
  {
    id: "incidents",
    pain: "תקלות נופלות בין מחלקות ו־WhatsApp",
    cost: "פיצויים, ביקורות רעות, חדרים סגורים",
    outcome: "מרכז תקלות מאוחד עם דחיפות ואחריות",
    href: "#demo",
  },
  {
    id: "foresight",
    pain: "מחליטים לפי אתמול",
    cost: "כוח אדם, תפוסה ותחזוקה מגיבים מאוחר מדי",
    outcome: "תחזית + אנומליות + תחזוקה חזויה",
    href: "#intelligence",
  },
  {
    id: "rooms",
    pain: "חדר לא מוכן בזמן הצ׳ק־אין",
    cost: "אורח ממתין · שדרוג חירום · אובדן אמון",
    outcome: "תיעדוף משק בית ומשימות חיות",
    href: "#outcomes",
  },
  {
    id: "finance",
    pain: "המלצות כסף בלי בקרה",
    cost: "סיכון ל־CFO ולרשת",
    outcome: "הכנסה ואנרגיה עם אישור אנושי (HITL)",
    href: "#intelligence",
  },
  {
    id: "bookings",
    pain: "הכנסה נלווית בלי תהליך",
    cost: "upsell שלא קורה · מוניטין בלי תור טיפול",
    outcome: "תהליך upsell + מוניטין→משימה (כשסוגרים בהיקף)",
    href: "#profit",
  },
  {
    id: "chat",
    pain: "הצוות מדבר בעשר שפות — המערכת לא",
    cost: "טעויות תפעול בין קבלה למשק בית",
    outcome: "הוראה אחת · כל עובד בשפתו · אוטומציה משותפת",
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
    title: "שכבת בינה אחת מעל התשתית שכבר שלמה",
    body: "PMS, HR, כספים, תחזוקה ו־BI לא נזרקים. HotelOS אוספת אותות ומחזירה החלטות למנכ״ל, למנהל מלון ולעובד — בלי פרויקט «יום ד׳ של החלפת מערכת».",
    proof: "Intelligence Layer · connectors מודולריים",
  },
  {
    id: "agents",
    title: "רשת סוכנים שמרכיבה תהליך תפעולי",
    body: "CIO, תפעול, כספים, אורח, HR ומזכירת פגישות — דרך AI Gateway יחיד. מציעים, מתריעים, מתזמנים. מה שרגיש עובר אישור אנושי לפני פעולה.",
    proof: "AI Gateway · Suggest → Approve → Act",
  },
  {
    id: "foresight",
    title: "רואים את המלון — ומחר שלו",
    body: "Digital Twin לחדרי מלון, תחזית שבעה ימים, אנומליות ותחזוקה חזויה. ניהול לפי מה שמתהווה — לא רק סיכום מה שכבר קרה.",
    proof: "Twin · Forecast · Predictive maintenance",
  },
  {
    id: "finance",
    title: "הכנסה וכסף עם שליטת CFO",
    body: "המלצות תעריף ואנרגיה, סגירות ותהליכים כספיים — עם HITL. חדשנות בלי לוותר על בקרה שרשת דורשת.",
    proof: "Revenue HITL · Energy · Ledger path",
  },
  {
    id: "chat",
    title: "שפה אחת לרשת — כל עובד בשפתו",
    body: "הוראה נכתבת פעם אחת ב־Executive; העובדים מקבלים בשפתם. ב־Work — משימות, נוכחות ו־Copilot לפי תפקיד. עשר שפות מאומתות בפלטפורמה.",
    proof: "Turbo i18n · Work Copilot · 10 locales verified",
  },
  {
    id: "ops",
    title: "תמונת שרשרת במקום דוח לכל מלון",
    body: "Multi-hotel, Incident Center, מוניטין שמפעיל משימה, אנרגיה ו־VMS — אותה שפה תפעולית לרשת, לא עוד ייצוא Excel לכל נכס.",
    proof: "Chain Executive · Incidents · Reputation · Energy",
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
  "שכבת הבינה מעל כל מערכת מלון.",
  "סוכנים שמזיזים תפעול — עם אישור אדם על הכסף.",
  "כתבו בשפה אחת. הצוות קורא בשלו. הרשת רואה הכל.",
  "לא מחליפים את ה־PMS. הופכים אותו לחכם.",
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

export type PilotStep = {
  readonly id: string;
  readonly week: string;
  readonly title: string;
  readonly body: string;
};

export const PILOT_STEPS: readonly PilotStep[] = [
  {
    id: "w0",
    week: "שבוע 0",
    title: "חיבור + baseline",
    body: "מלון אחד מעל ה־PMS הקיים. ממלאים Pilot ROI Scorecard — בלי הבטחות מספרים מוקדמות.",
  },
  {
    id: "w12",
    week: "שבוע 1–2",
    title: "Wedge חי",
    body: "תדריך מנכ״ל יומי, מרכז תקלות, והתראות — תמונה אחת להנהלה.",
  },
  {
    id: "w3",
    week: "שבוע 3",
    title: "הרחבה מדודה",
    body: "Upsell / מוניטין / תחזוקה חזויה — לפי מה שסוכם בפיילוט, עם Suggest → Approve → Act.",
  },
  {
    id: "w4",
    week: "שבוע 4",
    title: "החלטה",
    body: "מדידה מול baseline. ממשיכים ל־Network, עוצרים, או מרחיבים דומיין — בלי לחץ החלפת PMS.",
  },
] as const;

export type PackageTier = {
  readonly id: string;
  readonly name: string;
  readonly audience: string;
  readonly points: readonly string[];
};

export const PACKAGES: readonly PackageTier[] = [
  {
    id: "pilot",
    name: "Pilot",
    audience: "מלון אחד · הוכחת ערך · $5,000 USD / 8 שבועות",
    points: [
      "Wedge: תדריך · תקלות · תחזוקה חזויה MVP",
      "מדידה ב־ROI Scorecard",
      "HITL על פעולות רגישות · מחיר אחיד USD בכל העולם",
    ],
  },
  {
    id: "network",
    name: "Network",
    audience: "רשת · $1,000 USD / מלון / חודש",
    points: [
      "תמונת שרשרת ב־Executive",
      "Land & expand דומיינים אחרי הוכחה",
      "צ׳אט מתורגם + משימות Work · prepaid שנתי $10,800 (−10%)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "קבוצות · from $75,000 USD ACV / שנה",
    points: [
      "DPA עם counsel · שאלון אבטחה",
      "בקרות חיות + נתיב attestation (בלי לספר תעודה שלא קיימת)",
      "SLA ותיאום אינטגרציות לפי היקף",
    ],
  },
] as const;

export const INTEGRATIONS = [
  {
    id: "pms",
    title: "PMS נשאר מקור אמת",
    body: "Opera · Protel · Fidelio · Clock — הקשר תפעולי מעל המערכת הקיימת. לא תו התקן של הספק, ולא החלפת מערכת הזמנות.",
  },
  {
    id: "channels",
    title: "אותות מבחוץ",
    body: "מוניטין (Google / Booking / TripAdvisor ingest) · ציוד · אנרגיה — לפי חיבורים שסוכמו בפיילוט.",
  },
  {
    id: "hitl",
    title: "בלי כתיבה עיוורת ל־PMS",
    body: "המלצות תעריף ופעולות כספיות עוברות אישור אנושי. אין הבטחת writeback אוטומטי ב־MVP.",
  },
] as const;

export const DEMO_BEATS = [
  {
    id: "briefing",
    title: "תדריך מנכ״ל",
    body: "תמונת בוקר אחת: תפוסה, תקלות, תחזית — במקום איסוף מ־7 מערכות.",
  },
  {
    id: "incidents",
    title: "מרכז תקלות",
    body: "דחוף מאוחד למחלקות. רואים מה פתוח ומי אחראי.",
  },
  {
    id: "approve",
    title: "Suggest → Approve → Act",
    body: "ה־AI מציע; אדם מאשר; המערכת מבצעת פעולה מוגדרת — בלי קופסה שחורה על כסף.",
  },
] as const;

export const PROFIT_LEVERS = [
  {
    id: "time",
    title: "שעות הנהלה חוזרות להחלטות",
    body: "כשתדריך הבוקר יורד מציד מידע ל־תמונה אחת, השעות שנמדדו ב־scorecard הן payback מול Pilot $5,000 ו־Network $1,000 לחודש — לא סלוגן.",
  },
  {
    id: "risk",
    title: "סיכון תפעולי יורד כשהדחוף לא נעלם",
    body: "מרכז תקלות + אחריות ברורה מקצרים זמן לתגובה. פחות פיצוי, פחות חדר סגור, פחות ביקורת שמתגלגלת בלי בעלים.",
  },
  {
    id: "lift",
    title: "הכנסה נלווית נכנסת רק כשיש תהליך",
    body: "Upsell ומוניטין→משימה הם דומיינים להרחבה אחרי ה־wedge. משלמים על מה שסוגרים בהיקף — ורואים המרה במדידה, לא במצגת.",
  },
] as const;

export const MODULAR_PATHS = [
  {
    id: "wedge",
    title: "יום 1: wedge שמנצח את הספקנות",
    body: "תדריך · תקלות · HITL. שלושה מסכים בדמו. זה מה שרשת מאשרת בוועדה — לפני שמראים 16 מחלקות.",
  },
  {
    id: "expand",
    title: "אחרי הוכחה: דומיין־דומיין",
    body: "משק בית, קבלה, תחזוקה, HR, Guest — Land & Expand. אפשר Network על חלק מהמערכת בלי לקנות «הכל» ביום חתימה.",
  },
  {
    id: "integrate",
    title: "התממשקות נכונה = מעל, לא במקום",
    body: "PMS = מקור אמת להזמנות. HotelOS = אותות, המלצות, אישורים ואוטומציות. בלי writeback עיוור. בלי פרויקט החלפת ליבה.",
  },
] as const;

export const EXCELLENCE_LINKS = [
  {
    id: "playbook",
    label: "Pilot playbook",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/pilot-playbook.md",
  },
  {
    id: "sales-pack",
    label: "Sales pack (Print → PDF)",
    href: "/sales-pack/index.html",
  },
  {
    id: "demo-script",
    label: "Demo script 15 min",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/sales-pack/demo-script-15min.md",
  },
  {
    id: "security",
    label: "Security questionnaire",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/security-questionnaire-pack.md",
  },
  {
    id: "soc2",
    label: "SOC 2 Phase 0",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/soc2-phase0.md",
  },
  {
    id: "dataroom",
    label: "Data room index",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/gtm/README.md",
  },
  {
    id: "closeout",
    label: "Excellence board",
    href: "https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/gtm-excellence-closeout.md",
  },
] as const;
