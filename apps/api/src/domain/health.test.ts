import assert from "node:assert/strict";
import { test } from "node:test";
import { createHealthStatus } from "./health.js";

test("createHealthStatus returns ok payload with recordings backend", () => {
  const health = createHealthStatus("0.0.1", {
    backend: "local",
    root: "/tmp/recordings",
  });
  assert.deepEqual(health, {
    status: "ok",
    service: "api",
    version: "0.0.1",
    recordings: {
      backend: "local",
      root: "/tmp/recordings",
    },
  });
});
