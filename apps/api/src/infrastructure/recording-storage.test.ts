import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createObjectStorage } from "./object-storage.js";
import { createRecordingStorage } from "./recording-storage.js";

describe("createObjectStorage (local)", () => {
  it("writes and reads bytes under root", async () => {
    const root = mkdtempSync(join(tmpdir(), "hotelos-recordings-"));
    try {
      const storage = createObjectStorage({ root });
      assert.equal(storage.backend, "local");

      await storage.put("tenant-a/chain-b/room-c/rec.webm", Buffer.from("audio"));
      const bytes = await storage.get("tenant-a/chain-b/room-c/rec.webm");
      assert.equal(bytes?.toString(), "audio");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe storage keys", async () => {
    const root = mkdtempSync(join(tmpdir(), "hotelos-recordings-"));
    try {
      const storage = createObjectStorage({ root });
      await assert.rejects(
        () => storage.put("bad\0key", Buffer.from("x")),
        /INVALID_STORAGE_KEY/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createObjectStorage (vercel_blob mock)", () => {
  it("uses pathname keys with slashes (not URL-encoded)", async () => {
    const calls: Array<{ op: "put" | "get"; key: string; bytes?: Buffer }> = [];
    const storage = createObjectStorage({
      root: "/unused-on-blob",
      blobClient: {
        async put(key, bytes) {
          calls.push({ op: "put", key, bytes });
          return { url: "https://example.blob/rec.webm" };
        },
        async get(key) {
          calls.push({ op: "get", key });
          return Buffer.from("blob-bytes");
        },
      },
    });

    assert.equal(storage.backend, "vercel_blob");
    const key = "tenant/chain/room/recording-id.webm";
    await storage.put(key, Buffer.from("payload"));
    const bytes = await storage.get(key);

    assert.equal(bytes?.toString(), "blob-bytes");
    assert.deepEqual(calls, [
      { op: "put", key, bytes: Buffer.from("payload") },
      { op: "get", key },
    ]);
    assert.ok(!calls.some((call) => call.key.includes("%2F")));
  });
});

describe("createRecordingStorage", () => {
  it("builds tenant-scoped storage keys", () => {
    const root = mkdtempSync(join(tmpdir(), "hotelos-recordings-"));
    try {
      const storage = createRecordingStorage(root);
      const key = storage.buildStorageKey({
        tenantId: "t1",
        chainId: "c1",
        roomId: "r1",
        recordingId: "rec1",
        extension: "webm",
      });
      assert.equal(key, "t1/c1/r1/rec1.webm");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("round-trips through local disk", async () => {
    const root = mkdtempSync(join(tmpdir(), "hotelos-recordings-"));
    try {
      const storage = createRecordingStorage(root);
      const key = storage.buildStorageKey({
        tenantId: "t1",
        chainId: "c1",
        roomId: "r1",
        recordingId: "rec1",
        extension: "webm",
      });
      await storage.write(key, Buffer.from("meet-recording"));
      const bytes = await storage.read(key);
      assert.equal(bytes?.toString(), "meet-recording");
      assert.ok(storage.absolutePathForKey(key)?.endsWith("rec1.webm"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
