import type { PmsConnector } from "../types.js";
import { createVendorStubPmsConnector } from "./vendor-stub-pms.js";

/** Protel-shaped stub — no network. */
export function createProtelStubPmsConnector(): PmsConnector {
  return createVendorStubPmsConnector({
    providerId: "protel.stub",
    guestLabel: "Protel Stub",
    roomPrefix: "protel",
    rooms: [
      { number: "312", status: "occupied", floor: "3" },
      { number: "314", status: "vacant", floor: "3" },
      { number: "501", status: "dirty", floor: "5" },
    ],
  });
}
