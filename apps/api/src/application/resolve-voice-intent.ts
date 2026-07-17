export type VoiceIntentResult = {
  readonly intent: string;
  readonly action: string;
  readonly automationHint: string;
  readonly replyHe: string;
  readonly replyEn: string;
};

export function resolveVoiceIntent(transcript: string): VoiceIntentResult {
  const text = transcript.trim().toLowerCase();

  if (
    text.includes("כספים") ||
    text.includes("finance") ||
    text.includes("cfo") ||
    text.includes("חשבון")
  ) {
    return {
      intent: "open_finance_committee",
      action: "briefing.share_agent.cfo",
      automationHint: "briefing.finance.started",
      replyHe: "מפעיל אוטומציה: פתיחת ועדת כספים ושיתוף סוכן CFO.",
      replyEn: "Running automation: open finance committee and share CFO agent.",
    };
  }

  if (
    text.includes("ניקיון") ||
    text.includes("dirty") ||
    text.includes("housekeeping") ||
    text.includes("נקה")
  ) {
    return {
      intent: "housekeeping_alert",
      action: "notify.housekeeping",
      automationHint: "rooms.dirty.threshold",
      replyHe: "מפעיל אוטומציה: התראת משק בית לחדרים dirty.",
      replyEn: "Running automation: housekeeping alert for dirty rooms.",
    };
  }

  if (
    text.includes("תרגום") ||
    text.includes("translate") ||
    text.includes("צ׳אט") ||
    text.includes("chat")
  ) {
    return {
      intent: "staff_chat_translate",
      action: "i18n.translate.deliver",
      automationHint: "chat.instruction.posted",
      replyHe: "הוראות בצ׳אט יתורגמו אוטומטית לשפת כל עובד.",
      replyEn: "Staff chat instructions will auto-translate per employee locale.",
    };
  }

  if (
    text.includes("חשבונ") ||
    text.includes("accounting") ||
    text.includes("ledger") ||
    text.includes("ספר ראשי")
  ) {
    return {
      intent: "open_accounting",
      action: "accounting.open_ledger",
      automationHint: "night.audit.close",
      replyHe: "פותח הנהלת חשבונות פנימית / סנכרון ERP.",
      replyEn: "Opening internal accounting / ERP sync.",
    };
  }

  return {
    intent: "turbo_help",
    action: "voice.help",
    automationHint: "voice.intent.detected",
    replyHe:
      "אפשר להגיד: כספים, ניקיון, תרגום צ׳אט, או הנהלת חשבונות — ואפעיל אוטומציה.",
    replyEn:
      "Try saying: finance, housekeeping, chat translation, or accounting.",
  };
}
