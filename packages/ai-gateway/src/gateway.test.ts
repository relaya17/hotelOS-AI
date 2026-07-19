import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAiGateway } from "./gateway.js";

const agents = [
  {
    id: "agent.cio",
    nameHe: "יועץ־על",
    domain: "intelligence",
    autonomyMode: "suggest" as const,
  },
];

describe("createAiGateway", () => {
  it("answers via deterministic provider without API key", async () => {
    const gateway = createAiGateway({ agents });
    const result = await gateway.invoke({
      agentId: "agent.cio",
      message: "מה מצב התפוסה היום?",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "00000000-0000-4000-8000-000000000001",
    });
    assert.equal(result.provider, "deterministic");
    assert.equal(result.agentId, "agent.cio");
    assert.ok(result.answerHe.includes("דטרמיניסטי"));
  });

  it("rejects unknown agents", async () => {
    const gateway = createAiGateway({ agents });
    await assert.rejects(
      () =>
        gateway.invoke({
          agentId: "agent.does-not-exist",
          message: "שלום",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "00000000-0000-4000-8000-000000000001",
        }),
      /Unknown agentId/,
    );
  });

  it("embeds texts via the deterministic provider", async () => {
    const gateway = createAiGateway({ agents });
    const result = await gateway.embed(["נוהל קבלה", "נוהל קבלה"]);
    assert.equal(result.model, "hotelos.deterministic.embed.v1");
    assert.equal(result.vectors.length, 2);
    assert.equal(result.vectors[0]?.length, result.vectors[1]?.length);
    assert.ok((result.vectors[0]?.length ?? 0) > 0);
  });
});
