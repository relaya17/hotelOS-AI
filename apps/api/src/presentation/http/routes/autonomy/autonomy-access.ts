import { type Context } from "hono";
import {
  canAccessHotel,
  canDecideOpsHitl,
  canOperateProcurement,
  type AuthPrincipal,
} from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import {
  PROCUREMENT_CHAIN_APPROVAL_ILS,
  PROCUREMENT_HOTEL_APPROVAL_ILS,
} from "../../../../application/execute-approval-act.js";
import { sendError } from "../../errors.js";

export function assertAutonomyAccess(
  c: Context,
  principal: AuthPrincipal,
  hotelId: HotelId,
  money: boolean,
): Response | null {
  if (!canAccessHotel(principal, hotelId)) {
    return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
  }
  if (money) {
    if (!canOperateProcurement(principal)) {
      return sendError(
        c,
        403,
        "ROLE_REQUIRED",
        "Money Suggest requires a procurement/management role",
      );
    }
  } else if (!canDecideOpsHitl(principal)) {
    return sendError(
      c,
      403,
      "ROLE_REQUIRED",
      "Suggest requires an ops/management role",
    );
  }
  return null;
}

export function departmentForFeedbackCategories(
  categories: readonly string[],
): string {
  const joined = categories.join(" ").toLowerCase();
  if (/ניקיון|clean|housekeep|מגבת|מצע/.test(joined)) return "housekeeping";
  if (/תחזוקה|maintenance|מזגן|חשמל|אינסטל|תיקון/.test(joined)) {
    return "maintenance";
  }
  if (/אוכל|מזון|מסעדה|food|f&b|ארוח/.test(joined)) return "front_office";
  return "front_office";
}

export function approvalReasonForTotal(
  total: number,
  purpose: "po" | "quote" | "send",
): string {
  if (total >= PROCUREMENT_CHAIN_APPROVAL_ILS) {
    if (purpose === "quote") {
      return `סכום הצעה ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני קבלת הצעת מחיר.`;
    }
    if (purpose === "send") {
      return `סכום PO ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני סימון שליחה לספק.`;
    }
    return `סכום משוער ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני טיוטת PO.`;
  }
  if (total >= PROCUREMENT_HOTEL_APPROVAL_ILS) {
    if (purpose === "quote") {
      return `סכום הצעה ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני קבלת הצעת מחיר.`;
    }
    if (purpose === "send") {
      return `סכום PO ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני סימון שליחה לספק.`;
    }
    return `סכום משוער ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני טיוטת PO.`;
  }
  if (purpose === "quote") {
    return `הצעת מחיר תחזוקה בסך ₪${total} — אישור אנושי לפני Accept (ללא שליחה לקבלן).`;
  }
  if (purpose === "send") {
    return `שליחת PO בסך ₪${total} — אישור אנושי לפני סימון sent (ללא אימייל אמיתי ב-MVP).`;
  }
  return `הצעת רכש AI בסך ₪${total} — אישור אנושי לפני יצירת טיוטת PO (לא נשלח לספק).`;
}
