import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";

export type ObjectStorageBackend = "local" | "vercel_blob";

/**
 * Managed object storage for recordings / future HR binaries.
 * - local: disk under `root` (dev + default)
 * - vercel_blob: when BLOB_READ_WRITE_TOKEN is set (production)
 *
 * Sensitive HR docs stay hash-only in DB per PO — they do not use this store.
 */
export type ObjectStorage = {
  readonly backend: ObjectStorageBackend;
  readonly root: string;
  put: (
    key: string,
    bytes: Buffer,
    contentType?: string,
  ) => Promise<{ readonly url?: string }>;
  get: (key: string) => Promise<Buffer | null>;
};

function assertSafeKey(key: string): string {
  const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (
    normalized.length === 0 ||
    normalized.includes("\0") ||
    normalized.startsWith("..")
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return normalized.replace(/\\/g, "/");
}

export function createObjectStorage(input: {
  readonly root: string;
  readonly blobToken?: string;
}): ObjectStorage {
  const root = resolve(input.root);
  const blobToken = input.blobToken?.trim() ?? "";

  if (blobToken.length > 0) {
    return {
      backend: "vercel_blob",
      root,
      async put(key, bytes, contentType = "application/octet-stream") {
        const safeKey = assertSafeKey(key);
        const response = await fetch(
          `https://blob.vercel-storage.com/${encodeURIComponent(safeKey)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${blobToken}`,
              "Content-Type": contentType,
              "x-api-version": "7",
            },
            body: new Uint8Array(bytes),
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`BLOB_PUT_FAILED:${response.status}:${text}`);
        }
        const json = (await response.json()) as { url?: string };
        return { ...(json.url !== undefined ? { url: json.url } : {}) };
      },
      async get(key) {
        const safeKey = assertSafeKey(key);
        const response = await fetch(
          `https://blob.vercel-storage.com/${encodeURIComponent(safeKey)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${blobToken}`,
              "x-api-version": "7",
            },
          },
        );
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(`BLOB_GET_FAILED:${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      },
    };
  }

  return {
    backend: "local",
    root,
    async put(key, bytes) {
      const safeKey = assertSafeKey(key);
      const absolute = resolve(root, safeKey);
      if (!absolute.startsWith(root + sep) && absolute !== root) {
        throw new Error("INVALID_STORAGE_KEY");
      }
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, bytes);
      return {};
    },
    async get(key) {
      const safeKey = assertSafeKey(key);
      const absolute = resolve(root, safeKey);
      if (!absolute.startsWith(root + sep) && absolute !== root) {
        return null;
      }
      if (!existsSync(absolute)) return null;
      return readFileSync(absolute);
    },
  };
}
