import { authGet, authPost } from "./core.js";

export type CompanyKnowledgeDocDto = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: string;
  readonly status: string;
  readonly createdAt: string;
};

export async function listCompanyKnowledgeDocs(
  status?: string,
): Promise<readonly CompanyKnowledgeDocDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const payload = (await authGet(`/v1/knowledge/company-docs${qs}`)) as {
    data: CompanyKnowledgeDocDto[];
  };
  return payload.data;
}

export async function createCompanyKnowledgeDoc(input: {
  readonly title: string;
  readonly body: string;
  readonly category: "brand" | "sop" | "policy" | "letter_template" | "other";
}): Promise<CompanyKnowledgeDocDto> {
  const payload = (await authPost("/v1/knowledge/company-docs", input)) as {
    data: CompanyKnowledgeDocDto;
  };
  return payload.data;
}

export async function approveCompanyKnowledgeDoc(
  id: string,
): Promise<CompanyKnowledgeDocDto> {
  const payload = (await authPost(
    `/v1/knowledge/company-docs/${id}/approve`,
    {},
  )) as { data: CompanyKnowledgeDocDto };
  return payload.data;
}

export type CompanyKnowledgeReindexDto = {
  readonly doc: CompanyKnowledgeDocDto;
  readonly chunkCount: number;
  readonly embedded: boolean;
  readonly chunksEmbedded: number;
};

export async function reindexCompanyKnowledgeDoc(
  id: string,
): Promise<CompanyKnowledgeReindexDto> {
  const payload = (await authPost(
    `/v1/knowledge/company-docs/${id}/reindex`,
    {},
  )) as { data: CompanyKnowledgeReindexDto };
  return payload.data;
}

export type CompanyKnowledgeChunkDto = {
  readonly id: string;
  readonly docId: string;
  readonly chunkIndex: number;
  readonly text: string;
  readonly hasEmbedding: boolean;
  readonly embeddedAt: string | null;
  readonly createdAt: string;
};

export async function listCompanyKnowledgeChunks(
  docId: string,
): Promise<readonly CompanyKnowledgeChunkDto[]> {
  const payload = (await authGet(
    `/v1/knowledge/company-docs/${docId}/chunks`,
  )) as { data: CompanyKnowledgeChunkDto[] };
  return payload.data;
}

export async function searchCompanyKnowledgeDocs(
  query: string,
): Promise<readonly CompanyKnowledgeDocDto[]> {
  const payload = (await authGet(
    `/v1/knowledge/company-docs/search?q=${encodeURIComponent(query)}`,
  )) as { data: CompanyKnowledgeDocDto[] };
  return payload.data;
}
