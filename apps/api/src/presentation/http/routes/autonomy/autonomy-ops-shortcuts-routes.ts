import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  assertAutonomyAccess,
  departmentForFeedbackCategories,
} from "./autonomy-access.js";
import {
  suggestDirtyRoomsSchema,
  suggestFeedbackFollowupSchema,
  suggestTodaysArrivalsSchema,
} from "./autonomy-schemas.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { AutonomyRouteDeps } from "./autonomy-deps.js";

export function createAutonomyOpsShortcutsRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();



    /** Suggest housekeeping clean tasks for dirty rooms (HITL before Act). */
    routes.post("/suggest-dirty-rooms", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestDirtyRoomsSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, false);
        if (denied) return denied;
        const now = new Date().toISOString();

        const belongs = await deps.rooms.hotelBelongsToTenant(
          principal.scope.tenantId,
          hotelId,
        );
        if (!belongs) {
          return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
        }

        const allRooms = await deps.rooms.listByHotel(
          principal.scope.tenantId,
          hotelId,
        );
        const idFilter = body.roomIds ? new Set(body.roomIds) : null;
        const dirty = allRooms.filter(
          (room) =>
            room.status === "dirty" &&
            (idFilter === null || idFilter.has(String(room.id))),
        );
        if (dirty.length === 0) {
          return sendError(
            c,
            404,
            "NO_DIRTY_ROOMS",
            "No dirty rooms match the request",
          );
        }

        const roomPayload = dirty.map((room) => ({
          roomId: String(room.id),
          number: room.number,
          floor: room.floor,
          roomType: room.roomType,
        }));
        const numbers = roomPayload.map((r) => r.number).join(", ");

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe: `שיבוץ ניקיון: ${dirty.length} חדרים (${numbers})`,
          reasonHe:
            "הצעת agent.housekeeping — נדרש אישור מפקח לפני פתיחת משימות ניקיון במחלקה.",
          payloadJson: JSON.stringify({
            kind: "autonomy.housekeeping_clean_batch",
            hotelId: body.hotelId,
            rooms: roomPayload,
            markVacantOnAct: false,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest_dirty_rooms",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            roomCount: dirty.length,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              dirtyRoomCount: dirty.length,
              rooms: roomPayload,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act ייפתח משימות ניקיון (חדרים נשארים dirty)",
            },
          },
          201,
        );
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });



    /** Suggest front-office arrival-prep tasks for confirmed check-ins (HITL before Act). */
    routes.post("/suggest-todays-arrivals", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestTodaysArrivalsSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, false);
        if (denied) return denied;
        const now = new Date().toISOString();
        const checkInDate = body.checkInDate ?? now.slice(0, 10);

        const belongs = await deps.bookings.hotelBelongsToTenant(
          principal.scope.tenantId,
          hotelId,
        );
        if (!belongs) {
          return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
        }

        const all = await deps.bookings.listByHotel(
          principal.scope.tenantId,
          hotelId,
        );
        const idFilter = body.bookingIds ? new Set(body.bookingIds) : null;
        const arrivals = all.filter(
          (booking) =>
            booking.status === "confirmed" &&
            booking.checkInDate === checkInDate &&
            (idFilter === null || idFilter.has(String(booking.id))),
        );
        if (arrivals.length === 0) {
          return sendError(
            c,
            404,
            "NO_ARRIVALS",
            "No confirmed arrivals match the request",
          );
        }

        const arrivalPayload = arrivals.map((booking) => ({
          bookingId: String(booking.id),
          guestName: booking.guestName,
          roomNumber: booking.roomNumber,
          roomId: String(booking.roomId),
          checkOutDate: booking.checkOutDate,
        }));
        const roomsLabel = arrivalPayload
          .map((a) => a.roomNumber)
          .join(", ");

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe: `הכנת הגעות ${checkInDate}: ${arrivals.length} אורחים (חדרים ${roomsLabel})`,
          reasonHe:
            "הצעת agent.reception — נדרש אישור מפקח לפני פתיחת משימות הכנה בקבלה. ללא צ'ק-אין אוטומטי.",
          payloadJson: JSON.stringify({
            kind: "autonomy.reception_arrival_prep_batch",
            hotelId: body.hotelId,
            checkInDate,
            arrivals: arrivalPayload,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest_todays_arrivals",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            arrivalCount: arrivals.length,
            checkInDate,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              arrivalCount: arrivals.length,
              checkInDate,
              arrivals: arrivalPayload,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act ייפתח משימות הכנה בקבלה (ללא צ'ק-אין אוטומטי)",
            },
          },
          201,
        );
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });



    /** Suggest ops follow-up task for a guest feedback item (HITL; reuses department_task Act). */
    routes.post("/suggest-feedback-followup", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestFeedbackFollowupSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, false);
        if (denied) return denied;
        const now = new Date().toISOString();

        const item = await deps.feedback.findByIdInHotel(
          principal.scope.tenantId,
          hotelId,
          body.feedbackId,
        );
        if (!item) {
          return sendError(c, 404, "FEEDBACK_NOT_FOUND", "Feedback not found");
        }

        const departmentCode = departmentForFeedbackCategories(item.categories);
        const priority =
          item.rating <= 2 ? "urgent" : item.rating <= 3 ? "high" : "medium";
        const categoriesLabel =
          item.categories.length > 0 ? item.categories.join(", ") : "כללי";
        const commentLine = item.comment?.trim()
          ? item.comment.trim()
          : "(ללא הערה)";

        const title = `מעקב משוב אורח — דירוג ${item.rating}/5`;
        const description = [
          "מעקב אחרי משוב אורח (Suggest→Approve→Act).",
          `דירוג: ${item.rating}/5`,
          `קטגוריות: ${categoriesLabel}`,
          `הערה: ${commentLine}`,
          `מקור: ${item.source}`,
          `מזהה משוב: ${item.id}`,
          item.bookingId ? `הזמנה: ${item.bookingId}` : "ללא קישור להזמנה",
          "אין שליחת הודעה אוטומטית לאורח.",
        ].join("\n");

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe: `${title} · ${departmentCode}`,
          reasonHe:
            item.rating <= 3
              ? "דירוג נמוך — נדרש אישור מפקח לפני פתיחת משימת מעקב במחלקה."
              : "הצעת מעקב למשוב — נדרש אישור מפקח לפני פתיחת משימה.",
          payloadJson: JSON.stringify({
            kind: "autonomy.department_task",
            hotelId: body.hotelId,
            departmentCode,
            taskType: "guest_feedback_followup",
            title,
            description,
            priority,
            feedbackId: item.id,
            rating: item.rating,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest_feedback_followup",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            feedbackId: item.id,
            rating: item.rating,
            departmentCode,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              feedbackId: item.id,
              departmentCode,
              rating: item.rating,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act ייפתח משימת מעקב במחלקה (ללא הודעה לאורח)",
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
