import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import { hashPassword } from "@hotelos/auth";
import type {
  AssessmentRepository,
  AuditRepository,
  HrRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type HrRouteDeps = {
  readonly hr: HrRepository;
  readonly assessments: AssessmentRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

const inviteSchema = z.object({
  hotelId: z.string().uuid(),
  email: z.string().email().max(200),
  displayNameHint: z.string().trim().min(2).max(120),
  roleHint: z.string().trim().min(2).max(80),
  departmentId: z.string().uuid().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

const documentFlagSchema = z.object({
  docType: z.enum([
    "criminal_record_clearance",
    "id_card",
    "contract",
    "certification",
    "other",
  ]),
  contentHash: z.string().trim().min(8).max(128).optional(),
  issuingAuthority: z.string().trim().max(160).optional(),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export function createHrRoutes(deps: HrRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/employees", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = c.req.query("hotelId");
      const data = await deps.hr.listEmployees(
        principal.scope.tenantId,
        hotelId ? Ids.hotel(hotelId) : undefined,
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/employees/:employeeId", async (c) => {
    try {
      const principal = c.get("principal");
      const employee = await deps.hr.getEmployee(
        principal.scope.tenantId,
        c.req.param("employeeId"),
      );
      if (!employee) {
        return sendError(c, 404, "EMPLOYEE_NOT_FOUND", "Employee not found");
      }
      const documents = await deps.hr.listDocuments(
        principal.scope.tenantId,
        employee.id,
      );
      return c.json({ data: { ...employee, documents } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/employees/:employeeId/documents", async (c) => {
    try {
      const principal = c.get("principal");
      const employeeId = c.req.param("employeeId");
      const employee = await deps.hr.getEmployee(
        principal.scope.tenantId,
        employeeId,
      );
      if (!employee) {
        return sendError(c, 404, "EMPLOYEE_NOT_FOUND", "Employee not found");
      }
      const body = documentFlagSchema.parse(await c.req.json());
      const now = new Date().toISOString();
      const id = randomUUID();
      await deps.hr.registerDocumentFlag({
        id,
        tenantId: principal.scope.tenantId,
        employeeId,
        docType: body.docType,
        uploadedAt: now,
        ...(body.contentHash !== undefined
          ? { contentHash: body.contentHash }
          : {}),
        ...(body.issuingAuthority !== undefined
          ? { issuingAuthority: body.issuingAuthority }
          : {}),
        ...(body.issuedAt !== undefined ? { issuedAt: body.issuedAt } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "hr.document_flag.create",
        resourceType: "employee_document",
        resourceId: id,
        metadata: { employeeId, docType: body.docType },
        createdAt: now,
      });
      return c.json({ data: { id, status: "pending_review" } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/invites", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = c.req.query("hotelId");
      if (!hotelId) {
        return sendError(c, 400, "HOTEL_REQUIRED", "hotelId query is required");
      }
      const data = await deps.hr.listInvites(
        principal.scope.tenantId,
        Ids.hotel(hotelId),
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/assessment-templates", async (c) => {
    try {
      const principal = c.get("principal");
      const data = await deps.assessments.listTemplates(
        principal.scope.tenantId,
      );
      return c.json({
        data: data.map((tmpl) => ({
          id: tmpl.id,
          titleHe: tmpl.titleHe,
          titleEn: tmpl.titleEn,
          category: tmpl.category,
          passingScore: tmpl.passingScore,
          questionCount: tmpl.questions.length,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/employees/:employeeId/assessments", async (c) => {
    try {
      const principal = c.get("principal");
      const body = z
        .object({
          templateId: z.string().trim().min(3).max(80),
          dueAt: z.string().datetime().optional(),
        })
        .parse(await c.req.json());
      const employeeId = c.req.param("employeeId");
      const employee = await deps.hr.getEmployee(
        principal.scope.tenantId,
        employeeId,
      );
      if (!employee) {
        return sendError(c, 404, "EMPLOYEE_NOT_FOUND", "Employee not found");
      }
      const created = await deps.assessments.assign({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        employeeId,
        templateId: body.templateId,
        assignedByUserId: principal.userId,
        createdAt: new Date().toISOString(),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt } : {}),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/employees/:employeeId/assessments", async (c) => {
    try {
      const principal = c.get("principal");
      const data = await deps.assessments.listByEmployee(
        principal.scope.tenantId,
        c.req.param("employeeId"),
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/assessments/:assignmentId", async (c) => {
    try {
      const principal = c.get("principal");
      const data = await deps.assessments.getAssignment(
        principal.scope.tenantId,
        c.req.param("assignmentId"),
      );
      if (!data) {
        return sendError(c, 404, "ASSIGNMENT_NOT_FOUND", "Not found");
      }
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/assessments/:assignmentId/submit", async (c) => {
    try {
      const principal = c.get("principal");
      const body = z
        .object({
          answers: z.record(z.string(), z.string()),
        })
        .parse(await c.req.json());
      const result = await deps.assessments.submit({
        tenantId: principal.scope.tenantId,
        assignmentId: c.req.param("assignmentId"),
        answers: body.answers,
        completedAt: new Date().toISOString(),
      });
      if (!result.ok) {
        const status = result.reason === "ALREADY_DONE" ? 409 : 404;
        return sendError(c, status, result.reason, result.reason);
      }
      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/invites", async (c) => {
    try {
      const principal = c.get("principal");
      const body = inviteSchema.parse(await c.req.json());
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + body.expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const invite = await deps.hr.createInvite({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: Ids.hotel(body.hotelId),
        email: body.email,
        displayNameHint: body.displayNameHint,
        roleHint: body.roleHint,
        createdByUserId: principal.userId,
        expiresAt,
        createdAt: now.toISOString(),
        ...(body.departmentId !== undefined
          ? { departmentId: body.departmentId }
          : {}),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "hr.invite.create",
        resourceType: "employee_invite",
        resourceId: invite.id,
        metadata: { email: invite.email, hotelId: invite.hotelId },
        createdAt: now.toISOString(),
      });
      return c.json(
        {
          data: {
            id: invite.id,
            email: invite.email,
            expiresAt: invite.expiresAt,
            inviteUrlPath: `/invite/${invite.token}`,
            token: invite.token,
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}

export const completeInviteSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  nationalId: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(40).optional(),
  preferredLocale: z.string().trim().min(2).max(10).default("he"),
  password: z.string().min(8).max(200),
});

export async function completePublicInvite(
  hr: HrRepository,
  token: string,
  body: z.infer<typeof completeInviteSchema>,
) {
  const passwordHash = await hashPassword(body.password);
  return hr.completeInvite(token, {
    displayName: body.displayName,
    preferredLocale: body.preferredLocale,
    passwordHash,
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.nationalId !== undefined ? { nationalId: body.nationalId } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.emergencyContactName !== undefined
      ? { emergencyContactName: body.emergencyContactName }
      : {}),
    ...(body.emergencyContactPhone !== undefined
      ? { emergencyContactPhone: body.emergencyContactPhone }
      : {}),
  });
}
