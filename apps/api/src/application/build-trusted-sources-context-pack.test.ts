import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TrustedSourcesRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { buildTrustedSourcesContextPack } from "./build-trusted-sources-context-pack.js";

describe("buildTrustedSourcesContextPack", () => {
  it("returns undefined when no allowlisted sources match", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "בנק ישראל",
          url: "https://www.boi.org.il",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה מדיניות הביטולים בחדרים?",
    );
    assert.equal(pack, undefined);
  });

  it("formats matching Trusted Sources into an authorized pack", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "בנק ישראל — נתוני מקרו",
          url: "https://www.boi.org.il",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "s2",
          tenantId: "t1",
          title: "רשות המסים בישראל",
          url: "https://www.gov.il/he/departments/israel_tax_authority",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה אומר בנק ישראל על נתוני מקרו וריבית?",
    );
    assert.ok(pack);
    assert.match(pack, /Trusted Sources/);
    assert.match(pack, /בנק ישראל/);
    assert.match(pack, /boi\.org\.il/);
    // Stop-term "ישראל" ignored; "בנק"/"מקרו" rank the bank above tax authority.
    assert.equal(pack.includes("רשות המסים"), false);
  });
});
