import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AiGateway, AiGatewayResponse } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  BriefingRepository,
  BriefingRoomDetail,
  PersistedBriefingGoal,
  PersistedBriefingSummary,
} from "@hotelos/database";
import type { AgentId, BriefingRoomId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import {
  buildFallbackMeetingSummary,
  parseMeetingSummaryFromAnswer,
  synthesizeBriefingSummary,
} from "./synthesize-briefing-summary.js";

const tenantId = Ids.tenant("11111111-1111-4111-8111-111111111111");
const roomId = Ids.briefingRoom("22222222-2222-4222-8222-222222222222");
const userId = Ids.user("33333333-3333-4333-8333-333333333333");

function baseDetail(): BriefingRoomDetail {
  return {
    room: {
      id: roomId,
      tenantId,
      chainId: Ids.chain("44444444-4444-4444-8444-444444444444"),
      title: "ועדת כספים",
      purpose: "finance_committee",
      status: "live",
      hostUserId: userId,
      roomKind: "committee",
      inviteToken: "55555555-5555-4555-8555-555555555555",
      policyVersion: "meetings.2026.1",
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    participants: [],
    sharedAgents: [],
    messages: [
      {
        id: "m1",
        speakerKind: "human",
        speakerId: String(userId),
        speakerName: "Demo Admin",
        body: "נדרש לעדכן תקציב Q3",
        createdAt: "2026-08-03T10:05:00.000Z",
      },
    ],
    recordings: [],
    attendance: [
      {
        id: "a1",
        userId,
        displayName: "Demo Admin",
        joinedAt: "2026-08-03T10:00:00.000Z",
        leftAt: null,
        recordingConsent: true,
        consentAt: "2026-08-03T10:00:30.000Z",
        consentPolicyVersion: "meetings.2026.1",
        createdAt: "2026-08-03T10:00:00.000Z",
      },
    ],
    summaries: [],
    goals: [],
  };
}

function notImplemented(method: string): never {
  throw new Error(`Unexpected call: ${method}`);
}

function createGatewayStub(
  invoke: AiGateway["invoke"],
): AiGateway {
  return {
    primaryProvider: "deterministic",
    invoke,
    embed: async () => {
      notImplemented("embed");
    },
  };
}

function createAgentRepoStub(
  findById: AgentRepository["findById"],
): AgentRepository {
  return {
    findById,
    ensureCatalog: async () => {
      notImplemented("ensureCatalog");
    },
    listAll: async () => {
      notImplemented("listAll");
    },
  };
}

function createBriefingRepoStub(
  overrides: Pick<
    BriefingRepository,
    "getDetail" | "saveSummary" | "createGoal" | "addMessage"
  >,
): BriefingRepository {
  return {
    listByTenant: async () => notImplemented("listByTenant"),
    getDetail: overrides.getDetail,
    create: async () => notImplemented("create"),
    setStatus: async () => notImplemented("setStatus"),
    shareAgent: async () => notImplemented("shareAgent"),
    unshareAgent: async () => notImplemented("unshareAgent"),
    addMessage: overrides.addMessage,
    ensureDemoFinanceRoom: async () => notImplemented("ensureDemoFinanceRoom"),
    startRecording: async () => notImplemented("startRecording"),
    completeRecording: async () => notImplemented("completeRecording"),
    failRecording: async () => notImplemented("failRecording"),
    getRecording: async () => notImplemented("getRecording"),
    listRecordings: async () => notImplemented("listRecordings"),
    findByInviteToken: async () => notImplemented("findByInviteToken"),
    joinRoom: async () => notImplemented("joinRoom"),
    leaveRoom: async () => notImplemented("leaveRoom"),
    recordRecordingConsent: async () => notImplemented("recordRecordingConsent"),
    hasRecordingConsent: async () => notImplemented("hasRecordingConsent"),
    saveSummary: overrides.saveSummary,
    listSummaries: async () => notImplemented("listSummaries"),
    getLatestSummary: async () => notImplemented("getLatestSummary"),
    createGoal: overrides.createGoal,
    listGoals: async () => notImplemented("listGoals"),
    updateGoalStatus: async () => notImplemented("updateGoalStatus"),
  };
}

describe("parseMeetingSummaryFromAnswer", () => {
  it("parses fenced JSON block", () => {
    const answer = [
      "סיכום:",
      "```json",
      JSON.stringify({
        summaryHe: "סיכום קצר",
        decisions: ["החלטה א"],
        goals: [{ title: "יעד 1", description: "תיאור" }],
      }),
      "```",
    ].join("\n");

    const parsed = parseMeetingSummaryFromAnswer(answer);
    assert.ok(parsed);
    assert.equal(parsed.summaryHe, "סיכום קצר");
    assert.deepEqual(parsed.decisions, ["החלטה א"]);
    assert.equal(parsed.goals.length, 1);
    assert.equal(parsed.goals[0]?.title, "יעד 1");
  });

  it("returns null for invalid JSON", () => {
    assert.equal(parseMeetingSummaryFromAnswer("אין JSON"), null);
  });
});

describe("buildFallbackMeetingSummary", () => {
  it("builds summary from messages", () => {
    const fallback = buildFallbackMeetingSummary("ועדת כספים", [
      { speakerName: "Demo", body: "שורה ראשונה" },
    ]);
    assert.match(fallback.summaryHe, /ועדת כספים/);
    assert.ok(fallback.decisions.length >= 1);
    assert.deepEqual(fallback.goals, []);
  });
});

describe("synthesizeBriefingSummary", () => {
  it("saves summary, goals, and posts agent message", async () => {
    const detail = baseDetail();
    const savedSummaries: PersistedBriefingSummary[] = [];
    const savedGoals: PersistedBriefingGoal[] = [];
    const messages: { body: string }[] = [];

    const briefing = createBriefingRepoStub({
      getDetail: async () => detail,
      saveSummary: async (input) => {
        const summary: PersistedBriefingSummary = {
          id: input.id,
          tenantId: input.tenantId,
          roomId: input.roomId,
          summaryHe: input.summaryHe,
          decisions: input.decisions,
          goalsSnapshot: input.goalsSnapshot,
          generatedByAgentId: input.generatedByAgentId,
          createdByUserId: input.createdByUserId,
          createdAt: input.createdAt,
        };
        savedSummaries.push(summary);
        return summary;
      },
      createGoal: async (input) => {
        const goal: PersistedBriefingGoal = {
          id: input.id,
          tenantId: input.tenantId,
          roomId: input.roomId,
          title: input.title,
          description: input.description,
          ownerDisplayName: input.ownerDisplayName,
          ownerUserId: input.ownerUserId ?? null,
          dueDate: input.dueDate ?? null,
          status: input.status ?? "open",
          source: input.source,
          createdAt: input.createdAt,
        };
        savedGoals.push(goal);
        return goal;
      },
      addMessage: async (input) => {
        messages.push({ body: input.body });
        return {
          id: "msg-1",
          speakerKind: input.speakerKind,
          speakerId: input.speakerId,
          speakerName: input.speakerName,
          body: input.body,
          createdAt: input.createdAt,
        };
      },
    });

    const agents = createAgentRepoStub(async (id: AgentId) => ({
      id,
      nameHe: "מזכירת פגישות",
      nameEn: "Meeting Secretary",
      domain: "meetings",
      summaryHe: "סיכום פגישות",
      autonomyMode: "suggest",
      createdAt: "2026-08-03T00:00:00.000Z",
    }));

    const gateway = createGatewayStub(async (): Promise<AiGatewayResponse> => ({
      agentId: "agent.meeting_secretary",
      provider: "deterministic",
      answerHe: [
        "סיכום",
        "```json",
        JSON.stringify({
          summaryHe: "סיכום AI",
          decisions: ["לאשר תקציב"],
          goals: [{ title: "מעקב תקציב", description: "עד סוף החודש" }],
        }),
        "```",
      ].join("\n"),
      confidence: "high",
      citations: [],
      requiresHumanApproval: false,
      latencyMs: 1,
    }));

    const result = await synthesizeBriefingSummary(agents, briefing, gateway, {
      tenantId,
      roomId,
      actorUserId: userId,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(savedSummaries.length, 1);
    assert.equal(savedSummaries[0]?.summaryHe, "סיכום AI");
    assert.equal(savedGoals.length, 1);
    assert.equal(savedGoals[0]?.title, "מעקב תקציב");
    assert.ok(messages.some((message) => message.body.includes("סיכום AI")));
  });

  it("returns ROOM_NOT_FOUND when detail missing", async () => {
    const briefing = createBriefingRepoStub({
      getDetail: async () => null,
      saveSummary: async () => notImplemented("saveSummary"),
      createGoal: async () => notImplemented("createGoal"),
      addMessage: async () => notImplemented("addMessage"),
    });
    const agents = createAgentRepoStub(async () => null);
    const gateway = createGatewayStub(async () => ({
      agentId: "agent.meeting_secretary",
      provider: "deterministic",
      answerHe: "",
      confidence: "low",
      citations: [],
      requiresHumanApproval: false,
      latencyMs: 0,
    }));

    const result = await synthesizeBriefingSummary(agents, briefing, gateway, {
      tenantId,
      roomId,
      actorUserId: userId,
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, "ROOM_NOT_FOUND");
  });
});
