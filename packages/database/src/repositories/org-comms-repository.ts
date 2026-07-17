import { and, asc, eq, isNull } from "drizzle-orm";
import type { ChainId, HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { orgCommsChannels, orgCommsMessages } from "../schema/cio.js";

export type PersistedOrgCommsChannel = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly chainId: ChainId;
  readonly hotelId: string | null;
  readonly channelKey: string;
  readonly nameHe: string;
  readonly createdAt: string;
};

export type PersistedOrgCommsMessage = {
  readonly id: string;
  readonly channelId: string;
  readonly fromRole: string;
  readonly body: string;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export type CreateOrgCommsChannelInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly chainId: ChainId;
  readonly hotelId?: HotelId;
  readonly channelKey: string;
  readonly nameHe: string;
  readonly createdAt: string;
};

export type AddOrgCommsMessageInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly fromRole: string;
  readonly body: string;
  readonly createdByUserId?: string;
  readonly createdAt: string;
};

export type OrgCommsRepository = {
  listChannels: (tenantId: TenantId) => Promise<readonly PersistedOrgCommsChannel[]>;
  findChannelByKey: (
    tenantId: TenantId,
    channelKey: string,
    hotelId: HotelId | null,
  ) => Promise<PersistedOrgCommsChannel | null>;
  createChannel: (
    input: CreateOrgCommsChannelInput,
  ) => Promise<PersistedOrgCommsChannel>;
  ensureChannel: (
    input: CreateOrgCommsChannelInput,
  ) => Promise<PersistedOrgCommsChannel>;
  listMessages: (
    tenantId: TenantId,
    channelId: string,
  ) => Promise<readonly PersistedOrgCommsMessage[]>;
  addMessage: (
    input: AddOrgCommsMessageInput,
  ) => Promise<PersistedOrgCommsMessage | null>;
};

function mapChannel(
  row: typeof orgCommsChannels.$inferSelect,
): PersistedOrgCommsChannel {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    chainId: Ids.chain(row.chainId),
    hotelId: row.hotelId,
    channelKey: row.channelKey,
    nameHe: row.nameHe,
    createdAt: row.createdAt,
  };
}

function mapMessage(
  row: typeof orgCommsMessages.$inferSelect,
): PersistedOrgCommsMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    fromRole: row.fromRole,
    body: row.body,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export function createOrgCommsRepository(db: HotelOsDb): OrgCommsRepository {
  return {
    async listChannels(tenantId) {
      const rows = await db
        .select()
        .from(orgCommsChannels)
        .where(eq(orgCommsChannels.tenantId, tenantId))
        .orderBy(asc(orgCommsChannels.createdAt))
        .all();
      return rows.map(mapChannel);
    },

    async findChannelByKey(tenantId, channelKey, hotelId) {
      const row = await db
        .select()
        .from(orgCommsChannels)
        .where(
          and(
            eq(orgCommsChannels.tenantId, tenantId),
            eq(orgCommsChannels.channelKey, channelKey),
            hotelId === null
              ? isNull(orgCommsChannels.hotelId)
              : eq(orgCommsChannels.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapChannel(row) : null;
    },

    async createChannel(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        chainId: input.chainId,
        hotelId: input.hotelId ?? null,
        channelKey: input.channelKey,
        nameHe: input.nameHe,
        createdAt: input.createdAt,
      };
      await db.insert(orgCommsChannels).values(row).run();
      return mapChannel(row);
    },

    async ensureChannel(input) {
      const existing = await db
        .select()
        .from(orgCommsChannels)
        .where(
          and(
            eq(orgCommsChannels.tenantId, input.tenantId),
            eq(orgCommsChannels.channelKey, input.channelKey),
            input.hotelId
              ? eq(orgCommsChannels.hotelId, input.hotelId)
              : isNull(orgCommsChannels.hotelId),
          ),
        )
        .get();
      if (existing) {
        return mapChannel(existing);
      }
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        chainId: input.chainId,
        hotelId: input.hotelId ?? null,
        channelKey: input.channelKey,
        nameHe: input.nameHe,
        createdAt: input.createdAt,
      };
      await db.insert(orgCommsChannels).values(row).run();
      return mapChannel(row);
    },

    async listMessages(tenantId, channelId) {
      const rows = await db
        .select()
        .from(orgCommsMessages)
        .where(
          and(
            eq(orgCommsMessages.tenantId, tenantId),
            eq(orgCommsMessages.channelId, channelId),
          ),
        )
        .orderBy(asc(orgCommsMessages.createdAt))
        .all();
      return rows.map(mapMessage);
    },

    async addMessage(input) {
      const channel = await db
        .select()
        .from(orgCommsChannels)
        .where(
          and(
            eq(orgCommsChannels.id, input.channelId),
            eq(orgCommsChannels.tenantId, input.tenantId),
          ),
        )
        .get();
      if (!channel) {
        return null;
      }
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        channelId: input.channelId,
        fromRole: input.fromRole,
        body: input.body,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(orgCommsMessages).values(row).run();
      return mapMessage(row);
    },
  };
}
