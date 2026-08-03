import type { AiGateway } from "@hotelos/ai-gateway";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { buildAccountingContextPack } from "./build-accounting-context-pack.js";
import {
  buildCfoFinanceBrief,
  formatCfoFinanceBriefPack,
  type CfoFinanceBrief,
  type CfoFinanceBriefDeps,
} from "./build-cfo-finance-brief.js";
import { buildKnowledgeContextPack } from "./build-knowledge-context-pack.js";
import { buildTrustedSourcesContextPack } from "./build-trusted-sources-context-pack.js";
import { mergeContextPacks } from "./merge-context-packs.js";
import { extractSuggestedActions } from "./synthesize-cio-digest.js";

export type SynthesizeCfoFinanceBriefResult = {
  readonly brief: CfoFinanceBrief;
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly provider: string;
  readonly confidence: string;
  readonly latencyMs: number;
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
};

/**
 * Smart finance doctor: deterministic brief + agent.cfo Gateway synthesis.
 * Never executes money moves; Suggest → Approve → Act only.
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
  },
): Promise<SynthesizeCfoFinanceBriefResult | null> {
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
    input.questionHe?.trim() ||
    [
      "אתה דוקטור לכלכלה / יועץ כספים חכם למלון (agent.cfo).",
      "סכם בעברית (עד 10 משפטים) את מצב הכספים וההזדמנויות לצמיחה היום,",
      "בהתבסס רק על ה־context packs (ספר פנימי + Trusted + snapshots).",
      "נתח חוזים/התחייבויות רק אם מופיעים במקורות Company Knowledge.",
      'בסוף הוסף סעיף בשורה נפרדת בדיוק: "המלצות להיום:" ואחריו 3–6 נקודות קצרות.',
      "אל תבצע העברה/סגירת ספרים. ציין במפורש כשנדרש אישור אדם (סף ₪2,000).",
    ].join("\n");

  const searchBlob = `${brief.headlineHe}\n${briefPack}\n${question}\nכלכלה בורסה מס IFRS תזרים חוזה`;
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
    agentId: "agent.cfo",
    message: question,
    tenantId: input.tenantId,
    userId: input.userId,
    locale: "he",
    contextPack,
  });

  return {
    brief,
    narrativeHe: ai.answerHe,
    suggestedActionsHe: extractSuggestedActions(ai.answerHe),
    provider: ai.provider,
    confidence: ai.confidence,
    latencyMs: ai.latencyMs,
    requiresHumanApproval: ai.requiresHumanApproval,
    approvalReasonHe: ai.approvalReasonHe ?? null,
  };
}
