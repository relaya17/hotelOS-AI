import type { PmsConnector } from "../types.js";
import { createDemoPmsConnector } from "./demo-pms.js";
import { createMewsStubPmsConnector } from "./mews-stub-pms.js";

export type PmsProviderId = "demo" | "mews_stub";

export function createPmsConnector(
  provider: PmsProviderId = "demo",
): PmsConnector {
  if (provider === "mews_stub") {
    return createMewsStubPmsConnector();
  }
  return createDemoPmsConnector();
}
