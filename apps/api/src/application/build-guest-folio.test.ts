import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGuestFolio } from "./build-guest-folio.js";

describe("buildGuestFolio", () => {
  it("calculates room and breakfast charges using the room type rate", () => {
    const folio = buildGuestFolio({
      checkInDate: "2026-08-03",
      checkOutDate: "2026-08-06",
      roomNumber: "402",
      roomType: "deluxe",
      currency: "ILS",
    });

    assert.equal(folio.status, "estimate");
    assert.equal(folio.nights, 3);
    assert.equal(folio.currency, "ILS");
    assert.equal(folio.checkInDate, "2026-08-03");
    assert.equal(folio.checkOutDate, "2026-08-06");
    assert.equal(folio.roomNumber, "402");
    assert.equal(folio.roomType, "deluxe");
    assert.deepEqual(folio.lines, [
      { label: "לינה · חדר 402 (3 לילות)", amount: 1650 },
      { label: "ארוחת בוקר (3 לילות)", amount: 255 },
    ]);
    assert.equal(folio.subtotal, 1905);
    assert.equal(folio.tax, 323.85);
    assert.equal(folio.total, 2228.85);
    assert.equal(folio.paid, 0);
    assert.equal(folio.balanceDue, 2228.85);
  });

  it("uses the standard rate for an unknown room type", () => {
    const folio = buildGuestFolio({
      checkInDate: "2026-08-03",
      checkOutDate: "2026-08-04",
      roomNumber: "101",
      roomType: "penthouse",
      currency: "USD",
    });

    assert.equal(folio.subtotal, 535);
    assert.equal(folio.tax, 90.95);
    assert.equal(folio.total, 625.95);
    assert.equal(folio.balanceDue, 625.95);
  });
});
