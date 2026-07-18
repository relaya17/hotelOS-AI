import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  BriefingRepository,
  OverviewRepository,
} from "@hotelos/database";
import type { AgentId, BriefingRoomId, TenantId, UserId } from "@hotelos/shared";
import { randomUUID } from "node:crypto";

export type ConsultBriefingAgentResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly id: string;
        readonly speakerKind: "agent";
        readonly speakerId: string;
        readonly speakerName: string;
        readonly body: string;
        readonly createdAt: string;
        readonly requiresHumanApproval: boolean;
        readonly approvalReasonHe?: string;
      };
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function consultBriefingAgent(
  agents: AgentRepository,
  briefing: BriefingRepository,
  overview: OverviewRepository,
  gateway: AiGateway,
  input: {
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly agentId: AgentId;
    readonly actorUserId: UserId;
    readonly prompt?: string;
  },
): Promise<ConsultBriefingAgentResult> {
  const detail = await briefing.getDetail(input.tenantId, input.roomId);
  if (!detail) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "Briefing room not found" },
    };
  }

  const shared = detail.sharedAgents.find(
    (item) => item.agentId === input.agentId,
  );
  if (!shared) {
    return {
      ok: false,
      error: {
        code: "AGENT_NOT_SHARED",
        message: "Share the agent into this room before consulting",
      },
    };
  }

  const agent = await agents.findById(input.agentId);
  if (!agent) {
    return {
      ok: false,
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    };
  }

  const chain = await overview.getChainOverview(input.tenantId);
  const contextPack = buildContextPack(agent.nameHe, chain);
  const messageText =
    input.prompt && input.prompt.trim().length > 0
      ? input.prompt.trim()
      : `תן תדריך קצר לוועדת הבריפינג בתחום ${agent.nameHe}.`;

  const ai = await gateway.invoke({
    agentId: String(agent.id),
    message: messageText,
    tenantId: String(input.tenantId),
    userId: String(input.actorUserId),
    locale: "he",
    contextPack,
  });

  const approvalNote = ai.requiresHumanApproval
    ? `\n\n⚠ דורש אישור אנושי${ai.approvalReasonHe ? `: ${ai.approvalReasonHe}` : "."}`
    : "";
  const body = `${ai.answerHe}${approvalNote}`;

  const message = await briefing.addMessage({
    id: randomUUID(),
    tenantId: input.tenantId,
    roomId: input.roomId,
    speakerKind: "agent",
    speakerId: agent.id,
    speakerName: agent.nameHe,
    body,
    createdAt: new Date().toISOString(),
  });

  if (!message) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "Briefing room not found" },
    };
  }

  return {
    ok: true,
    value: {
      id: message.id,
      speakerKind: "agent",
      speakerId: message.speakerId,
      speakerName: message.speakerName,
      body: message.body,
      createdAt: message.createdAt,
      requiresHumanApproval: ai.requiresHumanApproval,
      ...(ai.approvalReasonHe !== undefined
        ? { approvalReasonHe: ai.approvalReasonHe }
        : {}),
    },
  };
}

function buildContextPack(
  agentName: string,
  chain: Awaited<ReturnType<OverviewRepository["getChainOverview"]>>,
): string {
  if (!chain) {
    return `Agent ${agentName}: אין עדיין נתוני רשת זמינים לתדריך.`;
  }

  const hotelLines = chain.hotels
    .map((hotel) => {
      const occ =
        hotel.rooms.total === 0
          ? 0
          : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);
      return `• ${hotel.name}: תפוסה ${occ}% · פעילים ${hotel.bookings.active} · dirty ${hotel.rooms.dirty} · תחזוקה ${hotel.rooms.maintenance}`;
    })
    .join("\n");

  const totals = chain.hotels.reduce(
    (acc, hotel) => ({
      rooms: acc.rooms + hotel.rooms.total,
      occupied: acc.occupied + hotel.rooms.occupied,
      dirty: acc.dirty + hotel.rooms.dirty,
      active: acc.active + hotel.bookings.active,
    }),
    { rooms: 0, occupied: 0, dirty: 0, active: 0 },
  );

  const chainOcc =
    totals.rooms === 0
      ? 0
      : Math.round((totals.occupied / totals.rooms) * 100);

  return [
    `רשת: ${chain.tenantName}`,
    `מלונות: ${chain.hotelCount}`,
    `תפוסת רשת: ${chainOcc}%`,
    `חדרים: ${totals.rooms} · תפוסים: ${totals.occupied} · dirty: ${totals.dirty}`,
    `הזמנות פעילות: ${totals.active}`,
    "פירוט נכסים:",
    hotelLines,
  ].join("\n");
}
