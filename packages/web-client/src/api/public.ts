import { getApiBase, parseJson, toErrorMessage } from "./core.js";

export type LegalDocSummary = {
  readonly id: string;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly version: string;
  readonly updatedAt: string;
};

export type LegalDocDetail = LegalDocSummary & {
  readonly sections: readonly { readonly heading: string; readonly body: string }[];
};

export type PublicHealthDto = {
  readonly status: string;
  readonly service: string;
  readonly version: string;
  readonly recordings?: {
    readonly backend: string;
    readonly root: string;
  };
};

export async function fetchPublicHealth(): Promise<PublicHealthDto> {
  const response = await fetch(`${getApiBase()}/v1/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return (await response.json()) as PublicHealthDto;
}

export type PaymentPublicStatusDto = {
  readonly provider: "demo" | "stripe_stub" | "external";
  readonly mode: "demo" | "stub" | "external";
  readonly storesPan: false;
  readonly pciDssCertified: false;
  readonly labelHe: string;
  readonly labelEn: string;
};

export async function fetchPaymentPublicStatus(): Promise<PaymentPublicStatusDto> {
  const response = await fetch(`${getApiBase()}/v1/public/payments/status`);
  if (!response.ok) {
    throw new Error(`Payment status failed (${response.status})`);
  }
  const payload = (await response.json()) as { data: PaymentPublicStatusDto };
  return payload.data;
}

export async function fetchLegalIndex(): Promise<readonly LegalDocSummary[]> {
  const response = await fetch(`${getApiBase()}/v1/public/legal`);
  const payload = (await parseJson(response)) as { data: LegalDocSummary[] };
  if (!response.ok) throw new Error("Failed to load legal index");
  return payload.data;
}

export async function fetchLegalDocument(id: string): Promise<LegalDocDetail> {
  const response = await fetch(`${getApiBase()}/v1/public/legal/${id}`);
  const payload = (await parseJson(response)) as { data: LegalDocDetail };
  if (!response.ok) throw new Error("Failed to load legal document");
  return payload.data;
}

export async function saveCookieConsent(input: {
  subjectKey: string;
  necessary: boolean;
  functional: boolean;
  tenantId?: string;
}): Promise<void> {
  const response = await fetch(`${getApiBase()}/v1/trust/cookies/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to save cookie consent");
}

export type SubmitLeadInput = {
  readonly name: string;
  readonly hotelOrChain: string;
  readonly email: string;
  readonly note?: string;
  readonly source?: string;
};

export type SubmitLeadResult = {
  readonly id: string;
  readonly createdAt: string;
};

/** Anonymous marketing lead from www (POST /v1/leads). */
export async function submitLead(
  input: SubmitLeadInput,
): Promise<SubmitLeadResult> {
  const response = await fetch(`${getApiBase()}/v1/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      hotelOrChain: input.hotelOrChain,
      email: input.email,
      ...(input.note !== undefined && input.note.trim().length > 0
        ? { note: input.note.trim() }
        : {}),
      source: input.source ?? "www_contact",
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to submit lead"));
  }
  const data = (payload as { data: SubmitLeadResult }).data;
  return data;
}
