import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";
import { get, put } from "@vercel/blob";

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

/** Injectable for unit tests (mock Vercel Blob without network). */
export type BlobObjectClient = {
  put: (
    pathname: string,
    bytes: Buffer,
    contentType: string,
  ) => Promise<{ readonly url?: string }>;
  get: (pathname: string) => Promise<Buffer | null>;
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

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function createVercelBlobClient(token: string): BlobObjectClient {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new Error("BLOB_TOKEN_REQUIRED");
  }

  return {
    async put(pathname, bytes, contentType) {
      const result = await put(pathname, bytes, {
        access: "private",
        token: trimmed,
        contentType,
        allowOverwrite: true,
      });
      return { ...(result.url !== undefined ? { url: result.url } : {}) };
    },
    async get(pathname) {
      const result = await get(pathname, {
        access: "private",
        token: trimmed,
      });
      if (!result || !result.stream) return null;
      return streamToBuffer(result.stream);
    },
  };
}

export function createObjectStorage(input: {
  readonly root: string;
  readonly blobToken?: string;
  readonly blobClient?: BlobObjectClient;
}): ObjectStorage {
  const root = resolve(input.root);
  const blobToken = input.blobToken?.trim() ?? "";
  const blobClient =
    input.blobClient ??
    (blobToken.length > 0 ? createVercelBlobClient(blobToken) : null);

  if (blobClient) {
    return {
      backend: "vercel_blob",
      root,
      async put(key, bytes, contentType = "application/octet-stream") {
        const safeKey = assertSafeKey(key);
        return blobClient.put(safeKey, bytes, contentType);
      },
      async get(key) {
        const safeKey = assertSafeKey(key);
        return blobClient.get(safeKey);
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
