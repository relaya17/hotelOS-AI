import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPaymentProvider,
  describePaymentPublicStatus,
} from "./payment-provider.js";

describe("describePaymentPublicStatus", () => {
  it("labels demo without claiming PCI", () => {
    const payments = createPaymentProvider({ provider: "demo" });
    const status = describePaymentPublicStatus(payments);
    assert.equal(status.mode, "demo");
    assert.equal(status.storesPan, false);
    assert.equal(status.pciDssCertified, false);
    assert.match(status.labelHe, /הדגמה/);
  });

  it("labels external honestly", () => {
    const payments = createPaymentProvider({
      provider: "external",
      externalUrl: "https://pay.example",
      externalToken: "tok",
    });
    const status = describePaymentPublicStatus(payments);
    assert.equal(status.mode, "external");
    assert.equal(status.pciDssCertified, false);
    assert.match(status.labelHe, /ספק חיצוני/);
  });
});
