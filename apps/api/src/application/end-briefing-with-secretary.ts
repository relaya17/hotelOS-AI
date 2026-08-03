import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  BriefingRepository,
  PersistedBriefingGoal,
  PersistedBriefingSummary,
} from "@hotelos/database";
import type { BriefingRoomId, TenantId, UserId } from "@hotelos/shared";
import { synthesizeBriefingSummary } from "./synthesize-briefing-summary.js";

export type EndBriefingWithSecretaryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly roomId: BriefingRoomId;
        readonly status: "ended";
        readonly summary: PersistedBriefingSummary;
        readonly goals: readonly PersistedBriefingGoal[];
        readonly idempotent: boolean;
      };
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function endBriefingWithSecretary(
  agents: AgentRepository,
  briefing: BriefingRepository,
  gateway: AiGateway,
  input: {
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly actorUserId: UserId;
  },
): Promise<EndBriefingWithSecretaryResult> {
  const existingSummary = await briefing.getLatestSummary(
    input.tenantId,
    input.roomId,
  );

  const room = await briefing.setStatus(
    input.tenantId,
    input.roomId,
    "ended",
  );
  if (!room) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "חדר פגישה לא נמצא" },
    };
  }

  if (existingSummary) {
    const goals = await briefing.listGoals(input.tenantId, input.roomId);
    return {
      ok: true,
      value: {
        roomId: input.roomId,
        status: "ended",
        summary: existingSummary,
        goals,
        idempotent: true,
      },
    };
  }

  const synthesized = await synthesizeBriefingSummary(
    agents,
    briefing,
    gateway,
    input,
  );
  if (!synthesized.ok) {
    return synthesized;
  }

  const goals = await briefing.listGoals(input.tenantId, input.roomId);
  return {
    ok: true,
    value: {
      roomId: input.roomId,
      status: "ended",
      summary: synthesized.value.summary,
      goals,
      idempotent: false,
    },
  };
}
