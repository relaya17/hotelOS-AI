import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSseFrameParser, parseSseText } from "./sse-frame-parser.js";

describe("sse-frame-parser", () => {
  it("parses event and data lines into frames", () => {
    const frames = parseSseText(
      'event: heartbeat\ndata: {"at":"2026-08-04T00:00:00Z"}\n\n' +
        "event: snapshot\n" +
        'data: {"generatedAt":"2026-08-04T00:00:01Z"}\n\n',
    );

    assert.equal(frames.length, 2);
    assert.equal(frames[0]?.event, "heartbeat");
    assert.deepEqual(frames[0]?.dataLines, ['{"at":"2026-08-04T00:00:00Z"}']);
    assert.equal(frames[1]?.event, "snapshot");
    assert.deepEqual(frames[1]?.dataLines, [
      '{"generatedAt":"2026-08-04T00:00:01Z"}',
    ]);
  });

  it("buffers partial frames across chunks", () => {
    const frames: { event?: string; dataLines: readonly string[] }[] = [];
    const parser = createSseFrameParser((frame) => {
      frames.push(frame);
    });

    parser.push("event: error\nda");
    parser.push('ta: {"message":"upstream"}\n');
    parser.push("\n");

    assert.equal(frames.length, 1);
    assert.equal(frames[0]?.event, "error");
    assert.deepEqual(frames[0]?.dataLines, ['{"message":"upstream"}']);
  });

  it("ignores comment lines", () => {
    const frames = parseSseText(": keep-alive\n\n");
    assert.equal(frames.length, 0);
  });
});
