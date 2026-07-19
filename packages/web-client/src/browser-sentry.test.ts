import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installBrowserSentry } from "./browser-sentry.js";

describe("installBrowserSentry", () => {
  it("is a no-op when DSN is empty (Node / no window)", () => {
    assert.doesNotThrow(() => {
      installBrowserSentry({ appName: "admin" });
      installBrowserSentry({ appName: "admin", dsn: "" });
      installBrowserSentry({ appName: "admin", dsn: "   " });
    });
  });
});
