import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  inventoryItems,
  inventoryTransactions,
  purchaseOrderItems,
  purchaseOrders,
} from "../schema/ops.js";

export type InventoryCategory =
  | "towels"
  | "linens"
  | "pool_chemicals"
  | "cleaning"
  | "amenities"
  | "food"
  | "other";
export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "paid"
  | "cancelled";

export type PersistedInventoryItem = {
  readonly id: string;
  readonly hotelId: string;
  readonly category: InventoryCategory;
  readonly name: string;
  readonly unit: string;
  readonly currentStock: number;
  readonly reorderThreshold: number;
  readonly belowThreshold: boolean;
};

export type CreateInventoryItemInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly category: InventoryCategory;
  readonly name: string;
  readonly unit: string;
  readonly currentStock: number;
  readonly reorderThreshold: number;
  readonly createdAt: string;
};

export type PersistedPurchaseOrder = {
  readonly id: string;
  readonly hotelId: string;
  readonly vendorId: string;
  readonly status: PurchaseOrderStatus;
  readonly totalAmount: number;
  readonly currency: string;
  readonly notes: string | null;
  readonly createdAt: string;
};

export type PersistedPurchaseOrderItem = {
  readonly id: string;
  readonly purchaseOrderId: string;
  readonly inventoryItemId: string | null;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
};

export type CreatePurchaseOrderInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly vendorId: string;
  readonly currency: string;
  readonly createdByUserId?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly items: readonly {
    readonly id: string;
    readonly inventoryItemId?: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

function mapInventoryItem(
  row: typeof inventoryItems.$inferSelect,
): PersistedInventoryItem {
  return {
    id: row.id,
    hotelId: row.hotelId,
    category: row.category as InventoryCategory,
    name: row.name,
    unit: row.unit,
    currentStock: row.currentStock,
    reorderThreshold: row.reorderThreshold,
    belowThreshold: row.currentStock <= row.reorderThreshold,
  };
}

function mapPurchaseOrder(
  row: typeof purchaseOrders.$inferSelect,
): PersistedPurchaseOrder {
  return {
    id: row.id,
    hotelId: row.hotelId,
    vendorId: row.vendorId,
    status: row.status as PurchaseOrderStatus,
    totalAmount: row.totalAmount,
    currency: row.currency,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
  };
}

function mapPurchaseOrderItem(
  row: typeof purchaseOrderItems.$inferSelect,
): PersistedPurchaseOrderItem {
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    inventoryItemId: row.inventoryItemId ?? null,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
  };
}

export type ProcurementRepository = {
  listInventory: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedInventoryItem[]>;
  createInventoryItem: (
    input: CreateInventoryItemInput,
  ) => Promise<PersistedInventoryItem>;
  adjustStock: (
    inventoryItemId: string,
    delta: number,
    reason: "restock" | "usage" | "damage" | "adjustment",
    createdByUserId: string | undefined,
    createdAt: string,
  ) => Promise<PersistedInventoryItem | null>;
  listPurchaseOrders: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedPurchaseOrder[]>;
  findPurchaseOrderInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    orderId: string,
  ) => Promise<PersistedPurchaseOrder | null>;
  listPurchaseOrderItems: (
    orderId: string,
  ) => Promise<readonly PersistedPurchaseOrderItem[]>;
  createPurchaseOrder: (
    input: CreatePurchaseOrderInput,
  ) => Promise<PersistedPurchaseOrder>;
  updatePurchaseOrderStatus: (
    tenantId: TenantId,
    orderId: string,
    status: PurchaseOrderStatus,
  ) => Promise<PersistedPurchaseOrder | null>;
  receivePurchaseOrder: (
    tenantId: TenantId,
    orderId: string,
    receivedAt: string,
  ) => Promise<PersistedPurchaseOrder | null>;
};

export function createProcurementRepository(db: HotelOsDb): ProcurementRepository {
  return {
    async listInventory(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.tenantId, tenantId),
            eq(inventoryItems.hotelId, hotelId),
          ),
        )
        .all();
      return rows.map(mapInventoryItem);
    },

    async createInventoryItem(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        category: input.category,
        name: input.name,
        unit: input.unit,
        currentStock: input.currentStock,
        reorderThreshold: input.reorderThreshold,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      await db.insert(inventoryItems).values(row).run();
      return mapInventoryItem(row);
    },

    async adjustStock(inventoryItemId, delta, reason, createdByUserId, createdAt) {
      await db.insert(inventoryTransactions)
        .values({
          id: crypto.randomUUID(),
          inventoryItemId,
          delta,
          reason,
          relatedPurchaseOrderId: null,
          createdByUserId: createdByUserId ?? null,
          createdAt,
        })
        .run();

      const current = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, inventoryItemId))
        .get();
      if (!current) {
        return null;
      }

      const nextStock = current.currentStock + delta;
      await db.update(inventoryItems)
        .set({ currentStock: nextStock, updatedAt: createdAt })
        .where(eq(inventoryItems.id, inventoryItemId))
        .run();

      return mapInventoryItem({ ...current, currentStock: nextStock });
    },

    async listPurchaseOrders(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.tenantId, tenantId),
            eq(purchaseOrders.hotelId, hotelId),
          ),
        )
        .orderBy(desc(purchaseOrders.createdAt))
        .all();
      return rows.map(mapPurchaseOrder);
    },

    async findPurchaseOrderInHotel(tenantId, hotelId, orderId) {
      const row = await db
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.id, orderId),
            eq(purchaseOrders.tenantId, tenantId),
            eq(purchaseOrders.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapPurchaseOrder(row) : null;
    },

    async listPurchaseOrderItems(orderId) {
      const rows = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
        .all();
      return rows.map(mapPurchaseOrderItem);
    },

    async createPurchaseOrder(input) {
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        vendorId: input.vendorId,
        status: "draft" as const,
        totalAmount,
        currency: input.currency,
        expectedDeliveryAt: null,
        receivedAt: null,
        createdByUserId: input.createdByUserId ?? null,
        notes: input.notes ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(purchaseOrders).values(row).run();

      for (const item of input.items) {
        await db.insert(purchaseOrderItems)
          .values({
            id: item.id,
            purchaseOrderId: input.id,
            inventoryItemId: item.inventoryItemId ?? null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            createdAt: input.createdAt,
          })
          .run();
      }

      return mapPurchaseOrder(row);
    },

    async updatePurchaseOrderStatus(tenantId, orderId, status) {
      await db.update(purchaseOrders)
        .set({ status })
        .where(
          and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.tenantId, tenantId)),
        )
        .run();

      const row = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .get();
      return row ? mapPurchaseOrder(row) : null;
    },

    async receivePurchaseOrder(tenantId, orderId, receivedAt) {
      await db.update(purchaseOrders)
        .set({ status: "received", receivedAt })
        .where(
          and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.tenantId, tenantId)),
        )
        .run();

      const items = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
        .all();

      for (const item of items) {
        if (!item.inventoryItemId) {
          continue;
        }
        const inventoryItem = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .get();
        if (!inventoryItem) {
          continue;
        }
        await db.insert(inventoryTransactions)
          .values({
            id: crypto.randomUUID(),
            inventoryItemId: item.inventoryItemId,
            delta: item.quantity,
            reason: "restock",
            relatedPurchaseOrderId: orderId,
            createdByUserId: null,
            createdAt: receivedAt,
          })
          .run();
        await db.update(inventoryItems)
          .set({
            currentStock: inventoryItem.currentStock + item.quantity,
            updatedAt: receivedAt,
          })
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .run();
      }

      const row = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .get();
      return row ? mapPurchaseOrder(row) : null;
    },
  };
}
