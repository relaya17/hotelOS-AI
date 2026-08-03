import type { PmsConnector } from "../types.js";
import { createDemoPmsConnector } from "./demo-pms.js";
import {
  createMewsHttpPmsConnector,
  type MewsHttpConfig,
} from "./mews-http-pms.js";
import { createMewsStubPmsConnector } from "./mews-stub-pms.js";
import { createOperaStubPmsConnector } from "./opera-stub-pms.js";

export type PmsProviderId = "demo" | "mews_stub" | "mews" | "opera_stub";

export type CreatePmsConnectorOptions = {
  readonly provider?: PmsProviderId;
  readonly mews?: MewsHttpConfig;
};

export function createPmsConnector(
  providerOrOptions: PmsProviderId | CreatePmsConnectorOptions = "demo",
): PmsConnector {
  const options: CreatePmsConnectorOptions =
    typeof providerOrOptions === "string"
      ? { provider: providerOrOptions }
      : providerOrOptions;
  const provider = options.provider ?? "demo";

  if (provider === "mews_stub") {
    return createMewsStubPmsConnector();
  }
  if (provider === "opera_stub") {
    return createOperaStubPmsConnector();
  }
  if (provider === "mews") {
    if (!options.mews) {
      throw new Error("Mews config is required when PMS_PROVIDER=mews");
    }
    return createMewsHttpPmsConnector(options.mews);
  }
  return createDemoPmsConnector();
}
