import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  BriefingRepository,
  PersistedBriefingGoal,
  PersistedBriefingSummary,
} from "@hotelos/database";
import type { AgentId, BriefingRoomId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";

const MEETING_SECRETARY_AGENT_ID = "agent.meeting_secretary" as const;

export type ParsedMeetingSummary = {
  readonly summaryHe: string;
  readonly decisions: readonly string[];
  readonly goals: readonly {
    readonly title: string;
    readonly description: string;
  }[];
};

export type SynthesizeBriefingSummaryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly summary: PersistedBriefingSummary;
        readonly goals: readonly PersistedBriefingGoal[];
        readonly messageId: string;
      };
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function synthesizeBriefingSummary(
  agents: AgentRepository,
  briefing: BriefingRepository,
  gateway: AiGateway,
  input: {
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly actorUserId: UserId;
  },
): Promise<SynthesizeBriefingSummaryResult> {
  const detail = await briefing.getDetail(input.tenantId, input.roomId);
  if (!detail) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "חדר פגישה לא נמצא" },
    };
  }

  const agentId = Ids.agent(MEETING_SECRETARY_AGENT_ID);
  const agent = await agents.findById(agentId);
  const agentName = agent?.nameHe ?? "מזכירת פגישות";

  const contextPack = buildMeetingContextPack(detail);
  const ai = await gateway.invoke({
    agentId: MEETING_SECRETARY_AGENT_ID,
    message: "סיכום פגישה — הפק סיכום, החלטות ויעדים מהשיח.",
    tenantId: String(input.tenantId),
    userId: String(input.actorUserId),
    locale: "he",
    contextPack,
  });

  const parsed =
    parseMeetingSummaryFromAnswer(ai.answerHe) ??
    buildFallbackMeetingSummary(detail.room.title, detail.messages);

  const now = new Date().toISOString();
  const summaryId = randomUUID();
  const summary = await briefing.saveSummary({
    id: summaryId,
    tenantId: input.tenantId,
    roomId: input.roomId,
    summaryHe: parsed.summaryHe,
    decisions: parsed.decisions,
    goalsSnapshot: parsed.goals,
    generatedByAgentId: agentId,
    createdByUserId: input.actorUserId,
    createdAt: now,
  });
  if (!summary) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "חדר פגישה לא נמצא" },
    };
  }

  const createdGoals: PersistedBriefingGoal[] = [];
  for (const goal of parsed.goals) {
    const goalId = randomUUID();
    const created = await briefing.createGoal({
      id: goalId,
      tenantId: input.tenantId,
      roomId: input.roomId,
      title: goal.title,
      description: goal.description,
      ownerDisplayName: "לא הוקצה",
      source: "summary",
      createdAt: now,
    });
    if (created) {
      createdGoals.push(created);
    }
  }

  const messageBody = [
    `📋 ${agentName} — סיכום פגישה`,
    "",
    parsed.summaryHe,
    parsed.decisions.length > 0
      ? `\nהחלטות:\n${parsed.decisions.map((d) => `• ${d}`).join("\n")}`
      : "",
    parsed.goals.length > 0
      ? `\nיעדים:\n${parsed.goals.map((g) => `• ${g.title}`).join("\n")}`
      : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  const message = await briefing.addMessage({
    id: randomUUID(),
    tenantId: input.tenantId,
    roomId: input.roomId,
    speakerKind: "agent",
    speakerId: MEETING_SECRETARY_AGENT_ID,
    speakerName: agentName,
    body: messageBody,
    createdAt: now,
  });
  if (!message) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "חדר פגישה לא נמצא" },
    };
  }

  return {
    ok: true,
    value: {
      summary,
      goals: createdGoals,
      messageId: message.id,
    },
  };
}

function buildMeetingContextPack(
  detail: NonNullable<Awaited<ReturnType<BriefingRepository["getDetail"]>>>,
): string {
  const attendanceLines = detail.attendance
    .filter((row) => row.leftAt === null)
    .map(
      (row) =>
        `• ${row.displayName} (הצטרף ${row.joinedAt})${row.recordingConsent ? " · הסכים להקלטה" : ""}`,
    )
    .join("\n");

  const messageLines = detail.messages
    .map(
      (message) =>
        `[${message.createdAt}] ${message.speakerName} (${message.speakerKind}): ${message.body}`,
    )
    .join("\n");

  return [
    `חדר: ${detail.room.title}`,
    `סוג: ${detail.room.roomKind}`,
    `מטרה: ${detail.room.purpose}`,
    `סטטוס: ${detail.room.status}`,
    "",
    "נוכחות פעילה:",
    attendanceLines.length > 0 ? attendanceLines : "(אין)",
    "",
    "הודעות:",
    messageLines.length > 0 ? messageLines : "(אין הודעות)",
  ].join("\n");
}

export function parseMeetingSummaryFromAnswer(
  answerHe: string,
): ParsedMeetingSummary | null {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(answerHe);
  const raw = fenced?.[1]?.trim() ?? extractInlineJson(answerHe);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  if (!isMeetingSummaryPayload(parsed)) {
    return null;
  }

  const decisions = normalizeStringArray(parsed.decisions);
  const goals = normalizeGoals(parsed.goals);

  return {
    summaryHe: parsed.summaryHe.trim(),
    decisions,
    goals,
  };
}

function isMeetingSummaryPayload(
  value: object,
): value is {
  summaryHe: string;
  decisions?: unknown;
  goals?: unknown;
} {
  return "summaryHe" in value && typeof value.summaryHe === "string";
}

function extractInlineJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeGoals(
  value: unknown,
): readonly { readonly title: string; readonly description: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const goals: { title: string; description: string }[] = [];
  for (const item of value) {
    if (!isGoalPayload(item)) {
      continue;
    }
    goals.push({
      title: item.title.trim(),
      description:
        typeof item.description === "string" ? item.description.trim() : "",
    });
  }
  return goals;
}

function isGoalPayload(
  value: unknown,
): value is { title: string; description?: string } {
  if (typeof value !== "object" || value === null || !("title" in value)) {
    return false;
  }
  const title = Reflect.get(value, "title");
  return typeof title === "string";
}

export function buildFallbackMeetingSummary(
  roomTitle: string,
  messages: readonly {
    readonly speakerName: string;
    readonly body: string;
  }[],
): ParsedMeetingSummary {
  const humanLines = messages
    .filter((message) => message.body.trim().length > 0)
    .map((message) => `${message.speakerName}: ${message.body.trim()}`);

  const decisions = humanLines
    .flatMap((line) => line.split("\n"))
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 8);

  const summaryHe =
    humanLines.length > 0
      ? `סיכום פגישה «${roomTitle}» — ${humanLines.length} הודעות בשיח.`
      : `סיכום פגישה «${roomTitle}» — לא נרשמו הודעות בשיח.`;

  return {
    summaryHe,
    decisions,
    goals: [],
  };
}
