import type { AiGateway } from "@hotelos/ai-gateway";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { buildAccountingContextPack } from "./build-accounting-context-pack.js";
import {
  buildCfoFinanceBrief,
  FINANCE_DOCTOR_AUDIENCE_LABELS_HE,
  FINANCE_DOCTOR_FOCUS_LABELS_HE,
  formatCfoFinanceBriefPack,
  type CfoFinanceBrief,
  type CfoFinanceBriefDeps,
  type FinanceDoctorAudience,
  type FinanceDoctorFocus,
} from "./build-cfo-finance-brief.js";
import { buildKnowledgeContextPack } from "./build-knowledge-context-pack.js";
import { buildTrustedSourcesContextPack } from "./build-trusted-sources-context-pack.js";
import { mergeContextPacks } from "./merge-context-packs.js";
import { extractSuggestedActions } from "./synthesize-cio-digest.js";

export type SynthesizeCfoFinanceBriefResult = {
  readonly brief: CfoFinanceBrief;
  readonly audience: FinanceDoctorAudience;
  readonly focus: FinanceDoctorFocus;
  readonly agentId: string;
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly provider: string;
  readonly confidence: string;
  readonly latencyMs: number;
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
};

function resolveAgentId(focus: FinanceDoctorFocus): string {
  switch (focus) {
    case "procurement":
      return "agent.procurement";
    case "marketing":
      return "agent.marketing";
    case "investment":
    case "finance":
    case "all":
    default:
      return "agent.cfo";
  }
}

function buildDefaultQuestion(
  audience: FinanceDoctorAudience,
  focus: FinanceDoctorFocus,
): string {
  const audienceLabel = FINANCE_DOCTOR_AUDIENCE_LABELS_HE[audience];
  const focusLabel = FINANCE_DOCTOR_FOCUS_LABELS_HE[focus];
  const audienceLens =
    audience === "owner"
      ? "הדגש סיכון/הזדמנות אסטרטגית ותזרים לרמת בעלים."
      : audience === "ceo"
        ? "הדגש החלטות תפעוליות-אסטרטגיות למנכ״ל (סדרי עדיפויות להיום/שבוע)."
        : audience === "gm"
          ? "הדגש ניהול נכון של המלון: תעדוף יומי, שירות אורחים, רכש ושיווק מקומי."
          : audience === "procurement"
            ? "הדגש קניין/רכש נכון: מלאי, ספקים, תזמון קניות וחיסכון."
            : "הדגש תזרים, ROI, ספי אישור וחריגות תקציב ל־CFO.";

  const focusLens =
    focus === "procurement"
      ? "התמקד בקניות/רכש/קניין: מה לקנות עכשיו, מה לדחות, איפה לחסוך, מלאי נמוך."
      : focus === "marketing"
        ? "התמקד בפרסום ושיווק: קמפיינים, מבצעים, win-back לפי זיכרון אורחים — ללא שליחה המונית בלי אישור."
        : focus === "investment"
          ? "התמקד באוריינות השקעות/מקרו לבעלי מלון (חינוכי בלבד) ממקורות Trusted. אסור להמליץ על קנייה/מכירה ספציפית של נייר ערך; אין ביצוע מסחר. ציין שזה אינו ייעוץ השקעות מורשה."
          : focus === "finance"
            ? "התמקד בתזרים, ספר חשבונות, חריגות וסגירת חודש (טיוטה בלבד)."
            : "כסה יחד: כספים + קניות/קניין + פרסום/שיווק + זיכרון אורחים — 2–3 נקודות לכל תחום.";

  return [
    `אתה יועץ הנהלה חכם למלון. קהל היעד: ${audienceLabel}. מיקוד: ${focusLabel}.`,
    audienceLens,
    focusLens,
    "כתוב בעברית (עד 12 משפטים) בהתבסס רק על ה־context packs.",
    "עזור לניהול נכון: ייעול רכש, שיפור תזרים, שיווק מדיד, ושימוש בזיכרון אורחים בכבוד ובחוקיות.",
    "נתח חוזים/התחייבויות רק אם מופיעים ב־Company Knowledge.",
    'בסוף הוסף סעיף בשורה נפרדת בדיוק: "המלצות להיום:" ואחריו 4–7 נקודות קצרות.',
    "אל תבצע העברה/סגירת ספרים/שליחת קמפיין/מסחר בבורסה. ציין במפורש כשנדרש אישור אדם (סף ₪2,000 / הנחה>5%).",
  ].join("\n");
}

/**
 * Smart executive advisor: deterministic brief + Gateway synthesis.
 * Routes focus to agent.cfo / agent.procurement / agent.marketing.
 */
export async function synthesizeCfoFinanceBrief(
  deps: CfoFinanceBriefDeps & {
    readonly gateway: AiGateway;
    readonly companyKnowledge: CompanyKnowledgeRepository;
  },
  input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly hotelIds: readonly HotelId[];
    readonly questionHe?: string;
    readonly audience?: FinanceDoctorAudience;
    readonly focus?: FinanceDoctorFocus;
  },
): Promise<SynthesizeCfoFinanceBriefResult | null> {
  const audience = input.audience ?? "cfo";
  const focus = input.focus ?? "all";
  const agentId = resolveAgentId(focus);

  const brief = await buildCfoFinanceBrief(
    deps,
    input.tenantId,
    input.hotelIds,
  );
  if (!brief) return null;

  const briefPack = formatCfoFinanceBriefPack(brief);
  const accountingPack = await buildAccountingContextPack(
    deps.turbo,
    input.tenantId,
  );

  const question =
    input.questionHe?.trim() || buildDefaultQuestion(audience, focus);

  const searchBlob = [
    brief.headlineHe,
    briefPack,
    question,
    "כלכלה רכש קניין קניות שיווק פרסום קמפיין תפוסה תזרים מס IFRS חוזה ROI בורסה השקעה אורח",
  ].join("\n");

  const [knowledgePack, trustedPack] = await Promise.all([
    buildKnowledgeContextPack(
      deps.companyKnowledge,
      input.tenantId,
      searchBlob,
      deps.gateway,
    ),
    buildTrustedSourcesContextPack(
      deps.trustedSources,
      input.tenantId,
      searchBlob,
    ),
  ]);

  const contextPack =
    mergeContextPacks(
      briefPack,
      accountingPack,
      knowledgePack,
      trustedPack,
    ) ?? briefPack;

  const ai = await deps.gateway.invoke({
    agentId,
    message: question,
    tenantId: input.tenantId,
    userId: input.userId,
    locale: "he",
    contextPack,
  });

  return {
    brief,
    audience,
    focus,
    agentId,
    narrativeHe: ai.answerHe,
    suggestedActionsHe: extractSuggestedActions(ai.answerHe),
    provider: ai.provider,
    confidence: ai.confidence,
    latencyMs: ai.latencyMs,
    requiresHumanApproval: ai.requiresHumanApproval,
    approvalReasonHe: ai.approvalReasonHe ?? null,
  };
}
