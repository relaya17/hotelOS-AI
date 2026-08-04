import type { BriefingRepository, UserRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";

export async function resolveDisplayName(
  users: UserRepository,
  userId: ReturnType<typeof Ids.user>,
): Promise<string> {
  const user = await users.findById(userId);
  return user?.displayName ?? "משתמש";
}

export function toRoomDto(room: {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly status: string;
  readonly hostUserId: string;
  readonly chainId: string;
  readonly roomKind: string;
  readonly inviteToken: string;
  readonly policyVersion: string;
  readonly createdAt: string;
}) {
  return {
    id: room.id,
    title: room.title,
    purpose: room.purpose,
    status: room.status,
    hostUserId: room.hostUserId,
    chainId: room.chainId,
    roomKind: room.roomKind,
    inviteToken: room.inviteToken,
    policyVersion: room.policyVersion,
    createdAt: room.createdAt,
  };
}

export function toAttendanceDto(attendance: {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly joinedAt: string;
  readonly leftAt: string | null;
  readonly recordingConsent: boolean;
  readonly consentAt: string | null;
  readonly consentPolicyVersion: string | null;
}) {
  return {
    id: attendance.id,
    userId: attendance.userId,
    displayName: attendance.displayName,
    joinedAt: attendance.joinedAt,
    leftAt: attendance.leftAt,
    recordingConsent: attendance.recordingConsent,
    consentAt: attendance.consentAt,
    consentPolicyVersion: attendance.consentPolicyVersion,
  };
}

export function toSummaryDto(summary: {
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
}) {
  return {
    id: summary.id,
    summaryHe: summary.summaryHe,
    decisions: summary.decisions,
    goalsSnapshot: summary.goalsSnapshot,
    generatedByAgentId: summary.generatedByAgentId,
    createdByUserId: summary.createdByUserId,
    createdAt: summary.createdAt,
  };
}

export function toGoalDto(goal: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerDisplayName: string;
  readonly ownerUserId: string | null;
  readonly dueDate: string | null;
  readonly status: string;
  readonly source: string;
  readonly createdAt: string;
}) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    ownerDisplayName: goal.ownerDisplayName,
    ownerUserId: goal.ownerUserId,
    dueDate: goal.dueDate,
    status: goal.status,
    source: goal.source,
    createdAt: goal.createdAt,
  };
}

export function toDetailDto(
  detail: NonNullable<
    Awaited<ReturnType<BriefingRepository["getDetail"]>>
  >,
) {
  return {
    room: toRoomDto(detail.room),
    participants: detail.participants,
    sharedAgents: detail.sharedAgents.map((agent) => ({
      id: agent.id,
      agentId: agent.agentId,
      nameHe: agent.nameHe,
      nameEn: agent.nameEn,
      domain: agent.domain,
      summaryHe: agent.summaryHe,
      autonomyMode: agent.autonomyMode,
      sharedAt: agent.sharedAt,
    })),
    messages: detail.messages,
    recordings: detail.recordings.map(toRecordingDto),
    attendance: detail.attendance.map(toAttendanceDto),
    summaries: detail.summaries.map(toSummaryDto),
    goals: detail.goals.map(toGoalDto),
  };
}

export function toRecordingDto(
  recording: NonNullable<
    Awaited<ReturnType<BriefingRepository["getRecording"]>>
  >,
) {
  return {
    id: recording.id,
    tenantId: recording.tenantId,
    chainId: recording.chainId,
    roomId: recording.roomId,
    status: recording.status,
    startedByUserId: recording.startedByUserId,
    startedAt: recording.startedAt,
    endedAt: recording.endedAt,
    storageKey: recording.storageKey,
    mimeType: recording.mimeType,
    byteSize: recording.byteSize,
    durationSeconds: recording.durationSeconds,
    hasTranscript: recording.transcriptJson !== null,
    createdAt: recording.createdAt,
  };
}
