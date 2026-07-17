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
  void input.actorUserId;
  const body = buildAgentBriefing(agent.id, agent.nameHe, chain, input.prompt);

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
    },
  };
}

function buildAgentBriefing(
  agentId: string,
  agentName: string,
  chain: Awaited<ReturnType<OverviewRepository["getChainOverview"]>>,
  prompt: string | undefined,
): string {
  const promptLine =
    prompt && prompt.trim().length > 0
      ? `שאלה מהוועדה: ${prompt.trim()}\n\n`
      : "";

  if (!chain) {
    return `${promptLine}${agentName}: אין עדיין נתוני רשת זמינים לתדריך.`;
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

  if (String(agentId) === "agent.cfo") {
    return (
      `${promptLine}תדריך כספים / תפעול־פיננסי (Suggest):\n` +
      `רשת ${chain.tenantName} · ${chain.hotelCount} מלונות · תפוסת רשת ${chainOcc}% · הזמנות פעילות ${totals.active}.\n` +
      `${hotelLines}\n\n` +
      `המלצה: לבחון פער תפוסה בין נכסים ועלות הזדמנות בחדרים dirty/maintenance לפני אישור הוצאות חדשות. ` +
      `מצב אוטונומיה: Suggest → Approve לפני פעולה כספית.`
    );
  }

  if (String(agentId) === "agent.revenue") {
    return (
      `${promptLine}תדריך הכנסות:\n` +
      `תפוסת רשת ${chainOcc}% על ${totals.rooms} חדרים. ` +
      `מומלץ לבדוק תמחור דינמי בנכס עם תפוסה נמוכה יחסית.\n${hotelLines}`
    );
  }

  if (String(agentId) === "agent.analytics") {
    return (
      `${promptLine}תדריך אנליטיקה:\n` +
      `מדדי רשת חיים — תפוסה ${chainOcc}%, dirty ${totals.dirty}, הזמנות פעילות ${totals.active}.\n${hotelLines}`
    );
  }

  if (String(agentId) === "agent.ceo") {
    return (
      `${promptLine}תדריך הנהלה:\n` +
      `${chain.tenantName}: ${chain.hotelCount} נכסים תחת בקרה. ` +
      `נקודות תשומת לב — חדרים לניקיון ${totals.dirty}, תפוסה ${chainOcc}%.\n${hotelLines}`
    );
  }

  return (
    `${promptLine}${agentName} בחדר הבריפינג:\n` +
    `יש לי גישה לנתוני הרשת (${chain.hotelCount} מלונות, תפוסה ${chainOcc}%). ` +
    `אפשר לשתף אותי בוועדות נוספות או לבקש תדריך ממוקד לפי הדומיין שלי.\n${hotelLines}`
  );
}
