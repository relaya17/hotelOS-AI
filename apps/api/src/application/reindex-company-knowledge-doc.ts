import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  PersistedCompanyKnowledgeDoc,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";
import { chunkCompanyKnowledgeDoc } from "./chunk-company-knowledge-doc.js";
import { embedCompanyKnowledgeDoc } from "./embed-company-knowledge-doc.js";

export type ReindexCompanyKnowledgeResult = {
  readonly doc: PersistedCompanyKnowledgeDoc;
  readonly chunkCount: number;
  readonly embedded: boolean;
};

/**
 * Re-run embed + chunk for an already-approved company knowledge doc.
 * Used for historical docs approved before chunking / for manual refresh.
 */
export async function reindexCompanyKnowledgeDoc(
  deps: {
    readonly companyKnowledge: CompanyKnowledgeRepository;
    readonly gateway: AiGateway;
  },
  input: {
    readonly tenantId: TenantId;
    readonly docId: string;
  },
): Promise<ReindexCompanyKnowledgeResult | undefined> {
  const doc = await deps.companyKnowledge.getById(
    input.tenantId,
    input.docId,
  );
  if (!doc || doc.status !== "approved") {
    return undefined;
  }

  const embedded = await embedCompanyKnowledgeDoc(
    {
      companyKnowledge: deps.companyKnowledge,
      gateway: deps.gateway,
    },
    { tenantId: input.tenantId, doc },
  );

  const chunkCount = await chunkCompanyKnowledgeDoc(deps.companyKnowledge, {
    tenantId: input.tenantId,
    docId: doc.id,
    title: doc.title,
    body: doc.body,
  });

  return {
    doc,
    chunkCount,
    embedded,
  };
}
