import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  canAccessHotel,
  canApproveMoneyAmount,
  canDecideOpsHitl,
  canOperateProcurement,
} from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import type { AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { OpsRouteDeps } from "./ops-deps.js";
import { createResolveOpsHotelId, hotelIdSchema, type OpsContext } from "./ops-hotel.js";

import { buildIncidentCenter } from "../../../../application/build-incident-center.js";
import { mapSecurityWebhook } from "../../../../application/map-security-webhook.js";
import { listOpsAnomalies } from "../../../../application/run-anomaly-scan.js";
import { errorEventSchema } from "./ops-schemas.js";


export function createOpsIncidentsRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

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

  /** Vendor adapter entry — e.g. POST /security-events/ingest/example_vms or /milestone */
  routes.post("/security-events/ingest/:provider", async (c) => {
    try {
      const providerParsed = z
        .enum(["generic", "example_vms", "milestone", "genetec"])
        .safeParse(c.req.param("provider"));
      if (!providerParsed.success) {
        return sendError(
          c,
          400,
          "UNKNOWN_PROVIDER",
          "Supported providers: generic, example_vms, milestone, genetec",
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

  // ---- Incident center (security + IT + critical maintenance aggregation) ----

  routes.get("/incidents", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(
        principal.scope.tenantId,
      );
      const rawHotelId = c.req.query("hotelId");

      let scopedHotelIds: HotelId[];
      if (rawHotelId) {
        const parsed = hotelIdSchema.safeParse(rawHotelId);
        if (!parsed.success) {
          return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
        }
        const hotelId = Ids.hotel(parsed.data);
        if (!canAccessHotel(principal, hotelId)) {
          return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
        }
        if (!tenantHotels.some((hotel) => hotel.id === hotelId)) {
          return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
        }
        scopedHotelIds = [hotelId];
      } else {
        scopedHotelIds = (
          principal.scope.hotelId
            ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
            : tenantHotels
        ).map((hotel) => hotel.id);
      }

      const center = await buildIncidentCenter(
        {
          ops: deps.ops,
          maintenance: deps.maintenance,
          hotels: deps.hotels,
        },
        principal.scope.tenantId,
        scopedHotelIds,
      );
      return c.json({ data: center });
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

  return routes;
}
