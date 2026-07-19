import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  maintenanceRequestPhotos,
  maintenanceRequests,
  vendorQuotes,
  vendors,
} from "../schema/ops.js";

export type MaintenanceCategory =
  | "repair"
  | "renovation"
  | "pool"
  | "linen"
  | "general";
export type MaintenancePriority = "low" | "medium" | "high" | "urgent";
export type MaintenanceStatus =
  | "open"
  | "quote_requested"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";
export type VendorCategory = "contractor" | "supplier" | "both";
export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired";

export type PersistedMaintenanceRequest = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly description: string;
  readonly priority: MaintenancePriority;
  readonly status: MaintenanceStatus;
  readonly vendorId: string | null;
  readonly dueAt: string | null;
  readonly estimatedCost: number | null;
  readonly actualCost: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateMaintenanceRequestInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly description: string;
  readonly priority: MaintenancePriority;
  readonly createdByUserId?: string;
  readonly dueAt?: string;
  readonly createdAt: string;
};

export type PersistedVendor = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string | null;
  readonly name: string;
  readonly category: VendorCategory;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly rating: number | null;
};

export type CreateVendorInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId?: HotelId;
  readonly name: string;
  readonly category: VendorCategory;
  readonly contactName?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly createdAt: string;
};

export type PersistedVendorQuote = {
  readonly id: string;
  readonly maintenanceRequestId: string | null;
  readonly vendorId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: QuoteStatus;
  readonly submittedAt: string;
};

export type CreateVendorQuoteInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly maintenanceRequestId?: string;
  readonly vendorId: string;
  readonly amount: number;
  readonly currency: string;
  readonly validUntil?: string;
  readonly submittedAt: string;
};

function mapRequest(
  row: typeof maintenanceRequests.$inferSelect,
): PersistedMaintenanceRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId,
    category: row.category as MaintenanceCategory,
    title: row.title,
    description: row.description,
    priority: row.priority as MaintenancePriority,
    status: row.status as MaintenanceStatus,
    vendorId: row.vendorId ?? null,
    dueAt: row.dueAt ?? null,
    estimatedCost: row.estimatedCost ?? null,
    actualCost: row.actualCost ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVendor(row: typeof vendors.$inferSelect): PersistedVendor {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId ?? null,
    name: row.name,
    category: row.category as VendorCategory,
    contactName: row.contactName ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    rating: row.rating ?? null,
  };
}

function mapQuote(row: typeof vendorQuotes.$inferSelect): PersistedVendorQuote {
  return {
    id: row.id,
    maintenanceRequestId: row.maintenanceRequestId ?? null,
    vendorId: row.vendorId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as QuoteStatus,
    submittedAt: row.submittedAt,
  };
}

export type MaintenanceRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedMaintenanceRequest[]>;
  createRequest: (
    input: CreateMaintenanceRequestInput,
  ) => Promise<PersistedMaintenanceRequest>;
  updateStatus: (
    tenantId: TenantId,
    requestId: string,
    status: MaintenanceStatus,
    updatedAt: string,
  ) => Promise<PersistedMaintenanceRequest | null>;
  addPhoto: (input: {
    id: string;
    maintenanceRequestId: string;
    phase: "before" | "after" | "general";
    storageKey: string;
    uploadedByUserId?: string;
    createdAt: string;
  }) => Promise<void>;
  listVendors: (
    tenantId: TenantId,
    hotelId?: HotelId,
  ) => Promise<readonly PersistedVendor[]>;
  createVendor: (input: CreateVendorInput) => Promise<PersistedVendor>;
  addQuote: (input: CreateVendorQuoteInput) => Promise<PersistedVendorQuote>;
  listQuotesForRequest: (
    maintenanceRequestId: string,
  ) => Promise<readonly PersistedVendorQuote[]>;
  findQuoteById: (
    tenantId: TenantId,
    quoteId: string,
  ) => Promise<PersistedVendorQuote | null>;
  decideQuote: (
    quoteId: string,
    status: "accepted" | "rejected",
    decidedByUserId: string | undefined,
    decidedAt: string,
  ) => Promise<PersistedVendorQuote | null>;
};

