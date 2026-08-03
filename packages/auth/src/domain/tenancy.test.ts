import assert from "node:assert/strict";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import {
  canAccessHotel,
  canAccessSensitiveHrDocuments,
  canApproveLedgerClose,
  hasAnyRole,
  type AuthPrincipal,
} from "./tenancy.js";

test("hotel-scoped principal cannot access another hotel", () => {
  const principal: AuthPrincipal = {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles: ["reception"],
    scope: {
      tenantId: Ids.tenant("22222222-2222-4222-8222-222222222222"),
      hotelId: Ids.hotel("33333333-3333-4333-8333-333333333333"),
    },
  };

  const otherHotel = Ids.hotel("44444444-4444-4444-8444-444444444444");
  assert.equal(canAccessHotel(principal, otherHotel), false);
});

test("tenant-scoped principal can access hotels (pending ABAC refine)", () => {
  const principal: AuthPrincipal = {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles: ["executive"],
    scope: {
      tenantId: Ids.tenant("22222222-2222-4222-8222-222222222222"),
    },
  };

  const hotel = Ids.hotel("33333333-3333-4333-8333-333333333333");
  assert.equal(canAccessHotel(principal, hotel), true);
});

test("hasAnyRole matches at least one role", () => {
  const principal: AuthPrincipal = {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles: ["admin", "executive"],
    scope: {
      tenantId: Ids.tenant("22222222-2222-4222-8222-222222222222"),
    },
  };
  assert.equal(hasAnyRole(principal, ["hr"]), false);
  assert.equal(hasAnyRole(principal, ["hr", "admin"]), true);
});

test("sensitive HR docs require dedicated hr role (not admin)", () => {
  const adminOnly: AuthPrincipal = {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles: ["admin", "executive"],
    scope: {
      tenantId: Ids.tenant("22222222-2222-4222-8222-222222222222"),
    },
  };
  const hrUser: AuthPrincipal = {
    ...adminOnly,
    roles: ["hr"],
  };
  assert.equal(canAccessSensitiveHrDocuments(adminOnly), false);
  assert.equal(canAccessSensitiveHrDocuments(hrUser), true);
});

test("canApproveLedgerClose requires accountant or cfo", () => {
  const adminOnly: AuthPrincipal = {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles: ["admin"],
    scope: { tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111") },
  };
  const cfo: AuthPrincipal = { ...adminOnly, roles: ["cfo"] };
  const accountant: AuthPrincipal = { ...adminOnly, roles: ["accountant"] };
  assert.equal(canApproveLedgerClose(adminOnly), false);
  assert.equal(canApproveLedgerClose(cfo), true);
  assert.equal(canApproveLedgerClose(accountant), true);
});
