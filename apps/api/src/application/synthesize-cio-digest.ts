import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { buildKnowledgeContextPack } from "./build-knowledge-context-pack.js";
import { buildTrustedSourcesContextPack } from "./build-trusted-sources-context-pack.js";
import { mergeContextPacks } from "./merge-context-packs.js";
import {
  buildCioDigest,
  type CioDigest,
  type CioDigestDeps,
  type CioRole,
} from "./build-cio-digest.js";

export type SynthesizeCioDigestResult = {
  readonly digest: CioDigest;
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly provider: string;
  readonly confidence: string;
  readonly latencyMs: number;
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
};

/**
 * Smart daily digest: deterministic ops facts + Gateway narrative for the role.
 * AI only via Gateway; never executes money/policy changes.
 */
export async function synthesizeCioDigest(
  deps: CioDigestDeps & {
    readonly gateway: AiGateway;
    readonly companyKnowledge: CompanyKnowledgeRepository;
    readonly trustedSources: TrustedSourcesRepository;
  },
  input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly hotelIds: readonly HotelId[];
    readonly role: CioRole;
  },
): Promise<SynthesizeCioDigestResult | null> {
  const digest = await buildCioDigest(
    deps,
    input.tenantId,
    input.hotelIds,
    input.role,
  );
  if (!digest) return null;

  const digestPack = formatDigestContextPack(digest);
  const userMessage = [
    `סכם תדריך יומי לתפקיד: ${digest.roleLabelHe} (${digest.role}).`,
    "כתוב בעברית קצרה (עד 8 משפטים) מה חשוב לדעת היום.",
    'בסוף הוסף סעיף בשורה נפרדת בדיוק: "המלצות להיום:" ואחריו 3–5 נקודות קצרות.',
    "אל תבצע שינוי כספי/מדיניות. אם נדרש אישור אדם — ציין זאת במפורש.",
  ].join("\n");
  const searchBlob = `${digest.headlineHe}\n${digestPack}`;
  const [knowledgePack, trustedPack] = await Promise.all([
    buildKnowledgeContextPack(
      deps.companyKnowledge,
      input.tenantId,
      searchBlob,
    ),
    buildTrustedSourcesContextPack(
      deps.trustedSources,
      input.tenantId,
      searchBlob,
    ),
  ]);
  const contextPack =
    mergeContextPacks(digestPack, knowledgePack, trustedPack) ?? digestPack;

  const ai = await deps.gateway.invoke({
    agentId: "agent.cio",
    message: userMessage,
    tenantId: input.tenantId,
    userId: input.userId,
    locale: "he",
    contextPack,
  });

  return {
    digest,
    narrativeHe: ai.answerHe,
    suggestedActionsHe: extractSuggestedActions(ai.answerHe),
    provider: ai.provider,
    confidence: ai.confidence,
    latencyMs: ai.latencyMs,
    requiresHumanApproval: ai.requiresHumanApproval,
    approvalReasonHe: ai.approvalReasonHe ?? null,
  };
}

export function formatDigestContextPack(digest: CioDigest): string {
  const lines = [
    `תפקיד: ${digest.roleLabelHe}`,
    `רשת/דייר: ${digest.tenantName}`,
    digest.headlineHe,
    "",
  ];
  for (const section of digest.sections) {
    lines.push(`## ${section.hotelName}`);
    for (const bullet of section.bulletsHe) {
      lines.push(`• ${bullet}`);
    }
    if (section.kashrutNoteHe) {
      lines.push(`כשרות: ${section.kashrutNoteHe}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function extractSuggestedActions(narrativeHe: string): readonly string[] {
  const match = /המלצות להיום\s*:/i.exec(narrativeHe);
  if (!match || match.index === undefined) {
    return [];
  }
  const tail = narrativeHe.slice(match.index + match[0].length);
  return tail
    .split("\n")
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter((line) => line.length > 2 && !/^המלצות/i.test(line))
    .slice(0, 8);
}
