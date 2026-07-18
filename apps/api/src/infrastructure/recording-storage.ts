import { normalize, resolve, sep } from "node:path";
import {
  createObjectStorage,
  type ObjectStorage,
  type ObjectStorageBackend,
} from "./object-storage.js";

/**
 * Tenant-isolated recording layout:
 * {root}/{tenantId}/{chainId}/{roomId}/{recordingId}.ext
 *
 * Backed by ObjectStorage (local disk or Vercel Blob when token is set).
 */
export type RecordingStorage = {
  readonly root: string;
  readonly backend: ObjectStorageBackend;
  buildStorageKey: (input: {
    readonly tenantId: string;
    readonly chainId: string;
    readonly roomId: string;
    readonly recordingId: string;
    readonly extension: string;
  }) => string;
  absolutePathForKey: (storageKey: string) => string | null;
  write: (storageKey: string, bytes: Buffer) => Promise<void>;
  read: (storageKey: string) => Promise<Buffer | null>;
};

function assertSafeSegment(value: string, label: string): void {
  if (
    value.length === 0 ||
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new Error(`INVALID_${label}`);
  }
}

export function createRecordingStorage(
  rootRelativeOrAbsolute: string,
  options?: { readonly blobToken?: string },
): RecordingStorage {
  const root = resolve(rootRelativeOrAbsolute);
  const objects: ObjectStorage = createObjectStorage({
    root,
    ...(options?.blobToken !== undefined
      ? { blobToken: options.blobToken }
      : {}),
  });

  return {
    root,
    backend: objects.backend,

    buildStorageKey(input) {
      assertSafeSegment(input.tenantId, "TENANT_ID");
      assertSafeSegment(input.chainId, "CHAIN_ID");
      assertSafeSegment(input.roomId, "ROOM_ID");
      assertSafeSegment(input.recordingId, "RECORDING_ID");
      const ext = input.extension.replace(/^\./, "").toLowerCase() || "webm";
      if (!/^[a-z0-9]+$/.test(ext)) {
        throw new Error("INVALID_EXTENSION");
      }
      return [
        input.tenantId,
        input.chainId,
        input.roomId,
        `${input.recordingId}.${ext}`,
      ].join("/");
    },

    absolutePathForKey(storageKey) {
      if (objects.backend !== "local") return null;
      const normalized = normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
      const absolute = resolve(root, normalized);
      if (!absolute.startsWith(root + sep) && absolute !== root) {
        return null;
      }
      return absolute;
    },

    async write(storageKey, bytes) {
      await objects.put(storageKey, bytes, "application/octet-stream");
    },

    async read(storageKey) {
      return objects.get(storageKey);
    },
  };
}

export function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}
