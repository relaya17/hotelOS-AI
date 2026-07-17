import assert from "node:assert/strict";
import { test } from "node:test";
import { createHealthStatus } from "./health.js";

test("createHealthStatus returns ok payload", () => {
  const health = createHealthStatus("0.0.1");
  assert.deepEqual(health, {
    status: "ok",
    service: "api",
    version: "0.0.1",
  });
});
