import type { PmsConnector } from "../types.js";
import { createVendorStubPmsConnector } from "./vendor-stub-pms.js";

/** Fidelio / Oracle Hospitality-shaped stub — no network. */
export function createFidelioStubPmsConnector(): PmsConnector {
  return createVendorStubPmsConnector({
    providerId: "fidelio.stub",
    guestLabel: "Fidelio Stub",
    roomPrefix: "fidelio",
    rooms: [
      { number: "118", status: "occupied", floor: "1" },
      { number: "120", status: "vacant", floor: "1" },
      { number: "220", status: "maintenance", floor: "2" },
    ],
  });
}
