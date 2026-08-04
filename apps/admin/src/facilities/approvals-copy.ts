import type { ApprovalActDto } from "@hotelos/web-client";

export function actMessage(act: ApprovalActDto): string {
  if (act.status === "executed") return act.summaryHe;
  return act.reasonHe;
}

export function approvalStatusHe(status: string): string {
  if (status === "approved") return "אושר";
  if (status === "rejected") return "נדחה";
  return status;
}

export function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "—";
  return JSON.stringify(payload, null, 2);
}
