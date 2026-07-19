import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TurboRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { buildAccountingContextPack } from "./build-accounting-context-pack.js";

describe("buildAccountingContextPack", () => {
  it("returns undefined when ledger is empty", async () => {
    const turbo = {
      listAccounts: async () => [],
      listJournal: async () => [],
    } as unknown as TurboRepository;

    const pack = await buildAccountingContextPack(
      turbo,
      Ids.tenant("11111111-1111-4111-8111-111111111111"),
    );
    assert.equal(pack, undefined);
  });

  it("summarizes accounts and recent journal with citation hints", async () => {
    const turbo = {
      listAccounts: async () => [
        {
          id: "1",
          code: "1000",
          name: "Cash",
          accountType: "asset",
          currency: "ILS",
          balanceMinor: 125_050,
        },
        {
          id: "2",
          code: "2000",
          name: "AP",
          accountType: "liability",
          currency: "ILS",
          balanceMinor: -40_000,
        },
      ],
      listJournal: async () => [
        {
          id: "j1",
          accountCode: "1000",
          accountName: "Cash",
          memo: "Deposit",
          debit: 1000,
          credit: 0,
          entryDate: "2026-07-18",
          sourceSystem: "demo",
        },
      ],
    } as unknown as TurboRepository;

    const pack = await buildAccountingContextPack(
      turbo,
      Ids.tenant("11111111-1111-4111-8111-111111111111"),
    );
    assert.ok(pack);
    assert.match(pack, /Context pack — Accounting ledger/);
    assert.match(pack, /1000 Cash/);
    assert.match(pack, /1250\.50 ILS/);
    assert.match(pack, /Deposit/);
    assert.match(pack, /accountant/);
  });
});
