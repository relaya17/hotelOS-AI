import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDemoAuthEnabled, isDemoSeedEnabled } from "./demo-flags.js";

describe("demo flags", () => {
  it("defaults on outside production", () => {
    assert.equal(
      isDemoAuthEnabled({ NODE_ENV: "development", ALLOW_DEMO_AUTH: "" }),
      true,
    );
    assert.equal(
      isDemoSeedEnabled({ NODE_ENV: "test", ALLOW_DEMO_SEED: "" }),
      true,
    );
  });

  it("defaults off in production", () => {
    assert.equal(
      isDemoAuthEnabled({ NODE_ENV: "production", ALLOW_DEMO_AUTH: "" }),
      false,
    );
    assert.equal(
      isDemoSeedEnabled({ NODE_ENV: "production", ALLOW_DEMO_SEED: "" }),
      false,
    );
  });

  it("honors explicit overrides", () => {
    assert.equal(
      isDemoAuthEnabled({ NODE_ENV: "production", ALLOW_DEMO_AUTH: "true" }),
      true,
    );
    assert.equal(
      isDemoSeedEnabled({ NODE_ENV: "development", ALLOW_DEMO_SEED: "false" }),
      false,
    );
  });
});
