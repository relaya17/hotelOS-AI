import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitKnowledgeBodyIntoChunks } from "@hotelos/database";

describe("splitKnowledgeBodyIntoChunks", () => {
  it("returns a single chunk for short bodies", () => {
    const chunks = splitKnowledgeBodyIntoChunks("שורה אחת קצרה");
    assert.deepEqual(chunks, ["שורה אחת קצרה"]);
  });

  it("splits long multi-paragraph bodies", () => {
    const para = "מילה ".repeat(200).trim();
    const body = `${para}\n\n${para}\n\n${para}`;
    const chunks = splitKnowledgeBodyIntoChunks(body, 400);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((c) => c.length <= 400));
  });
});
