import type { PmsConnector } from "../types.js";
import { createClockStubPmsConnector } from "./clock-stub-pms.js";
import { createDemoPmsConnector } from "./demo-pms.js";
import { createFidelioStubPmsConnector } from "./fidelio-stub-pms.js";
import {
  createMewsHttpPmsConnector,
  type MewsHttpConfig,
} from "./mews-http-pms.js";
import { createMewsStubPmsConnector } from "./mews-stub-pms.js";
import { createOperaStubPmsConnector } from "./opera-stub-pms.js";
import { createProtelStubPmsConnector } from "./protel-stub-pms.js";

/** Selectable PMS adapters — stubs prove switching; `mews` is live HTTP. */
export type PmsProviderId =
  | "demo"
  | "mews_stub"
  | "mews"
  | "opera_stub"
  | "protel_stub"
  | "fidelio_stub"
  | "clock_stub";

export type CreatePmsConnectorOptions = {
  readonly provider?: PmsProviderId;
  readonly mews?: MewsHttpConfig;
};

function withInventoryNotify(connector: PmsConnector): PmsConnector {
  if (connector.notifyInventoryChanged) return connector;
  return {
    ...connector,
    async notifyInventoryChanged(event) {
      return {
        status: "accepted",
        detail: `${connector.providerId}: channel inventory sync queued for booking ${event.bookingId}`,
      };
    },
  };
}

export function createPmsConnector(
  providerOrOptions: PmsProviderId | CreatePmsConnectorOptions = "demo",
): PmsConnector {
  const options: CreatePmsConnectorOptions =
    typeof providerOrOptions === "string"
      ? { provider: providerOrOptions }
      : providerOrOptions;
  const provider = options.provider ?? "demo";

  if (provider === "mews_stub") {
    return withInventoryNotify(createMewsStubPmsConnector());
  }
  if (provider === "opera_stub") {
    return withInventoryNotify(createOperaStubPmsConnector());
  }
  if (provider === "protel_stub") {
    return withInventoryNotify(createProtelStubPmsConnector());
  }
  if (provider === "fidelio_stub") {
    return withInventoryNotify(createFidelioStubPmsConnector());
  }
  if (provider === "clock_stub") {
    return withInventoryNotify(createClockStubPmsConnector());
  }
  if (provider === "mews") {
    if (!options.mews) {
      throw new Error("Mews config is required when PMS_PROVIDER=mews");
    }
    return withInventoryNotify(createMewsHttpPmsConnector(options.mews));
  }
  return withInventoryNotify(createDemoPmsConnector());
}
