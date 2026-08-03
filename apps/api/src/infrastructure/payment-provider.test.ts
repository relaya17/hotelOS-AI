import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPaymentProvider } from "./payment-provider.js";

describe("createPaymentProvider", () => {
  it("demo charges without client secret", async () => {
    const payments = createPaymentProvider({ provider: "demo" });
    const charged = await payments.charge({
      id: "pay-1",
      amountMinor: 10000,
      currency: "ILS",
      description: "test",
    });
    assert.equal(charged.status, "succeeded");
    assert.equal(charged.provider, "hotelos.payments");
    assert.equal(charged.clientSecret, undefined);
  });

  it("stripe_stub returns a fake client secret then succeeds", async () => {
    const payments = createPaymentProvider({ provider: "stripe_stub" });
    const created = await payments.createIntent({
      id: "pay-2",
      amountMinor: 5000,
      currency: "ILS",
      description: "stub",
    });
    assert.equal(created.status, "requires_confirmation");
    assert.ok(created.clientSecret?.startsWith("pi_stub_"));
    const confirmed = await payments.confirmIntent({ id: created.id });
    assert.equal(confirmed.status, "succeeded");
  });

  it("external posts to gateway", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (String(input).endsWith("/intents")) {
        return new Response(
          JSON.stringify({
            id: "pay-3",
            status: "requires_confirmation",
            providerRef: "ext_1",
            clientSecret: "sec",
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: "succeeded" }), {
        status: 200,
      });
    }) as typeof fetch;

    const payments = createPaymentProvider(
      {
        provider: "external",
        externalUrl: "https://pay.example.com",
        externalToken: "tok",
      },
      fetchImpl,
    );
    const charged = await payments.charge({
      id: "pay-3",
      amountMinor: 1200,
      currency: "ILS",
      description: "ext",
    });
    assert.equal(charged.status, "succeeded");
    assert.equal(calls.length, 2);
  });
});
