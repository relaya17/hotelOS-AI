import type { LocaleCode } from "./locales.js";
import { SUPPORTED_LOCALES } from "./locales.js";

/**
 * Curated instruction phrases for staff chat.
 * Keys are normalized Hebrew source forms used in demos / common ops.
 * All locale values are marked verified (human-curated).
 */
const PHRASES: Record<string, Record<LocaleCode, string>> = {
  "נקו את החדר 102 לפני הצ׳ק־אין": {
    he: "נקו את החדר 102 לפני הצ׳ק־אין",
    en: "Clean room 102 before check-in",
    ar: "نظّفوا الغرفة 102 قبل تسجيل الوصول",
    ru: "Уберите номер 102 до заезда",
    es: "Limpien la habitación 102 antes del check-in",
    th: "ทำความสะอาดห้อง 102 ก่อนเช็กอิน",
    zh: "请在入住前清洁 102 号房间",
    hi: "चेक-इन से पहले कमरा 102 साफ करें",
    tr: "Check-in öncesi 102 numaralı odayı temizleyin",
    el: "Καθαρίστε το δωμάτιο 102 πριν το check-in",
  },
  "בדקו את תזרים המזומנים של הרשת להיום": {
    he: "בדקו את תזרים המזומנים של הרשת להיום",
    en: "Review the chain cash flow for today",
    ar: "راجعوا التدفق النقدي للسلسلة لهذا اليوم",
    ru: "Проверьте денежный поток сети за сегодня",
    es: "Revisen el flujo de caja de la cadena de hoy",
    th: "ตรวจสอบกระแสเงินสดของเครือข่ายวันนี้",
    zh: "请核对本连锁今日现金流",
    hi: "आज की चेन नकदी प्रवाह की जाँच करें",
    tr: "Bugünün zincir nakit akışını kontrol edin",
    el: "Ελέγξτε τη σημερινή ταμειακή ροή της αλυσίδας",
  },
  "פתחו את ועדת הכספים עם סוכן הכספים": {
    he: "פתחו את ועדת הכספים עם סוכן הכספים",
    en: "Open the finance committee with the CFO agent",
    ar: "افتحوا لجنة المالية مع وكيل المالية",
    ru: "Откройте финансовый комитет с CFO-агентом",
    es: "Abran el comité financiero con el agente CFO",
    th: "เปิดคณะกรรมการการเงินพร้อมเอเจนต์ CFO",
    zh: "与财务智能体一起打开财务委员会",
    hi: "CFO एजेंट के साथ वित्त समिति खोलें",
    tr: "CFO ajanıyla finans komitesini açın",
    el: "Ανοίξτε την επιτροπή οικονομικών με τον πράκτορα CFO",
  },
  "עדכנו סטטוס חדר dirty לניקיון מיידי": {
    he: "עדכנו סטטוס חדר dirty לניקיון מיידי",
    en: "Update dirty room status for immediate cleaning",
    ar: "حدّثوا حالة الغرف المتسخة للتنظيف الفوري",
    ru: "Обновите статус грязных номеров для немедленной уборки",
    es: "Actualicen el estado de habitaciones sucias para limpieza inmediata",
    th: "อัปเดตสถานะห้อง dirty เพื่อทำความสะอาดทันที",
    zh: "将脏房状态更新为立即清洁",
    hi: "तत्काल सफाई के लिए डर्टी रूम स्थिति अपडेट करें",
    tr: "Kirli oda durumunu acil temizlik için güncelleyin",
    el: "Ενημερώστε την κατάσταση βρώμικων δωματίων για άμεσο καθαρισμό",
  },
};

export type ChatTranslationBundle = {
  readonly sourceLocale: LocaleCode;
  readonly sourceText: string;
  readonly translations: Record<LocaleCode, string>;
  readonly verification: "verified" | "provisional";
};

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function translateChatInstruction(
  sourceText: string,
  sourceLocale: LocaleCode = "he",
): ChatTranslationBundle {
  const normalized = normalize(sourceText);
  const phrase = PHRASES[normalized];
  if (phrase) {
    return {
      sourceLocale,
      sourceText: normalized,
      translations: { ...phrase },
      verification: "verified",
    };
  }

  // Provisional fallback: keep source for all locales + English mirror note.
  // UI must show verification badge so staff know when human-curated.
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      locale === sourceLocale
        ? normalized
        : locale === "en"
          ? `[Pending verified translation from ${sourceLocale}] ${normalized}`
          : `[⇄ ${sourceLocale}] ${normalized}`,
    ]),
  ) as Record<LocaleCode, string>;

  return {
    sourceLocale,
    sourceText: normalized,
    translations,
    verification: "provisional",
  };
}

export function resolveForLocale(
  bundle: ChatTranslationBundle,
  locale: LocaleCode,
): string {
  return bundle.translations[locale] ?? bundle.sourceText;
}
