import type {
  KashrutStatus,
  PersistedApprovalRequest,
  PersistedKashrutAnnotation,
} from "@hotelos/database";

export type KashrutProcurementGateResult = {
  readonly approvalId: string;
  readonly applies: boolean;
  readonly foodRelated: boolean;
  readonly kashrutEnabled: boolean;
  readonly latestStatus: KashrutStatus | null;
  readonly latestMessageHe: string | null;
  readonly canApprove: boolean;
  readonly requiresAck: boolean;
  readonly requiresOverrideBlock: boolean;
  readonly gateHe: string;
};

const FOOD_PATTERN =
  /מזון|אוכל|בשר|חלב|יין|לחם|פירות|ירקות|קפה|סוכר|שמן|food|meat|dairy|kosher|כשר|f&b|משקאות|משקה|חטיף|קינוח/i;

/**
 * Volume 11 / kashrut-agent: food procurement must not Act without kashrutStatus.
 * Deterministic gate — annotations come from משגיח / human (or agent.kashrut UI).
 */
export function detectFoodRelatedProcurement(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (payload["foodRelated"] === true) return true;
  if (payload["kind"] !== "autonomy.procurement_draft") return false;
  const notes = typeof payload["notes"] === "string" ? payload["notes"] : "";
  if (FOOD_PATTERN.test(notes)) return true;
  const items = payload["items"];
  if (!Array.isArray(items)) return false;
  for (const item of items) {
    if (!isRecord(item)) continue;
    const description =
      typeof item["description"] === "string" ? item["description"] : "";
    const category =
      typeof item["category"] === "string" ? item["category"] : "";
    if (category === "food" || FOOD_PATTERN.test(description)) return true;
  }
  return false;
}

export function evaluateKashrutProcurementGate(input: {
  readonly approval: PersistedApprovalRequest;
  readonly kashrutEnabled: boolean;
  readonly annotations: readonly PersistedKashrutAnnotation[];
}): KashrutProcurementGateResult {
  const foodRelated = detectFoodRelatedProcurement(
    parseJson(input.approval.payloadJson),
  );
  const applies = input.kashrutEnabled && foodRelated;

  if (!applies) {
    return {
      approvalId: input.approval.id,
      applies: false,
      foodRelated,
      kashrutEnabled: input.kashrutEnabled,
      latestStatus: null,
      latestMessageHe: null,
      canApprove: true,
      requiresAck: false,
      requiresOverrideBlock: false,
      gateHe: !input.kashrutEnabled
        ? "כשרות כבויה במלון — שער Kashrut לא חל."
        : "רכש לא מזוהה כמזון/F&B — שער Kashrut לא חל.",
    };
  }

  const latest = input.annotations[0] ?? null;
  const latestStatus = latest?.status ?? null;

  if (latestStatus === "block") {
    return {
      approvalId: input.approval.id,
      applies: true,
      foodRelated,
      kashrutEnabled: input.kashrutEnabled,
      latestStatus,
      latestMessageHe: latest?.message ?? null,
      canApprove: false,
      requiresAck: false,
      requiresOverrideBlock: true,
      gateHe:
        "agent.kashrut סימן block — אסור לאשר טיוטת רכש בלי דריסת משגיח מפורשת.",
    };
  }

  if (latestStatus === "ok") {
    return {
      approvalId: input.approval.id,
      applies: true,
      foodRelated,
      kashrutEnabled: input.kashrutEnabled,
      latestStatus,
      latestMessageHe: latest?.message ?? null,
      canApprove: true,
      requiresAck: false,
      requiresOverrideBlock: false,
      gateHe: "יש הערת כשרות ok — ניתן לאשר.",
    };
  }

  if (latestStatus === "note" || latestStatus === "warn") {
    return {
      approvalId: input.approval.id,
      applies: true,
      foodRelated,
      kashrutEnabled: input.kashrutEnabled,
      latestStatus,
      latestMessageHe: latest?.message ?? null,
      canApprove: true,
      requiresAck: true,
      requiresOverrideBlock: false,
      gateHe: `יש הערת כשרות ${latestStatus} — נדרש אישור אנושי מודע לפני Act.`,
    };
  }

  return {
    approvalId: input.approval.id,
    applies: true,
    foodRelated,
    kashrutEnabled: input.kashrutEnabled,
    latestStatus: null,
    latestMessageHe: null,
    canApprove: true,
    requiresAck: true,
    requiresOverrideBlock: false,
    gateHe:
      "רכש מזון במלון כשר — חובה הערת Kashrut או אישור מודע לפני יצירת טיוטת PO.",
  };
}

export function kashrutGateAllowsApprove(
  gate: KashrutProcurementGateResult,
  options: {
    readonly kashrutAcknowledged?: boolean;
    readonly kashrutOverrideBlock?: boolean;
  },
): { readonly ok: true } | { readonly ok: false; readonly reasonHe: string } {
  if (!gate.applies) return { ok: true };
  if (gate.requiresOverrideBlock) {
    if (options.kashrutOverrideBlock === true) return { ok: true };
    return {
      ok: false,
      reasonHe: gate.gateHe,
    };
  }
  if (gate.requiresAck && options.kashrutAcknowledged !== true) {
    return {
      ok: false,
      reasonHe: gate.gateHe,
    };
  }
  return { ok: true };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
