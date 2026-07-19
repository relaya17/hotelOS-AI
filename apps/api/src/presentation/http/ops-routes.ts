import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AuditRepository,
  CompanyKnowledgeRepository,
  FeedbackRepository,
  HotelRepository,
  KashrutRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
  RecruitingRepository,
  TrustedSourcesRepository,
  TurboRepository,
} from "@hotelos/database";
import { canAccessHotel, type JwtTokenService } from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { buildCioDigest, CIO_ROLES } from "../../application/build-cio-digest.js";
import { buildDailyBriefing } from "../../application/build-daily-briefing.js";
import { mapSecurityWebhook } from "../../application/map-security-webhook.js";
import { listOpsAnomalies } from "../../application/run-anomaly-scan.js";
import { synthesizeCioDigest } from "../../application/synthesize-cio-digest.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

type OpsContext = Context<{ Variables: AuthVariables }>;
type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

export type OpsRouteDeps = {
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
  readonly recruiting: RecruitingRepository;
  readonly hotels: HotelRepository;
  readonly overview: OverviewRepository;
  readonly kashrut: KashrutRepository;
  readonly turbo: TurboRepository;
  readonly gateway: AiGateway;
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly trustedSources: TrustedSourcesRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdSchema = z.string().uuid();

const createTaskSchema = z.object({
  taskType: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
});

const updateTaskStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]),
});

const createMaintenanceRequestSchema = z.object({
  category: z.enum(["repair", "renovation", "pool", "linen", "general"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
});

const updateMaintenanceStatusSchema = z.object({
  status: z.enum([
    "open",
    "quote_requested",
    "approved",
    "in_progress",
    "done",
    "cancelled",
  ]),
});

const createVendorSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.enum(["contractor", "supplier", "both"]),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().max(200).optional(),
});

const createQuoteSchema = z.object({
  vendorId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.string().trim().length(3).default("ILS"),
  validUntil: z.string().datetime().optional(),
});

const decideQuoteSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

