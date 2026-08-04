import type { AiGateway } from "@hotelos/ai-gateway";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

/**
 * Embed chunk texts via AI Gateway (Vol. 5). Best-effort; skips already-embedded.
 * Returns how many chunks received a fresh or existing vector.
 */
export async function embedCompanyKnowledgeChunks(
  deps: {
    readonly companyKnowledge: CompanyKnowledgeRepository;
    readonly gateway: AiGateway;
  },
  input: {
    readonly tenantId: TenantId;
    readonly docId: string;
  },
): Promise<number> {
  const chunks = await deps.companyKnowledge.listChunksForDocs(
    input.tenantId,
    [input.docId],
  );
  if (chunks.length === 0) return 0;

  const pending = chunks.filter((chunk) => chunk.embedding === null);
  if (pending.length === 0) return chunks.length;

  try {
    const texts = pending.map((chunk) => chunk.text.slice(0, 8000));
    const result = await deps.gateway.embed(texts);
    const embeddedAt = new Date().toISOString();
    const updates: {
      readonly chunkId: string;
      readonly model: string;
      readonly embedding: readonly number[];
      readonly embeddedAt: string;
    }[] = [];

    for (let i = 0; i < pending.length; i++) {
      const chunk = pending[i];
      const vector = result.vectors[i];
      if (!chunk || !vector || vector.length === 0) continue;
      updates.push({
        chunkId: chunk.id,
        model: result.model,
        embedding: vector,
        embeddedAt,
      });
    }

    if (updates.length > 0) {
      await deps.companyKnowledge.upsertChunkEmbeddings({
        tenantId: input.tenantId,
        updates,
      });
    }

    return chunks.length - pending.length + updates.length;
  } catch {
    return chunks.length - pending.length;
  }
}
