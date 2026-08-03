import type { PmsConnector } from "../types.js";
import { createVendorStubPmsConnector } from "./vendor-stub-pms.js";

/** Clock PMS-shaped stub — no network. */
export function createClockStubPmsConnector(): PmsConnector {
  return createVendorStubPmsConnector({
    providerId: "clock.stub",
    guestLabel: "Clock Stub",
    roomPrefix: "clock",
    rooms: [
      { number: "08", status: "occupied", floor: "0" },
      { number: "12", status: "vacant", floor: "1" },
      { number: "22", status: "dirty", floor: "2" },
    ],
  });
}
