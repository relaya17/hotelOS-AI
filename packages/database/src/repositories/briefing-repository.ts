import { and, asc, desc, eq } from "drizzle-orm";
import type {
  AgentId,
  BriefingRoomId,
  ChainId,
  TenantId,
  UserId,
} from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  agents,
  briefingMessages,
  briefingParticipants,
  briefingRecordings,
  briefingRooms,
  briefingSharedAgents,
} from "../schema/briefing.js";

export type BriefingRoomStatus = "scheduled" | "live" | "ended";

export type PersistedBriefingRoom = {
  readonly id: BriefingRoomId;
  readonly tenantId: TenantId;
  readonly chainId: ChainId;
  readonly title: string;
  readonly purpose: string;
  readonly status: BriefingRoomStatus;
  readonly hostUserId: UserId;
  readonly createdAt: string;
};

export type PersistedParticipant = {
  readonly id: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly userId: string | null;
};

export type PersistedSharedAgent = {
  readonly id: string;
  readonly agentId: AgentId;
  readonly nameHe: string;
  readonly nameEn: string;
  readonly domain: string;
  readonly summaryHe: string;
  readonly autonomyMode: string;
  readonly sharedAt: string;
};

export type PersistedBriefingMessage = {
  readonly id: string;
  readonly speakerKind: "human" | "agent";
  readonly speakerId: string;
  readonly speakerName: string;
  readonly body: string;
  readonly createdAt: string;
};

export type RecordingStatus = "recording" | "completed" | "failed";

export type PersistedBriefingRecording = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly chainId: ChainId;
  readonly roomId: BriefingRoomId;
  readonly status: RecordingStatus;
  readonly startedByUserId: UserId;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly storageKey: string | null;
  readonly mimeType: string | null;
  readonly byteSize: number | null;
  readonly durationSeconds: number | null;
  readonly transcriptJson: string | null;
  readonly createdAt: string;
};

export type BriefingRoomDetail = {
  readonly room: PersistedBriefingRoom;
  readonly participants: readonly PersistedParticipant[];
  readonly sharedAgents: readonly PersistedSharedAgent[];
  readonly messages: readonly PersistedBriefingMessage[];
  readonly recordings: readonly PersistedBriefingRecording[];
};

export type CreateBriefingRoomInput = {
  readonly id: BriefingRoomId;
  readonly tenantId: TenantId;
  readonly chainId: ChainId;
  readonly title: string;
  readonly purpose: string;
  readonly hostUserId: UserId;
  readonly createdAt: string;
  readonly participants: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly roleLabel: string;
    readonly userId?: string;
  }[];
};

export type BriefingRepository = {
  listByTenant: (tenantId: TenantId) => Promise<readonly PersistedBriefingRoom[]>;
  getDetail: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
  ) => Promise<BriefingRoomDetail | null>;
  create: (input: CreateBriefingRoomInput) => Promise<PersistedBriefingRoom>;
  setStatus: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
    status: BriefingRoomStatus,
  ) => Promise<PersistedBriefingRoom | null>;
  shareAgent: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly agentId: AgentId;
    readonly sharedByUserId: UserId;
    readonly sharedAt: string;
  }) => Promise<PersistedSharedAgent | null>;
  unshareAgent: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
    agentId: AgentId,
  ) => Promise<boolean>;
  addMessage: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly speakerKind: "human" | "agent";
    readonly speakerId: string;
    readonly speakerName: string;
    readonly body: string;
    readonly createdAt: string;
  }) => Promise<PersistedBriefingMessage | null>;
  ensureDemoFinanceRoom: (input: {
    readonly tenantId: TenantId;
    readonly chainId: ChainId;
    readonly hostUserId: UserId;
  }) => Promise<void>;
  startRecording: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly chainId: ChainId;
    readonly roomId: BriefingRoomId;
    readonly startedByUserId: UserId;
    readonly startedAt: string;
  }) => Promise<PersistedBriefingRecording | null>;
  completeRecording: (input: {
    readonly tenantId: TenantId;
    readonly roomId: BriefingRoomId;
    readonly recordingId: string;
    readonly endedAt: string;
    readonly storageKey: string;
    readonly mimeType: string;
    readonly byteSize: number;
    readonly durationSeconds: number | null;
    readonly transcriptJson: string;
  }) => Promise<PersistedBriefingRecording | null>;
  failRecording: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
    recordingId: string,
  ) => Promise<boolean>;
  getRecording: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
    recordingId: string,
  ) => Promise<PersistedBriefingRecording | null>;
  listRecordings: (
    tenantId: TenantId,
    roomId: BriefingRoomId,
  ) => Promise<readonly PersistedBriefingRecording[]>;
};

