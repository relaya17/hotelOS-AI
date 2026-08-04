import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { detectFoodRelatedProcurement } from "../../../../application/evaluate-kashrut-procurement-gate.js";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  approvalReasonForTotal,
  assertAutonomyAccess,
} from "./autonomy-access.js";
import { suggestSchema } from "./autonomy-schemas.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { AutonomyRouteDeps } from "./autonomy-deps.js";

export function createAutonomySuggestRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/suggest", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const moneySuggest =
          body.kind === "procurement_draft" ||
          body.kind === "maintenance_quote_accept";
        const denied = assertAutonomyAccess(c, principal, hotelId, moneySuggest);
        if (denied) return denied;
        const now = new Date().toISOString();

        if (body.kind === "department_task") {
          await deps.ops.ensureStandardDepartments(
            principal.scope.tenantId,
            hotelId,
            now,
          );
          const department = await deps.ops.findDepartmentByCode(
            principal.scope.tenantId,
            hotelId,
            body.departmentCode,
          );
          if (!department) {
            return sendError(
              c,
              404,
              "DEPARTMENT_NOT_FOUND",
              `Department ${body.departmentCode} not found`,
            );
          }

          const summaryHe =
            body.summaryHe ?? `הצעת משימה: ${body.title} (${body.departmentCode})`;
          const reasonHe =
            body.reasonHe ??
            "הצעת סוכן AI — נדרש אישור אנושי לפני פתיחת משימה במחלקה.";

          const created = await deps.approvals.create({
            id: randomUUID(),
            tenantId: principal.scope.tenantId,
            hotelId,
            agentId: body.agentId,
            requestedByUserId: principal.userId,
            summaryHe,
            reasonHe,
            payloadJson: JSON.stringify({
              kind: "autonomy.department_task",
              hotelId: body.hotelId,
              departmentCode: body.departmentCode,
              taskType: body.taskType,
              title: body.title,
              description: body.description,
              priority: body.priority,
            }),
            createdAt: now,
          });

          await deps.audit.append({
            id: randomUUID(),
            tenantId: principal.scope.tenantId,
            actorUserId: principal.userId,
            action: "autonomy.suggest",
            resourceType: "ai_approval_request",
            resourceId: created.id,
            metadata: {
              kind: body.kind,
              departmentCode: body.departmentCode,
              agentId: body.agentId,
            },
            createdAt: now,
          });

          return c.json(
            {
              data: {
                approval: created,
                autonomyStep: "suggest",
                nextStepHe: "Approve בתיבת אישורי AI → Act ייפתח משימה במחלקה",
              },
            },
            201,
          );
        }

        if (body.kind === "procurement_draft") {
          const total = body.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          );
          const draftPayload = {
            kind: "autonomy.procurement_draft" as const,
            hotelId: body.hotelId,
            vendorId: body.vendorId,
            currency: body.currency,
            ...(body.notes ? { notes: body.notes } : {}),
            items: body.items,
            estimatedTotal: total,
            executesSend: false,
          };
          const foodRelated = detectFoodRelatedProcurement(draftPayload);
          const summaryHe =
            body.summaryHe ??
            `הצעת טיוטת רכש: ${body.items.length} פריטים · ₪${total}`;
          const reasonHe =
            body.reasonHe ??
            [
              approvalReasonForTotal(total, "po"),
              foodRelated
                ? "רכש מזון/F&B — שער Kashrut לפני Approve→Act."
                : null,
            ]
              .filter(Boolean)
              .join(" ");

          const created = await deps.approvals.create({
            id: randomUUID(),
            tenantId: principal.scope.tenantId,
            hotelId,
            agentId: body.agentId,
            requestedByUserId: principal.userId,
            summaryHe,
            reasonHe,
            payloadJson: JSON.stringify({
              ...draftPayload,
              foodRelated,
            }),
            createdAt: now,
          });

          await deps.audit.append({
            id: randomUUID(),
            tenantId: principal.scope.tenantId,
            actorUserId: principal.userId,
            action: "autonomy.suggest",
            resourceType: "ai_approval_request",
            resourceId: created.id,
            metadata: {
              kind: body.kind,
              agentId: body.agentId,
              estimatedTotal: total,
            },
            createdAt: now,
          });

          return c.json(
            {
              data: {
                approval: created,
                autonomyStep: "suggest",
                estimatedTotal: total,
                nextStepHe:
                  "Approve בתיבת אישורי AI → Act ייצור טיוטת PO (לא נשלחת לספק)",
              },
            },
            201,
          );
        }

        const quote = await deps.maintenance.findQuoteById(
          principal.scope.tenantId,
          body.quoteId,
        );
        if (!quote) {
          return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
        }
        if (quote.status !== "pending") {
          return sendError(
            c,
            409,
            "QUOTE_NOT_PENDING",
            `Quote is already ${quote.status}`,
          );
        }
        if (quote.maintenanceRequestId !== body.maintenanceRequestId) {
          return sendError(
            c,
            400,
            "QUOTE_REQUEST_MISMATCH",
            "Quote does not belong to the maintenance request",
          );
        }

        const summaryHe =
          body.summaryHe ??
          `אישור הצעת מחיר תחזוקה: ₪${quote.amount} ${quote.currency}`;
        const reasonHe =
          body.reasonHe ?? approvalReasonForTotal(quote.amount, "quote");

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe,
          reasonHe,
          payloadJson: JSON.stringify({
            kind: "autonomy.maintenance_quote_accept",
            hotelId: body.hotelId,
            quoteId: quote.id,
            maintenanceRequestId: body.maintenanceRequestId,
            vendorId: quote.vendorId,
            amount: quote.amount,
            currency: quote.currency,
            ...(body.requestTitle ? { requestTitle: body.requestTitle } : {}),
            executesVendorNotify: false,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            kind: body.kind,
            agentId: body.agentId,
            quoteId: quote.id,
            amount: quote.amount,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              amount: quote.amount,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act יאשר הצעת מחיר (ללא שליחה לקבלן)",
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
