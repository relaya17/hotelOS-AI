import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("hashPassword + verifyPassword succeed for correct password", async () => {
  const hash = await hashPassword("Correct-Horse-Battery-Staple-9");
  assert.equal(await verifyPassword("Correct-Horse-Battery-Staple-9", hash), true);
});

test("verifyPassword fails for wrong password", async () => {
  const hash = await hashPassword("Correct-Horse-Battery-Staple-9");
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
