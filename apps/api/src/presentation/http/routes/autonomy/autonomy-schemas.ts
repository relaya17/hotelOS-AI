import { z } from "@hotelos/validation";

export const suggestDepartmentTaskSchema = z.object({
  kind: z.literal("department_task"),
  hotelId: z.string().uuid(),
  departmentCode: z.string().trim().min(2).max(40),
  taskType: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  agentId: z.string().trim().min(3).max(80).default("agent.cio"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

export const suggestProcurementDraftSchema = z.object({
  kind: z.literal("procurement_draft"),
  hotelId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().trim().length(3).default("ILS"),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid().optional(),
        description: z.string().trim().min(1).max(200),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(40),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

export const suggestLowStockSchema = z.object({
  hotelId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().trim().length(3).default("ILS"),
  /** Default unit price (₪) when item has no quote — MVP placeholder. */
  defaultUnitPrice: z.number().int().min(0).default(25),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
});

export const suggestDirtyRoomsSchema = z.object({
  hotelId: z.string().uuid(),
  /** Optional subset; default = all dirty rooms in hotel. */
  roomIds: z.array(z.string().uuid()).max(80).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.housekeeping"),
});

export const suggestTodaysArrivalsSchema = z.object({
  hotelId: z.string().uuid(),
  /** YYYY-MM-DD; default = UTC date of request. */
  checkInDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Optional subset; default = all confirmed arrivals on that date. */
  bookingIds: z.array(z.string().uuid()).max(80).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.reception"),
});

export const suggestSendPurchaseOrderSchema = z.object({
  hotelId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
});

export const suggestRecruitingStageSchema = z.object({
  hotelId: z.string().uuid(),
  candidateId: z.string().uuid(),
  stage: z.enum(["offer", "hired"]),
  agentId: z.string().trim().min(3).max(80).default("agent.hr"),
});

export const suggestFeedbackFollowupSchema = z.object({
  hotelId: z.string().uuid(),
  feedbackId: z.string().uuid(),
  agentId: z.string().trim().min(3).max(80).default("agent.guest"),
});

export const suggestMaintenanceQuoteAcceptSchema = z.object({
  kind: z.literal("maintenance_quote_accept"),
  hotelId: z.string().uuid(),
  maintenanceRequestId: z.string().uuid(),
  quoteId: z.string().uuid(),
  requestTitle: z.string().trim().min(1).max(200).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.maintenance"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

export const suggestLedgerCloseSchema = z.object({
  hotelId: z.string().uuid(),
  /** YYYY-MM fiscal month key. */
  periodKey: z.string().regex(/^\d{4}-\d{2}$/),
  agentId: z.string().trim().min(3).max(80).default("agent.cfo"),
});

export const suggestSchema = z.discriminatedUnion("kind", [
  suggestDepartmentTaskSchema,
  suggestProcurementDraftSchema,
  suggestMaintenanceQuoteAcceptSchema,
]);
