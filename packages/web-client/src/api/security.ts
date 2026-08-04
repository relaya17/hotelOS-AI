import { authPost } from "./core.js";

export async function postSecurityEvent(input: {
  readonly hotelId: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly source?: string;
}): Promise<unknown> {
  return authPost("/v1/ops/security-events", input);
}

/** Vendor webhook ingest — auth'd ops path; public VMS uses `/v1/public/security/ingest/:provider`. */
export async function postSecurityWebhookIngest(
  provider: "generic" | "example_vms" | "milestone" | "genetec",
  body: unknown,
): Promise<unknown> {
  return authPost(
    `/v1/ops/security-events/ingest/${encodeURIComponent(provider)}`,
    body,
  );
}

export async function postErrorEvent(input: {
  readonly hotelId?: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly source?: string;
  readonly app?: string;
}): Promise<unknown> {
  return authPost("/v1/ops/error-events", input);
}
