import type { PmsConnector } from "@hotelos/connectors";
import type {
  AuditRepository,
  HotelRepository,
  OpsRepository,
  TurboRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { executeAutomationAction } from "./execute-automation-action.js";

export type FireAutomationTriggerInput = {
  readonly tenantId: string;
  readonly hotelId: string;
  readonly triggerKey: string;
  readonly detail: string;
  readonly bookingId?: string;
  readonly guestName?: string;
  readonly actorUserId?: string;
  readonly checkInDate?: string;
  readonly checkOutDate?: string;
  readonly roomType?: string;
  readonly roomNumber?: string | null;
};

/**
 * Runs enabled Turbo rules for a trigger and applies real side-effects.
 */
export async function fireAutomationTrigger(
  deps: {
    readonly turbo: TurboRepository;
    readonly ops?: OpsRepository;
    readonly hotels?: HotelRepository;
    readonly pms?: PmsConnector;
    readonly audit?: AuditRepository;
  },
  input: FireAutomationTriggerInput,
): Promise<
  readonly {
    readonly automationId: string;
    readonly status: string;
    readonly effect: string;
  }[]
> {
  const tenantId = Ids.tenant(input.tenantId);
  const hotelId = Ids.hotel(input.hotelId);
  const rules = await deps.turbo.listAutomations(tenantId);
  const matched = rules.filter(
    (rule) => rule.enabled && rule.triggerKey === input.triggerKey,
  );
  const results: {
    automationId: string;
    status: string;
    effect: string;
  }[] = [];

  for (const rule of matched) {
    const run = await deps.turbo.runAutomation(
      tenantId,
      rule.id,
      input.detail,
    );
    if (!run) {
      results.push({
        automationId: rule.id,
        status: "skipped",
        effect: "skipped",
      });
      continue;
    }

    const effect = await executeAutomationAction(deps, {
      tenantId,
      hotelId,
      actionKey: rule.actionKey,
      triggerKey: rule.triggerKey,
      detail: input.detail,
      ...(input.bookingId !== undefined ? { bookingId: input.bookingId } : {}),
      ...(input.guestName !== undefined ? { guestName: input.guestName } : {}),
      ...(input.actorUserId !== undefined
        ? { actorUserId: input.actorUserId }
        : {}),
      ...(input.checkInDate !== undefined
        ? { checkInDate: input.checkInDate }
        : {}),
      ...(input.checkOutDate !== undefined
        ? { checkOutDate: input.checkOutDate }
        : {}),
      ...(input.roomType !== undefined ? { roomType: input.roomType } : {}),
      ...(input.roomNumber !== undefined
        ? { roomNumber: input.roomNumber }
        : {}),
    });

    results.push({
      automationId: rule.id,
      status: run.status,
      effect: effect.effect,
    });
  }

  return results;
}