const createInventoryItemSchema = z.object({
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

const createPurchaseOrderSchema = z.object({
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

const createJobPostingSchema = z.object({
  title: z.string().trim().min(2).max(160),
  boardName: z.string().trim().min(1).max(80),
  externalUrl: z.string().url().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const cioDigestRoleSchema = z.enum(CIO_ROLES);

const addCandidateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().max(200).optional(),
  source: z.string().trim().min(1).max(80),
});

const DIRECT_CANDIDATE_STAGES = [
  "applied",
  "screening",
  "interview",
  "rejected",
] as const;

const updateCandidateStageSchema = z.object({
  stage: z.enum(DIRECT_CANDIDATE_STAGES),
});

export function createOpsRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  async function resolveHotelId(c: OpsContext): Promise<HotelIdResult> {
    const principal = c.get("principal");
    const raw = c.req.query("hotelId");
    if (!raw) {
      return {
        ok: false,
        response: sendError(c, 400, "HOTEL_ID_REQUIRED", "hotelId query param is required"),
      };
    }
    const parsed = hotelIdSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        response: sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId"),
      };
    }
    const hotelId = Ids.hotel(parsed.data);
    if (!canAccessHotel(principal, hotelId)) {
      return {
        ok: false,
        response: sendError(c, 403, "FORBIDDEN", "No access to this hotel"),
      };
    }
    const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
    if (!tenantHotels.some((hotel) => hotel.id === hotelId)) {
      return {
        ok: false,
        response: sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found"),
      };
    }
    return { ok: true, hotelId };
  }

  // ---- Departments + generic tasks ----

  routes.get("/departments", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.ops.listDepartments(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      const withStaff = await Promise.all(
        list.map(async (dept) => ({
          ...dept,
          staffCount: await deps.ops.countStaffByDepartment(dept.id),
        })),
      );
      return c.json({ data: withStaff });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/departments/:code/tasks", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const code = c.req.param("code");
      const department = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        resolved.hotelId,
        code,
      );
      if (!department) {
        return sendError(c, 404, "DEPARTMENT_NOT_FOUND", "Department not found");
      }
      const tasks = await deps.ops.listTasksByDepartment(
        principal.scope.tenantId,
        resolved.hotelId,
        department.id,
      );
      return c.json({ data: { department, tasks } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/departments/:code/tasks", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const code = c.req.param("code");
      const department = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        resolved.hotelId,
        code,
      );
      if (!department) {
        return sendError(c, 404, "DEPARTMENT_NOT_FOUND", "Department not found");
      }
      const body = createTaskSchema.parse(await c.req.json());
      const created = await deps.ops.createTask({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        departmentId: department.id,
        taskType: body.taskType,
        title: body.title,
        description: body.description,
        priority: body.priority,
        createdByUserId: principal.userId,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/tasks/:id", async (c) => {
    try {
      const principal = c.get("principal");
      const taskId = c.req.param("id");
      const body = updateTaskStatusSchema.parse(await c.req.json());
      const updated = await deps.ops.updateTaskStatus(
        principal.scope.tenantId,
        taskId,
        body.status,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
      }
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Maintenance & procurement (department: maintenance) ----

  routes.get("/maintenance-requests", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.maintenance.listByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/maintenance-requests", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createMaintenanceRequestSchema.parse(await c.req.json());
      const created = await deps.maintenance.createRequest({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        category: body.category,
        title: body.title,
        description: body.description,
        priority: body.priority,
        createdByUserId: principal.userId,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/maintenance-requests/:id", async (c) => {
    try {
      const principal = c.get("principal");
      const requestId = c.req.param("id");
      const body = updateMaintenanceStatusSchema.parse(await c.req.json());
      const updated = await deps.maintenance.updateStatus(
        principal.scope.tenantId,
        requestId,
        body.status,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "REQUEST_NOT_FOUND", "Maintenance request not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: Ids.hotel(updated.hotelId),
        actorUserId: principal.userId,
        action: "maintenance.status.update",
        resourceType: "maintenance_request",
        resourceId: updated.id,
        metadata: {
          status: updated.status,
          category: updated.category,
          priority: updated.priority,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/vendors", async (c) => {
    try {
      const principal = c.get("principal");
      const list = await deps.maintenance.listVendors(principal.scope.tenantId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/vendors", async (c) => {
    try {
      const principal = c.get("principal");
      const body = createVendorSchema.parse(await c.req.json());
      const created = await deps.maintenance.createVendor({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        name: body.name,
        category: body.category,
        ...(body.contactName ? { contactName: body.contactName } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/maintenance-requests/:id/quotes", async (c) => {
    try {
      const principal = c.get("principal");
      const requestId = c.req.param("id");
      const body = createQuoteSchema.parse(await c.req.json());
      const created = await deps.maintenance.addQuote({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        maintenanceRequestId: requestId,
        vendorId: body.vendorId,
        amount: body.amount,
        currency: body.currency,
        ...(body.validUntil ? { validUntil: body.validUntil } : {}),
        submittedAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/maintenance-requests/:id/quotes", async (c) => {
    try {
      const requestId = c.req.param("id");
      const list = await deps.maintenance.listQuotesForRequest(requestId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/quotes/:id/decision", async (c) => {
    try {
      const principal = c.get("principal");
      const quoteId = c.req.param("id");
      const body = decideQuoteSchema.parse(await c.req.json());
      const updated = await deps.maintenance.decideQuote(
        quoteId,
        body.status,
        principal.userId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
      }
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Inventory + purchase orders ----

  routes.get("/inventory", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.procurement.listInventory(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/inventory", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createInventoryItemSchema.parse(await c.req.json());
      const created = await deps.procurement.createInventoryItem({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        category: body.category,
        name: body.name,
        unit: body.unit,
        currentStock: body.currentStock,
        reorderThreshold: body.reorderThreshold,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "inventory.create",
        resourceType: "inventory_item",
        resourceId: created.id,
        metadata: {
          category: created.category,
          currentStock: created.currentStock,
          reorderThreshold: created.reorderThreshold,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/purchase-orders", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.procurement.listPurchaseOrders(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/purchase-orders", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createPurchaseOrderSchema.parse(await c.req.json());
      const created = await deps.procurement.createPurchaseOrder({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        vendorId: body.vendorId,
        currency: body.currency,
        createdByUserId: principal.userId,
        ...(body.notes ? { notes: body.notes } : {}),
        createdAt: new Date().toISOString(),
        items: body.items.map((item) => ({
          id: randomUUID(),
          ...(item.inventoryItemId ? { inventoryItemId: item.inventoryItemId } : {}),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "purchase_order.create",
        resourceType: "purchase_order",
        resourceId: created.id,
        metadata: {
          vendorId: created.vendorId,
          status: created.status,
          totalAmount: created.totalAmount,
          currency: created.currency,
          itemCount: body.items.length,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/purchase-orders/:id/receive", async (c) => {
    try {
      const principal = c.get("principal");
      const orderId = c.req.param("id");
      const updated = await deps.procurement.receivePurchaseOrder(
        principal.scope.tenantId,
        orderId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "ORDER_NOT_FOUND", "Purchase order not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: Ids.hotel(updated.hotelId),
        actorUserId: principal.userId,
        action: "purchase_order.receive",
        resourceType: "purchase_order",
        resourceId: updated.id,
        metadata: {
          status: updated.status,
          vendorId: updated.vendorId,
          totalAmount: updated.totalAmount,
          currency: updated.currency,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Guest feedback (internal view; submission is public, see public-routes.ts) ----

  routes.get("/feedback", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.feedback.listByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      const average = await deps.feedback.averageRating(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: { average, items: list } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- HR recruiting (job board tracker) ----

  routes.get("/recruiting/postings", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.recruiting.listPostings(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createJobPostingSchema.parse(await c.req.json());
      const created = await deps.recruiting.createPosting({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        title: body.title,
        boardName: body.boardName,
        ...(body.externalUrl ? { externalUrl: body.externalUrl } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        createdByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.posting.create",
        resourceType: "job_posting",
        resourceId: created.id,
        metadata: {
          title: created.title,
          boardName: created.boardName,
          status: created.status,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings/:id/candidates", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const posting = await deps.recruiting.findPostingInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
      );
      if (!posting) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      if (posting.status === "closed") {
        return sendError(
          c,
          409,
          "POSTING_CLOSED",
          "Cannot add candidates to a closed posting",
        );
      }
      const body = addCandidateSchema.parse(await c.req.json());
      const created = await deps.recruiting.addCandidate({
        id: randomUUID(),
        jobPostingId: postingId,
        fullName: body.fullName,
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        source: body.source,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.candidate.create",
        resourceType: "job_candidate",
        resourceId: created.id,
        metadata: {
          jobPostingId: created.jobPostingId,
          source: created.source,
          stage: created.stage,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/recruiting/postings/:id/candidates", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const posting = await deps.recruiting.findPostingInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
      );
      if (!posting) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      const list = await deps.recruiting.listCandidates(postingId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings/:id/close", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const now = new Date().toISOString();
      const closed = await deps.recruiting.closePosting(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
        now,
      );
      if (!closed) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.posting.close",
        resourceType: "job_posting",
        resourceId: closed.id,
        metadata: { title: closed.title, status: closed.status },
        createdAt: now,
      });
      return c.json({ data: closed });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/recruiting/candidates/:candidateId/stage", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = updateCandidateStageSchema.parse(await c.req.json());
      const found = await deps.recruiting.findCandidateInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        c.req.param("candidateId"),
      );
      if (!found) {
        return sendError(
          c,
          404,
          "CANDIDATE_NOT_FOUND",
          "Candidate not found",
        );
      }
      if (found.posting.status === "closed") {
        return sendError(
          c,
          409,
          "POSTING_CLOSED",
          "Cannot update candidates on a closed posting",
        );
      }
      const updated = await deps.recruiting.updateCandidateStage(
        found.candidate.id,
        body.stage,
      );
      if (!updated) {
        return sendError(
          c,
          404,
          "CANDIDATE_NOT_FOUND",
          "Candidate not found",
        );
      }
      const now = new Date().toISOString();
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.candidate.stage",
        resourceType: "job_candidate",
        resourceId: updated.id,
        metadata: {
          jobPostingId: updated.jobPostingId,
          from: found.candidate.stage,
          to: updated.stage,
        },
        createdAt: now,
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Security events (generic webhook → department task; no VMS lock-in) ----

  async function createSecurityTaskFromEvent(
    c: OpsContext,
    body: {
      readonly hotelId: string;
      readonly title: string;
      readonly description: string;
      readonly priority: "low" | "medium" | "high" | "urgent";
      readonly source: string;
      readonly externalEventId?: string;
    },
  ) {
    const principal = c.get("principal");
    const hotelId = Ids.hotel(body.hotelId);
    if (!canAccessHotel(principal, hotelId)) {
      return sendError(c, 403, "FORBIDDEN", "Hotel out of scope");
    }
    const now = new Date().toISOString();
    await deps.ops.ensureStandardDepartments(
      principal.scope.tenantId,
      hotelId,
      now,
    );
    const dept = await deps.ops.findDepartmentByCode(
      principal.scope.tenantId,
      hotelId,
      "security",
    );
    if (!dept) {
      return sendError(
        c,
        500,
        "SECURITY_DEPT_MISSING",
        "Security department not available",
      );
    }
    const external =
      body.externalEventId !== undefined
        ? ` event=${body.externalEventId}`
        : "";
    const created = await deps.ops.createTask({
      id: randomUUID(),
      tenantId: principal.scope.tenantId,
      hotelId,
      departmentId: dept.id,
      taskType: "security_event",
      title: body.title,
      description: `[${body.source}] ${body.description}${external}`,
      priority: body.priority,
      createdByUserId: principal.userId,
      createdAt: now,
    });
    await deps.audit.append({
      id: randomUUID(),
      tenantId: principal.scope.tenantId,
      actorUserId: principal.userId,
      action: "ops.security_event.create",
      resourceType: "department_task",
      resourceId: created.id,
      metadata: {
        source: body.source,
        hotelId: body.hotelId,
        ...(body.externalEventId !== undefined
          ? { externalEventId: body.externalEventId }
          : {}),
      },
      createdAt: now,
    });
    return c.json({ data: created }, 201);
  }

  routes.post("/security-events", async (c) => {
    try {
      const body = mapSecurityWebhook("generic", await c.req.json());
      return await createSecurityTaskFromEvent(c, {
        hotelId: body.hotelId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        source: body.source,
        ...(body.externalEventId !== undefined
          ? { externalEventId: body.externalEventId }
          : {}),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Vendor adapter entry — e.g. POST /security-events/ingest/example_vms */
  routes.post("/security-events/ingest/:provider", async (c) => {
    try {
      const providerParsed = z
        .enum(["generic", "example_vms"])
        .safeParse(c.req.param("provider"));
      if (!providerParsed.success) {
        return sendError(
          c,
          400,
          "UNKNOWN_PROVIDER",
          "Supported providers: generic, example_vms",
        );
      }
      const body = mapSecurityWebhook(
        providerParsed.data,
        await c.req.json(),
      );
      return await createSecurityTaskFromEvent(c, {
        hotelId: body.hotelId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        source: body.source,
        ...(body.externalEventId !== undefined
          ? { externalEventId: body.externalEventId }
          : {}),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Error / observability events → IT department inbox ----

  const errorEventSchema = z.object({
    hotelId: z.string().uuid().optional(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(4000),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    source: z.string().trim().min(1).max(80).default("client"),
    app: z.string().trim().min(1).max(40).optional(),
  });

  routes.post("/error-events", async (c) => {
    try {
      const principal = c.get("principal");
      const body = errorEventSchema.parse(await c.req.json());
      let hotelId =
        body.hotelId !== undefined
          ? Ids.hotel(body.hotelId)
          : principal.scope.hotelId;
      if (hotelId === undefined) {
        const hotels = await deps.hotels.listByTenant(principal.scope.tenantId);
        const first = hotels[0];
        if (!first) {
          return sendError(c, 404, "NO_HOTEL", "No hotel available for task");
        }
        hotelId = first.id;
      }
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "Hotel out of scope");
      }
      const now = new Date().toISOString();
      await deps.ops.ensureStandardDepartments(
        principal.scope.tenantId,
        hotelId,
        now,
      );
      const dept = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        hotelId,
        "it",
      );
      if (!dept) {
        return sendError(c, 500, "IT_DEPT_MISSING", "IT department not available");
      }
      const appTag = body.app ? `${body.app}/` : "";
      const created = await deps.ops.createTask({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        departmentId: dept.id,
        taskType: "error_event",
        title: body.title,
        description: `[${appTag}${body.source}] ${body.description}`,
        priority: body.priority,
        createdByUserId: principal.userId,
        createdAt: now,
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "ops.error_event.create",
        resourceType: "department_task",
        resourceId: created.id,
        metadata: {
          source: body.source,
          hotelId: String(hotelId),
          ...(body.app !== undefined ? { app: body.app } : {}),
        },
        createdAt: now,
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Ops / financial threshold anomalies (Stage ה' MVP) ----

  routes.get("/anomalies", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(
        principal.scope.tenantId,
      );
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const anomalies = await listOpsAnomalies(
        {
          hotels: deps.hotels,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          turbo: deps.turbo,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelIds: scopedHotelIds,
        },
      );
      return c.json({ data: anomalies });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Daily briefing (in-system digest for managers/executives) ----

  routes.get("/daily-briefing", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const briefing = await buildDailyBriefing(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
        },
        principal.scope.tenantId,
        scopedHotelIds,
      );
      if (!briefing) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }
      return c.json({ data: briefing });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- CIO digest ("יועץ־על") — role-based, deterministic (ADR 0007) ----

  routes.get("/cio-digest", async (c) => {
    try {
      const principal = c.get("principal");
      const roleParsed = cioDigestRoleSchema.safeParse(c.req.query("role") ?? "ceo");
      if (!roleParsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid role");
      }

      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const digest = await buildCioDigest(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
          kashrut: deps.kashrut,
          hotels: deps.hotels,
          turbo: deps.turbo,
        },
        principal.scope.tenantId,
        scopedHotelIds,
        roleParsed.data,
      );
      if (!digest) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }
      return c.json({ data: digest });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Smart digest: deterministic facts + Gateway narrative for the selected role. */
  routes.post("/cio-digest/synthesize", async (c) => {
    try {
      const principal = c.get("principal");
      const body = z
        .object({ role: cioDigestRoleSchema.default("ceo") })
        .parse(await c.req.json().catch(() => ({})));

      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const synthesized = await synthesizeCioDigest(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
          kashrut: deps.kashrut,
          hotels: deps.hotels,
          turbo: deps.turbo,
          gateway: deps.gateway,
          companyKnowledge: deps.companyKnowledge,
          trustedSources: deps.trustedSources,
        },
        {
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
          hotelIds: scopedHotelIds,
          role: body.role,
        },
      );
      if (!synthesized) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "cio.digest.synthesize",
        resourceType: "cio_digest",
        resourceId: body.role,
        metadata: {
          provider: synthesized.provider,
          requiresHumanApproval: synthesized.requiresHumanApproval,
          suggestedActions: synthesized.suggestedActionsHe.length,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: synthesized });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Unified dashboard ("knowledge graph") ----

  routes.get("/dashboard", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scoped = principal.scope.hotelId
        ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
        : tenantHotels;

      const perHotel = await Promise.all(
        scoped.map(async (hotel) => {
          const [depts, requests, inventory, orders, avgRating] = await Promise.all([
            deps.ops.listDepartments(principal.scope.tenantId, hotel.id),
            deps.maintenance.listByHotel(principal.scope.tenantId, hotel.id),
            deps.procurement.listInventory(principal.scope.tenantId, hotel.id),
            deps.procurement.listPurchaseOrders(principal.scope.tenantId, hotel.id),
            deps.feedback.averageRating(principal.scope.tenantId, hotel.id),
          ]);

          const openRequests = requests.filter(
            (request) => request.status !== "done" && request.status !== "cancelled",
          );
          const pendingQuoteRequests = requests.filter(
            (request) => request.status === "quote_requested",
          );
          const lowStock = inventory.filter((item) => item.belowThreshold);
          const openOrders = orders.filter(
            (order) => order.status !== "received" && order.status !== "cancelled",
          );

          return {
            hotelId: hotel.id,
            hotelName: hotel.name,
            departmentCount: depts.length,
            openMaintenanceRequests: openRequests.length,
            pendingQuoteRequests: pendingQuoteRequests.length,
            lowStockItems: lowStock.length,
            openPurchaseOrders: openOrders.length,
            averageFeedbackRating: avgRating,
          };
        }),
      );

      return c.json({ data: { hotels: perHotel } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
