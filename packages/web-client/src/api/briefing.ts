import {
  clearSession,
  readAccessToken,
} from "../session.js";
import {
  authGet,
  authPost,
  authedFetch,
  getApiBase,
  parseJson,
  toErrorMessage,
} from "./core.js";

export type AgentDto = {
  readonly id: string;
  readonly nameHe: string;
  readonly nameEn: string;
  readonly domain: string;
  readonly summaryHe: string;
  readonly autonomyMode: string;
};

export type BriefingRoomKind = "committee" | "training" | "all_hands";

export type BriefingRoomSummaryDto = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly status: "scheduled" | "live" | "ended";
  readonly hostUserId: string;
  readonly chainId: string;
  readonly createdAt: string;
  readonly roomKind: BriefingRoomKind;
  readonly inviteToken: string;
  readonly policyVersion: string;
};

export type BriefingAttendanceDto = {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly joinedAt: string;
  readonly leftAt: string | null;
  readonly recordingConsent: boolean;
  readonly consentAt: string | null;
  readonly consentPolicyVersion: string | null;
};

export type BriefingSummaryDto = {
  readonly id: string;
  readonly summaryHe: string;
  readonly decisions: readonly string[];
  readonly goalsSnapshot: readonly {
    readonly title: string;
    readonly description: string;
  }[];
  readonly generatedByAgentId: string;
  readonly createdByUserId: string;
  readonly createdAt: string;
};

export type BriefingGoalDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerDisplayName: string;
  readonly ownerUserId: string | null;
  readonly dueDate: string | null;
  readonly status: "open" | "done" | "cancelled";
  readonly source: "summary" | "manual";
  readonly createdAt: string;
};

export type EndBriefingRoomResultDto = {
  readonly id: string;
  readonly status: BriefingRoomSummaryDto["status"];
  readonly summary: BriefingSummaryDto;
  readonly goals: readonly BriefingGoalDto[];
  readonly idempotent: boolean;
};

export type JoinBriefingRoomResultDto = {
  readonly room: BriefingRoomSummaryDto;
  readonly attendance: BriefingAttendanceDto;
};

export type BriefingRecordingDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string;
  readonly roomId: string;
  readonly status: "recording" | "completed" | "failed";
  readonly startedByUserId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly storageKey: string | null;
  readonly mimeType: string | null;
  readonly byteSize: number | null;
  readonly durationSeconds: number | null;
  readonly hasTranscript: boolean;
  readonly createdAt: string;
};

export type BriefingRoomDetailDto = {
  readonly room: BriefingRoomSummaryDto;
  readonly participants: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly roleLabel: string;
    readonly userId: string | null;
  }[];
  readonly sharedAgents: readonly {
    readonly id: string;
    readonly agentId: string;
    readonly nameHe: string;
    readonly nameEn: string;
    readonly domain: string;
    readonly summaryHe: string;
    readonly autonomyMode: string;
    readonly sharedAt: string;
  }[];
  readonly messages: readonly {
    readonly id: string;
    readonly speakerKind: "human" | "agent";
    readonly speakerId: string;
    readonly speakerName: string;
    readonly body: string;
    readonly createdAt: string;
  }[];
  readonly recordings: readonly BriefingRecordingDto[];
  readonly attendance: readonly BriefingAttendanceDto[];
  readonly summaries: readonly BriefingSummaryDto[];
  readonly goals: readonly BriefingGoalDto[];
};

export async function listAgents(): Promise<readonly AgentDto[]> {
  const payload = (await authGet("/v1/agents")) as { data: AgentDto[] };
  return payload.data;
}

export async function listBriefingRooms(): Promise<
  readonly BriefingRoomSummaryDto[]
> {
  const payload = (await authGet("/v1/briefing-rooms")) as {
    data: BriefingRoomSummaryDto[];
  };
  return payload.data;
}

export async function fetchBriefingRoom(
  roomId: string,
): Promise<BriefingRoomDetailDto> {
  const payload = (await authGet(`/v1/briefing-rooms/${roomId}`)) as {
    data: BriefingRoomDetailDto;
  };
  return payload.data;
}

export async function createBriefingRoom(input: {
  title: string;
  purpose: string;
  roomKind?: BriefingRoomKind;
  participants?: readonly { displayName: string; roleLabel: string }[];
}): Promise<BriefingRoomSummaryDto> {
  const payload = (await authPost("/v1/briefing-rooms", input)) as {
    data: BriefingRoomSummaryDto;
  };
  return payload.data;
}

export async function startBriefingRoom(roomId: string): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/start`);
}

export async function endBriefingRoom(
  roomId: string,
): Promise<EndBriefingRoomResultDto> {
  const payload = (await authPost(`/v1/briefing-rooms/${roomId}/end`)) as {
    data: EndBriefingRoomResultDto;
  };
  return payload.data;
}

export async function joinBriefingRoomByInvite(
  inviteToken: string,
): Promise<JoinBriefingRoomResultDto> {
  const payload = (await authPost("/v1/briefing-rooms/join", {
    inviteToken,
  })) as { data: JoinBriefingRoomResultDto };
  return payload.data;
}

export async function leaveBriefingRoom(roomId: string): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/leave`);
}

export async function acceptBriefingRecordingConsent(
  roomId: string,
): Promise<{ readonly ok: true; readonly policyVersion: string }> {
  const payload = (await authPost(
    `/v1/briefing-rooms/${roomId}/recording-consent`,
    { accepted: true },
  )) as { data: { ok: true; policyVersion: string } };
  return payload.data;
}

export async function createBriefingGoal(
  roomId: string,
  input: {
    title: string;
    description?: string;
    ownerDisplayName?: string;
    ownerUserId?: string;
    dueDate?: string;
  },
): Promise<BriefingGoalDto> {
  const payload = (await authPost(`/v1/briefing-rooms/${roomId}/goals`, input)) as {
    data: BriefingGoalDto;
  };
  return payload.data;
}

export async function updateBriefingGoalStatus(
  roomId: string,
  goalId: string,
  status: BriefingGoalDto["status"],
): Promise<BriefingGoalDto> {
  const { payload } = await authedFetch(
    `/v1/briefing-rooms/${roomId}/goals/${goalId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  return (payload as { data: BriefingGoalDto }).data;
}

export async function shareAgentToBriefingRoom(
  roomId: string,
  agentId: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/agents`, { agentId });
}

export async function postBriefingMessage(
  roomId: string,
  body: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/messages`, { body });
}

export async function consultBriefingAgent(
  roomId: string,
  agentId: string,
  prompt?: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/agents/${agentId}/consult`, {
    ...(prompt !== undefined ? { prompt } : {}),
  });
}

export async function startBriefingRecording(
  roomId: string,
): Promise<BriefingRecordingDto> {
  const payload = (await authPost(
    `/v1/briefing-rooms/${roomId}/recordings/start`,
  )) as { data: BriefingRecordingDto };
  return payload.data;
}

export async function completeBriefingRecording(
  roomId: string,
  recordingId: string,
  blob: Blob,
  durationSeconds: number | null,
): Promise<BriefingRecordingDto> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const form = new FormData();
  form.append("file", blob, "meeting.webm");
  if (durationSeconds !== null) {
    form.append("durationSeconds", String(durationSeconds));
  }
  const response = await fetch(
    `${getApiBase()}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/complete`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to save recording"));
  }
  return (payload as { data: BriefingRecordingDto }).data;
}

export function briefingRecordingMediaUrl(
  roomId: string,
  recordingId: string,
): string {
  return `${getApiBase()}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/media`;
}