const statuses: readonly BriefingRoomStatus[] = [
  "scheduled",
  "live",
  "ended",
];

function asStatus(value: string): BriefingRoomStatus {
  if ((statuses as readonly string[]).includes(value)) {
    return value as BriefingRoomStatus;
  }
  throw new Error("INVALID_BRIEFING_STATUS");
}

function mapRoom(row: typeof briefingRooms.$inferSelect): PersistedBriefingRoom {
  return {
    id: Ids.briefingRoom(row.id),
    tenantId: Ids.tenant(row.tenantId),
    chainId: Ids.chain(row.chainId),
    title: row.title,
    purpose: row.purpose,
    status: asStatus(row.status),
    hostUserId: Ids.user(row.hostUserId),
    createdAt: row.createdAt,
  };
}

function mapRecording(
  row: typeof briefingRecordings.$inferSelect,
): PersistedBriefingRecording {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    chainId: Ids.chain(row.chainId),
    roomId: Ids.briefingRoom(row.roomId),
    status: row.status as RecordingStatus,
    startedByUserId: Ids.user(row.startedByUserId),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize === null ? null : Number(row.byteSize),
    durationSeconds:
      row.durationSeconds === null ? null : Number(row.durationSeconds),
    transcriptJson: row.transcriptJson,
    createdAt: row.createdAt,
  };
}

