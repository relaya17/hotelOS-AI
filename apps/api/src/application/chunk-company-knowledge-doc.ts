import { createHash, randomUUID } from "node:crypto";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { splitKnowledgeBodyIntoChunks } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";
import { companyKnowledgeContentHash } from "./embed-company-knowledge-doc.js";

/**
 * Persist text chunks for an approved doc (keyword pack snippets).
 * Deterministic when content is unchanged — skips rewrite if hashes match.
 */
export async function chunkCompanyKnowledgeDoc(
  companyKnowledge: CompanyKnowledgeRepository,
  input: {
    readonly tenantId: TenantId;
    readonly docId: string;
    readonly title: string;
    readonly body: string;
  },
): Promise<number> {
  const pieces = splitKnowledgeBodyIntoChunks(input.body);
  const createdAt = new Date().toISOString();
  const docHash = companyKnowledgeContentHash(input.title, input.body);

  const existing = await companyKnowledge.listChunksForDocs(input.tenantId, [
    input.docId,
  ]);
  if (
    existing.length === pieces.length &&
    existing.every((chunk, index) => {
      const piece = pieces[index];
      return (
        piece !== undefined &&
        chunk.contentHash ===
          createHash("sha256").update(`${docHash}:${index}:${piece}`).digest("hex")
      );
    })
  ) {
    return existing.length;
  }

  await companyKnowledge.replaceChunks({
    docId: input.docId,
    tenantId: input.tenantId,
    createdAt,
    chunks: pieces.map((text, chunkIndex) => ({
      id: randomUUID(),
      chunkIndex,
      text,
      contentHash: createHash("sha256")
        .update(`${docHash}:${chunkIndex}:${text}`)
        .digest("hex"),
    })),
  });
  return pieces.length;
}
