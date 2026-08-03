import { randomUUID } from "node:crypto";
import type { OpsRepository, TurboRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";

export type FireAutomationTriggerInput = {
  readonly tenantId: string;
  readonly hotelId: string;
  readonly triggerKey: string;
  readonly detail: string;
  readonly bookingId?: string;
  readonly guestName?: string;
};

/**
 * Runs enabled Turbo rules for a trigger and applies real side-effects where
 * we already have safe ops hooks (e.g. reception queue on booking.created).
 */
export async function fireAutomationTrigger(
  deps: {
    readonly turbo: TurboRepository;
    readonly ops?: OpsRepository;
  },
  input: FireAutomationTriggerInput,
): Promise<readonly { readonly automationId: string; readonly status: string }[]> {
  const tenantId = Ids.tenant(input.tenantId);
  const rules = await deps.turbo.listAutomations(tenantId);
  const matched = rules.filter(
    (rule) => rule.enabled && rule.triggerKey === input.triggerKey,
  );
  const results: { automationId: string; status: string }[] = [];

  for (const rule of matched) {
    const run = await deps.turbo.runAutomation(
      tenantId,
      rule.id,
      input.detail,
    );
    if (!run) {
      results.push({ automationId: rule.id, status: "skipped" });
      continue;
    }

    if (rule.actionKey === "notify.reception" && deps.ops) {
      try {
        const hotelId = Ids.hotel(input.hotelId);
        await deps.ops.ensureStandardDepartments(
          tenantId,
          hotelId,
          new Date().toISOString(),
        );
        const dept = await deps.ops.findDepartmentByCode(
          tenantId,
          hotelId,
          "front_office",
        );
        if (dept) {
          const guest = input.guestName ?? "אורח";
          const bookingRef = input.bookingId
            ? `הזמנה ${input.bookingId.slice(0, 8)}`
            : "הזמנה חדשה";
          await deps.ops.createTask({
            id: randomUUID(),
            tenantId,
            hotelId,
            departmentId: dept.id,
            taskType: "arrival_prep",
            title: `הכנה להגעה · ${guest}`,
            description: `${bookingRef} · נוצר אוטומטית מ־booking.created`,
            priority: "high",
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // never fail the booking path on ops side-effects
      }
    }

    results.push({ automationId: rule.id, status: run.status });
  }

  return results;
}
