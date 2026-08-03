export type LegalDocumentId = "terms" | "cookies" | "security" | "privacy" | "meetings";

export type LegalDocument = {
  readonly id: LegalDocumentId;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly updatedAt: string;
  readonly version: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
  }[];
};

const UPDATED = "2026-07-17";

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    id: "terms",
    titleHe: "תנאי שימוש",
    titleEn: "Terms of Use",
    updatedAt: UPDATED,
    version: "2026.1",
    sections: [
      {
        heading: "1. קבלת התנאים",
        body: "השימוש ב־HotelOS AI (להלן: \"המערכת\") מהווה הסכמה לתנאים אלה. המערכת מיועדת לרשתות מלונות, צוותים ואורחים מורשים בלבד.",
      },
      {
        heading: "2. חשבונות והרשאות",
        body: "כל משתמש אחראי לשמירת פרטי ההתחברות. פעולות מתבצעות בהקשר Tenant / Chain / Hotel בהתאם להרשאות RBAC. אסור לשתף גישה בין ארגונים.",
      },
      {
        heading: "3. סוכנים חכמים ואוטומציות",
        body: "פעולות AI כפופות למדיניות Suggest → Approve → Act. פעולות כספיות ורגישות דורשות אישור אנושי אלא אם הוגדר אחרת על ידי מנהל הרשת.",
      },
      {
        heading: "4. הקלטות ונוכחות",
        body: "הקלטות פגישות ורישומי שעון נוכחות נשמרים בהפרדת נתונים לפי Tenant. השימוש בהם כפוף לדין החל, למדיניות המעסיק ולמדיניות HotelOS Meet (meetings.2026.1) — כולל הסכמה מפורשת להקלטה, שמירה עד 90 יום, ואיסור הקלטה סמויה.",
      },
      {
        heading: "5. תשלומים וחתימה דיגיטלית",
        body: "תשלומים וחתימות דיגיטליות מיועדים לעסקאות מורשות בלבד. חתימה דיגיטלית מהווה אישור מודע לפעולה הרשומה במערכת.",
      },
    ],
  },
  {
    id: "cookies",
    titleHe: "מדיניות עוגיות",
    titleEn: "Cookies Policy",
    updatedAt: UPDATED,
    version: "2026.1",
    sections: [
      {
        heading: "1. מהן עוגיות / אחסון מקומי",
        body: "HotelOS משתמש ב־localStorage/session לצורך סשן מאובטח, העדפת שפה, והסכמת עוגיות. אין שימוש בעוגיות פרסום צד־שלישי כברירת מחדל.",
      },
      {
        heading: "2. הכרחיות",
        body: "עוגיות/אחסון הכרחי: אימות (JWT בזיכרון מקומי), CSRF/correlation, העדפת locale, והסכמת פרטיות.",
      },
      {
        heading: "3. בחירה",
        body: "ניתן לאשר עוגיות פונקציונליות או רק הכרחיות. סירוב לעוגיות הכרחיות עלול למנוע התחברות.",
      },
      {
        heading: "4. שמירת הסכמה",
        body: "הסכמה נשמרת מקומית ומסונכרנת לשרת (אם מחוברים) עם חותמת זמן וגרסת מדיניות.",
      },
    ],
  },
  {
    id: "security",
    titleHe: "מדיניות אבטחה",
    titleEn: "Security Policy",
    updatedAt: UPDATED,
    version: "2026.1",
    sections: [
      {
        heading: "1. עקרונות",
        body: "הפרדת Tenant מחייבת, הצפנת סיסמאות (scrypt), JWT קצרים, כותרות אבטחה ב־API, וביקורת (audit) לפעולות רגישות.",
      },
      {
        heading: "2. אימות",
        body: "נתמכים: סיסמה, Google OAuth (צוות), WebAuthn/ביומטריה (אצבע/פנים לפי מכשיר), ואימות קולי כשכבת חיזוק לנוכחות.",
      },
      {
        heading: "3. נתונים רגישים",
        body: "הקלטות, חתימות ותשלומים נשמרים בהפרדה לוגית (tenant/chain/room או employee). גישה רק עם הרשאה.",
      },
      {
        heading: "4. דיווח",
        body: "חשד לאבטחה יש לדווח למנהל הרשת. אירועים נרשמים ב־audit_events.",
      },
    ],
  },
  {
    id: "privacy",
    titleHe: "פרטיות",
    titleEn: "Privacy",
    updatedAt: UPDATED,
    version: "2026.1",
    sections: [
      {
        heading: "1. מידע שנאסף",
        body: "פרטי חשבון, פעילות תפעולית, נוכחות עובדים, הקלטות פגישות (באישור), ונתוני תשלום מינימליים לעסקה.",
      },
      {
        heading: "2. מטרות",
        body: "תפעול מלון, בקרת רשת, עמידה רגולטורית, שיפור שירות ואבטחה.",
      },
      {
        heading: "3. זכויות",
        body: "בקשות עיון/מחיקה בהתאם לדין ולמדיניות הארגון המפעיל את ה־Tenant.",
      },
    ],
  },
  {
    id: "meetings",
    titleHe: "מדיניות הקלטות ופגישות (HotelOS Meet)",
    titleEn: "Meetings & Recordings Policy (HotelOS Meet)",
    updatedAt: "2026-08-03",
    version: "meetings.2026.1",
    sections: [
      {
        heading: "1. מטרה",
        body: "HotelOS Meet מאפשר פגישות פנימיות (ועדות, הדרכות, כלל-עובדים) עם סיכום AI, נוכחות והקלטה מודעת. המדיניות מגדירה הסכמה, שמירה ושימוש.",
      },
      {
        heading: "2. הסכמה להקלטה",
        body: "הקלטת פגישה מותרת רק לאחר שהמשתתף (כולל מארח/ת הפגישה) אישר/ה במפורש את מדיניות ההקלטה בגרסה הפעילה. אין הקלטה סמויה.",
      },
      {
        heading: "3. שמירה ומחיקה",
        body: "הקלטות ותמלולים נשמרים בהפרדה לפי Tenant/Chain/Room עד 90 יום, אלא אם החוק או מדיניות הארגון דורשים אחרת.",
      },
      {
        heading: "4. מזכירת פגישות (AI)",
        body: "סוכן meeting_secretary מעבד את תמליל השיח בחדר לצורך סיכום, החלטות ויעדים — לא נתונים אישיים פרטיים מעבר לתוכן הפגישה.",
      },
      {
        heading: "5. אישור עובד/ת",
        body: "השימוש ב־Meet, כולל הקלטה וסיכום AI, מהווה הכרה במדיניות זו ובתנאי השימוש הכלליים של HotelOS AI.",
      },
    ],
  },
] as const;

export function getLegalDocument(id: string): LegalDocument | null {
  return LEGAL_DOCUMENTS.find((doc) => doc.id === id) ?? null;
}
