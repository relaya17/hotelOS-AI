import { z } from "@hotelos/validation";
import { CIO_ROLES } from "../../../../application/build-cio-digest.js";

export const createTaskSchema = z.object({
  taskType: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
});

export const updateTaskStatusSchema = z
  .object({
    status: z
      .enum(["open", "in_progress", "blocked", "done", "cancelled"])
      .optional(),
    claim: z.boolean().optional(),
    release: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.status !== undefined ||
      body.claim === true ||
      body.release === true,
    { message: "Provide status and/or claim/release: true" },
  )
  .refine(
    (body) => !(body.claim === true && body.release === true),
    { message: "claim and release are mutually exclusive" },
  );

export const createMaintenanceRequestSchema = z.object({
  category: z.enum(["repair", "renovation", "pool", "linen", "general"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum([
    "open",
    "quote_requested",
    "approved",
    "in_progress",
    "done",
    "cancelled",
  ]),
});

export const createVendorSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.enum(["contractor", "supplier", "both"]),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().max(200).optional(),
});

export const createQuoteSchema = z.object({
  vendorId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.string().trim().length(3).default("ILS"),
  validUntil: z.string().datetime().optional(),
});

export const decideQuoteSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

export const createInventoryItemSchema = z.object({
  category: z.enum([
    "towels",
    "linens",
    "pool_chemicals",
    "cleaning",
    "amenities",
    "food",
    "other",
  ]),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(30),
  currentStock: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0),
});

export const createPurchaseOrderSchema = z.object({
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
    .min(1),
});

export const createJobPostingSchema = z.object({
  title: z.string().trim().min(2).max(160),
  boardName: z.string().trim().min(1).max(80),
  externalUrl: z.string().url().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const cioDigestRoleSchema = z.enum(CIO_ROLES);

export const addCandidateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().max(200).optional(),
  source: z.string().trim().min(1).max(80),
});

export const DIRECT_CANDIDATE_STAGES = [
  "applied",
  "screening",
  "interview",
  "rejected",
] as const;

export const updateCandidateStageSchema = z.object({
  stage: z.enum(DIRECT_CANDIDATE_STAGES),
});

export const errorEventSchema = z.object({
  hotelId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  source: z.string().trim().min(1).max(80).default("client"),
  app: z.string().trim().min(1).max(40).optional(),
});

export const revenueGenerateSchema = z.object({
  hotelId: z.string().uuid().optional(),
  horizonDays: z.number().int().min(7).max(14).optional(),
});

export const revenueDecideSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export const createEquipmentAssetSchema = z.object({
  code: z.string().trim().min(1).max(40),
  nameHe: z.string().trim().min(2).max(120),
  category: z.enum(["hvac", "elevator", "boiler", "other"]),
  locationHe: z.string().trim().min(2).max(120),
  installDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const decidePredictionSchema = z.object({
  status: z.enum(["acknowledged", "dismissed", "converted"]),
});

export const windowDaysSchema = z.coerce.number().int().min(1).max(365).default(30);
