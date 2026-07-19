import { createHash } from "node:crypto";
import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  PersistedCompanyKnowledgeDoc,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

export function companyKnowledgeContentHash(
  title: string,
  body: string,
): string {
  return createHash("sha256").update(`${title}\n${body}`).digest("hex");
}

/**
 * Embed an approved company knowledge doc via AI Gateway (Vol. 5).
 * Never fails the approve path — returns false when embed is skipped/fails.
 */
export async function embedCompanyKnowledgeDoc(
  deps: {
    readonly companyKnowledge: CompanyKnowledgeRepository;
    readonly gateway: AiGateway;
  },
  input: {
    readonly tenantId: TenantId;
    readonly doc: PersistedCompanyKnowledgeDoc;
  },
): Promise<boolean> {
  if (input.doc.status !== "approved") return false;

  const contentHash = companyKnowledgeContentHash(
    input.doc.title,
    input.doc.body,
  );
  const existing = await deps.companyKnowledge.getEmbedding(
    input.tenantId,
    input.doc.id,
  );
  if (existing?.contentHash === contentHash) {
    return true;
  }

  try {
    const text = `${input.doc.title}\n${input.doc.body}`.slice(0, 8000);
    const result = await deps.gateway.embed([text]);
    const vector = result.vectors[0];
    if (!vector || vector.length === 0) return false;

    await deps.companyKnowledge.upsertEmbedding({
      docId: input.doc.id,
      tenantId: input.tenantId,
      model: result.model,
      embedding: vector,
      contentHash,
      embeddedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}
