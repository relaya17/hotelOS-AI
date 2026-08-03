import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_PILOT_INTEGRATION_DOMAIN_IDS,
  DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS,
  resolveEnabledIntegrationDomains,
} from "../src/integration-domains.js";

describe("resolveEnabledIntegrationDomains", () => {
  it("returns all non-deferred domains when column is null", () => {
    const resolved = resolveEnabledIntegrationDomains(null);
    assert.deepEqual(resolved, ALL_PILOT_INTEGRATION_DOMAIN_IDS);
    assert.ok(resolved.includes("pms"));
    assert.ok(resolved.includes("predictive_maintenance"));
    assert.ok(!resolved.includes("access" as (typeof resolved)[number]));
  });

  it("returns pilot defaults when stored JSON is an empty array", () => {
    assert.deepEqual(
      resolveEnabledIntegrationDomains("[]"),
      DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS,
    );
  });

  it("returns stored ids when valid", () => {
    assert.deepEqual(
      resolveEnabledIntegrationDomains('["pms","reputation"]'),
      ["pms", "reputation"],
    );
  });

  it("filters unknown ids from stored JSON", () => {
    assert.deepEqual(
      resolveEnabledIntegrationDomains('["pms","unknown_domain"]'),
      ["pms"],
    );
  });
});