export function createMaintenanceRepository(db: HotelOsDb): MaintenanceRepository {
  return {
    async listByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(maintenanceRequests)
        .where(
          and(
            eq(maintenanceRequests.tenantId, tenantId),
            eq(maintenanceRequests.hotelId, hotelId),
          ),
        )
        .orderBy(desc(maintenanceRequests.createdAt))
        .all();
      return rows.map(mapRequest);
    },

    async createRequest(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        departmentId: null,
        category: input.category,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "open" as const,
        createdByUserId: input.createdByUserId ?? null,
        assignedToUserId: null,
        vendorId: null,
        dueAt: input.dueAt ?? null,
        slaHours: null,
        estimatedCost: null,
        actualCost: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        closedAt: null,
      };
      await db.insert(maintenanceRequests).values(row).run();
      return mapRequest(row);
    },

    async updateStatus(tenantId, requestId, status, updatedAt) {
      await db.update(maintenanceRequests)
        .set({
          status,
          updatedAt,
          ...(status === "done" || status === "cancelled"
            ? { closedAt: updatedAt }
            : {}),
        })
        .where(
          and(
            eq(maintenanceRequests.id, requestId),
            eq(maintenanceRequests.tenantId, tenantId),
          ),
        )
        .run();

      const row = await db
        .select()
        .from(maintenanceRequests)
        .where(eq(maintenanceRequests.id, requestId))
        .get();
      return row ? mapRequest(row) : null;
    },

    async addPhoto(input) {
      await db.insert(maintenanceRequestPhotos)
        .values({
          id: input.id,
          maintenanceRequestId: input.maintenanceRequestId,
          phase: input.phase,
          storageKey: input.storageKey,
          uploadedByUserId: input.uploadedByUserId ?? null,
          createdAt: input.createdAt,
        })
        .run();
    },

    async listVendors(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(vendors)
        .where(
          hotelId
            ? and(eq(vendors.tenantId, tenantId), eq(vendors.hotelId, hotelId))
            : eq(vendors.tenantId, tenantId),
        )
        .all();
      return rows.map(mapVendor);
    },

    async createVendor(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId ?? null,
        name: input.name,
        category: input.category,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        rating: null,
        notes: null,
        createdAt: input.createdAt,
      };
      await db.insert(vendors).values(row).run();
      return mapVendor(row);
    },

    async addQuote(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        maintenanceRequestId: input.maintenanceRequestId ?? null,
        vendorId: input.vendorId,
        amount: input.amount,
        currency: input.currency,
        validUntil: input.validUntil ?? null,
        status: "pending" as const,
        documentStorageKey: null,
        submittedAt: input.submittedAt,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: input.submittedAt,
      };
      await db.insert(vendorQuotes).values(row).run();

      if (input.maintenanceRequestId) {
        await db.update(maintenanceRequests)
          .set({ status: "quote_requested", updatedAt: input.submittedAt })
          .where(eq(maintenanceRequests.id, input.maintenanceRequestId))
          .run();
      }

      return mapQuote(row);
    },

    async listQuotesForRequest(maintenanceRequestId) {
      const rows = await db
        .select()
        .from(vendorQuotes)
        .where(eq(vendorQuotes.maintenanceRequestId, maintenanceRequestId))
        .orderBy(desc(vendorQuotes.submittedAt))
        .all();
      return rows.map(mapQuote);
    },

    async findQuoteById(tenantId, quoteId) {
      const row = await db
        .select()
        .from(vendorQuotes)
        .where(
          and(
            eq(vendorQuotes.tenantId, tenantId),
            eq(vendorQuotes.id, quoteId),
          ),
        )
        .get();
      return row ? mapQuote(row) : null;
    },

    async decideQuote(quoteId, status, decidedByUserId, decidedAt) {
      await db.update(vendorQuotes)
        .set({
          status,
          decidedByUserId: decidedByUserId ?? null,
          decidedAt,
        })
        .where(eq(vendorQuotes.id, quoteId))
        .run();

      const row = await db
        .select()
        .from(vendorQuotes)
        .where(eq(vendorQuotes.id, quoteId))
        .get();
      if (!row) {
        return null;
      }

      if (status === "accepted" && row.maintenanceRequestId) {
        await db.update(maintenanceRequests)
          .set({
            status: "approved",
            vendorId: row.vendorId,
            estimatedCost: row.amount,
            updatedAt: decidedAt,
          })
          .where(eq(maintenanceRequests.id, row.maintenanceRequestId))
          .run();
      }

      return mapQuote(row);
    },
  };
}