export function createBriefingRepository(db: HotelOsDb): BriefingRepository {
  return {
    async listByTenant(tenantId) {
      const rows = await db
        .select()
        .from(briefingRooms)
        .where(eq(briefingRooms.tenantId, tenantId))
        .orderBy(asc(briefingRooms.createdAt))
        .all();
      return rows.map(mapRoom);
    },

    async getDetail(tenantId, roomId) {
      const roomRow = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, roomId),
            eq(briefingRooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!roomRow) {
        return null;
      }

      const participantRows = await db
        .select()
        .from(briefingParticipants)
        .where(eq(briefingParticipants.roomId, roomId))
        .all();
      const participants = participantRows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        roleLabel: row.roleLabel,
        userId: row.userId,
      }));

      const sharedRows = await db
        .select({
          share: briefingSharedAgents,
          agent: agents,
        })
        .from(briefingSharedAgents)
        .innerJoin(agents, eq(briefingSharedAgents.agentId, agents.id))
        .where(eq(briefingSharedAgents.roomId, roomId))
        .all();

      const sharedAgents = sharedRows.map((row) => ({
        id: row.share.id,
        agentId: Ids.agent(row.agent.id),
        nameHe: row.agent.nameHe,
        nameEn: row.agent.nameEn,
        domain: row.agent.domain,
        summaryHe: row.agent.summaryHe,
        autonomyMode: row.agent.autonomyMode,
        sharedAt: row.share.sharedAt,
      }));

      const messageRows = await db
        .select()
        .from(briefingMessages)
        .where(eq(briefingMessages.roomId, roomId))
        .orderBy(asc(briefingMessages.createdAt))
        .all();
      const messages = messageRows.map((row) => ({
        id: row.id,
        speakerKind: row.speakerKind as "human" | "agent",
        speakerId: row.speakerId,
        speakerName: row.speakerName,
        body: row.body,
        createdAt: row.createdAt,
      }));

      const recordingRows = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.tenantId, tenantId),
            eq(briefingRecordings.roomId, roomId),
          ),
        )
        .orderBy(desc(briefingRecordings.startedAt))
        .all();
      const recordings = recordingRows.map(mapRecording);

      return {
        room: mapRoom(roomRow),
        participants,
        sharedAgents,
        messages,
        recordings,
      };
    },

    async create(input) {
      await db.insert(briefingRooms)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          chainId: input.chainId,
          title: input.title,
          purpose: input.purpose,
          status: "scheduled",
          hostUserId: input.hostUserId,
          createdAt: input.createdAt,
        })
        .run();

      for (const participant of input.participants) {
        await db.insert(briefingParticipants)
          .values({
            id: participant.id,
            roomId: input.id,
            displayName: participant.displayName,
            roleLabel: participant.roleLabel,
            userId: participant.userId ?? null,
            createdAt: input.createdAt,
          })
          .run();
      }

      return {
        id: input.id,
        tenantId: input.tenantId,
        chainId: input.chainId,
        title: input.title,
        purpose: input.purpose,
        status: "scheduled",
        hostUserId: input.hostUserId,
        createdAt: input.createdAt,
      };
    },

    async setStatus(tenantId, roomId, status) {
      const existing = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, roomId),
            eq(briefingRooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!existing) {
        return null;
      }
      await db.update(briefingRooms)
        .set({ status })
        .where(eq(briefingRooms.id, roomId))
        .run();
      return mapRoom({ ...existing, status });
    },

    async shareAgent(input) {
      const room = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, input.roomId),
            eq(briefingRooms.tenantId, input.tenantId),
          ),
        )
        .get();
      if (!room) {
        return null;
      }

      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .get();
      if (!agent) {
        return null;
      }

      const already = await db
        .select()
        .from(briefingSharedAgents)
        .where(
          and(
            eq(briefingSharedAgents.roomId, input.roomId),
            eq(briefingSharedAgents.agentId, input.agentId),
          ),
        )
        .get();
      if (already) {
        return {
          id: already.id,
          agentId: Ids.agent(agent.id),
          nameHe: agent.nameHe,
          nameEn: agent.nameEn,
          domain: agent.domain,
          summaryHe: agent.summaryHe,
          autonomyMode: agent.autonomyMode,
          sharedAt: already.sharedAt,
        };
      }

      await db.insert(briefingSharedAgents)
        .values({
          id: input.id,
          roomId: input.roomId,
          agentId: input.agentId,
          sharedByUserId: input.sharedByUserId,
          sharedAt: input.sharedAt,
        })
        .run();

      return {
        id: input.id,
        agentId: Ids.agent(agent.id),
        nameHe: agent.nameHe,
        nameEn: agent.nameEn,
        domain: agent.domain,
        summaryHe: agent.summaryHe,
        autonomyMode: agent.autonomyMode,
        sharedAt: input.sharedAt,
      };
    },

    async unshareAgent(tenantId, roomId, agentId) {
      const room = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, roomId),
            eq(briefingRooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!room) {
        return false;
      }
      await db.delete(briefingSharedAgents)
        .where(
          and(
            eq(briefingSharedAgents.roomId, roomId),
            eq(briefingSharedAgents.agentId, agentId),
          ),
        )
        .run();
      return true;
    },

    async addMessage(input) {
      const room = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, input.roomId),
            eq(briefingRooms.tenantId, input.tenantId),
          ),
        )
        .get();
      if (!room) {
        return null;
      }

      await db.insert(briefingMessages)
        .values({
          id: input.id,
          roomId: input.roomId,
          speakerKind: input.speakerKind,
          speakerId: input.speakerId,
          speakerName: input.speakerName,
          body: input.body,
          createdAt: input.createdAt,
        })
        .run();

      return {
        id: input.id,
        speakerKind: input.speakerKind,
        speakerId: input.speakerId,
        speakerName: input.speakerName,
        body: input.body,
        createdAt: input.createdAt,
      };
    },

    async ensureDemoFinanceRoom(input) {
      const roomId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001";
      const existing = await db
        .select()
        .from(briefingRooms)
        .where(eq(briefingRooms.id, roomId))
        .get();
      if (existing) {
        return;
      }

      const now = new Date().toISOString();
      await db.insert(briefingRooms)
        .values({
          id: roomId,
          tenantId: input.tenantId,
          chainId: input.chainId,
          title: "ועדת כספים — רבעון נוכחי",
          purpose: "finance_committee",
          status: "scheduled",
          hostUserId: input.hostUserId,
          createdAt: now,
        })
        .run();

      const participants: readonly {
        readonly id: string;
        readonly displayName: string;
        readonly roleLabel: string;
        readonly userId: string | null;
      }[] = [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001",
          displayName: "Demo Admin",
          roleLabel: "מנהל אזור / יו״ר ועדה",
          userId: input.hostUserId,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002",
          displayName: "יעל רוזן",
          roleLabel: "מנהלת כספים רשת",
          userId: null,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003",
          displayName: "אמיר כהן",
          roleLabel: "מנהל מלון ת״א",
          userId: null,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004",
          displayName: "דנה לוי",
          roleLabel: "מנהלת מלון אילת",
          userId: null,
        },
      ];

      for (const participant of participants) {
        await db.insert(briefingParticipants)
          .values({
            id: participant.id,
            roomId,
            displayName: participant.displayName,
            roleLabel: participant.roleLabel,
            userId: participant.userId,
            createdAt: now,
          })
          .run();
      }

      await db.insert(briefingSharedAgents)
        .values({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
          roomId,
          agentId: "agent.cfo",
          sharedByUserId: input.hostUserId,
          sharedAt: now,
        })
        .run();

      await db.insert(briefingMessages)
        .values({
          id: "dddddddd-dddd-4ddd-8ddd-dddddddd0001",
          roomId,
          speakerKind: "agent",
          speakerId: "agent.cfo",
          speakerName: "סוכן כספים",
          body: "הסוכן שותף לחדר. בקשו תדריך כספים כדי לקבל תמונת מצב על בסיס נתוני הרשת החיים.",
          createdAt: now,
        })
        .run();
    },

    async startRecording(input) {
      const room = await db
        .select()
        .from(briefingRooms)
        .where(
          and(
            eq(briefingRooms.id, input.roomId),
            eq(briefingRooms.tenantId, input.tenantId),
          ),
        )
        .get();
      if (!room || room.chainId !== input.chainId) {
        return null;
      }

      const active = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.tenantId, input.tenantId),
            eq(briefingRecordings.roomId, input.roomId),
            eq(briefingRecordings.status, "recording"),
          ),
        )
        .get();
      if (active) {
        return mapRecording(active);
      }

      await db.insert(briefingRecordings)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          chainId: input.chainId,
          roomId: input.roomId,
          status: "recording",
          startedByUserId: input.startedByUserId,
          startedAt: input.startedAt,
          endedAt: null,
          storageKey: null,
          mimeType: null,
          byteSize: null,
          durationSeconds: null,
          transcriptJson: null,
          createdAt: input.startedAt,
        })
        .run();

      return mapRecording({
        id: input.id,
        tenantId: input.tenantId,
        chainId: input.chainId,
        roomId: input.roomId,
        status: "recording",
        startedByUserId: input.startedByUserId,
        startedAt: input.startedAt,
        endedAt: null,
        storageKey: null,
        mimeType: null,
        byteSize: null,
        durationSeconds: null,
        transcriptJson: null,
        createdAt: input.startedAt,
      });
    },

    async completeRecording(input) {
      const existing = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.id, input.recordingId),
            eq(briefingRecordings.tenantId, input.tenantId),
            eq(briefingRecordings.roomId, input.roomId),
          ),
        )
        .get();
      if (!existing) {
        return null;
      }

      await db.update(briefingRecordings)
        .set({
          status: "completed",
          endedAt: input.endedAt,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          byteSize: String(input.byteSize),
          durationSeconds:
            input.durationSeconds === null
              ? null
              : String(input.durationSeconds),
          transcriptJson: input.transcriptJson,
        })
        .where(eq(briefingRecordings.id, input.recordingId))
        .run();

      return mapRecording({
        ...existing,
        status: "completed",
        endedAt: input.endedAt,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        byteSize: String(input.byteSize),
        durationSeconds:
          input.durationSeconds === null
            ? null
            : String(input.durationSeconds),
        transcriptJson: input.transcriptJson,
      });
    },

    async failRecording(tenantId, roomId, recordingId) {
      const existing = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.id, recordingId),
            eq(briefingRecordings.tenantId, tenantId),
            eq(briefingRecordings.roomId, roomId),
          ),
        )
        .get();
      if (!existing) {
        return false;
      }
      await db.update(briefingRecordings)
        .set({ status: "failed", endedAt: new Date().toISOString() })
        .where(eq(briefingRecordings.id, recordingId))
        .run();
      return true;
    },

    async getRecording(tenantId, roomId, recordingId) {
      const row = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.id, recordingId),
            eq(briefingRecordings.tenantId, tenantId),
            eq(briefingRecordings.roomId, roomId),
          ),
        )
        .get();
      return row ? mapRecording(row) : null;
    },

    async listRecordings(tenantId, roomId) {
      const rows = await db
        .select()
        .from(briefingRecordings)
        .where(
          and(
            eq(briefingRecordings.tenantId, tenantId),
            eq(briefingRecordings.roomId, roomId),
          ),
        )
        .orderBy(desc(briefingRecordings.startedAt))
        .all();
      return rows.map(mapRecording);
    },
  };
}
