import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";

/**
 * Tenant-isolated recording layout:
 * {root}/{tenantId}/{chainId}/{roomId}/{recordingId}.ext
 */
export type RecordingStorage = {
  readonly root: string;
  buildStorageKey: (input: {
    readonly tenantId: string;
    readonly chainId: string;
    readonly roomId: string;
    readonly recordingId: string;
    readonly extension: string;
  }) => string;
  absolutePathForKey: (storageKey: string) => string | null;
  write: (storageKey: string, bytes: Buffer) => void;
  read: (storageKey: string) => Buffer | null;
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

export function createRecordingStorage(rootRelativeOrAbsolute: string): RecordingStorage {
  const root = resolve(rootRelativeOrAbsolute);

  return {
    root,

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
      const normalized = normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
      const absolute = resolve(root, normalized);
      if (!absolute.startsWith(root + sep) && absolute !== root) {
        return null;
      }
      return absolute;
    },

    write(storageKey, bytes) {
      const absolute = this.absolutePathForKey(storageKey);
      if (!absolute) {
        throw new Error("INVALID_STORAGE_KEY");
      }
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, bytes);
    },

    read(storageKey) {
      const absolute = this.absolutePathForKey(storageKey);
      if (!absolute || !existsSync(absolute)) {
        return null;
      }
      return readFileSync(absolute);
    },
  };
}

export function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}
