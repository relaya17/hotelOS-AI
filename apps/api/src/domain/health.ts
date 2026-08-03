import type { ObjectStorageBackend } from "../infrastructure/object-storage.js";

export type HealthStatus = {
  readonly status: "ok";
  readonly service: "api";
  readonly version: string;
  readonly recordings: {
    readonly backend: ObjectStorageBackend;
    readonly root: string;
  };
};

export function createHealthStatus(
  version: string,
  recordings: HealthStatus["recordings"],
): HealthStatus {
  return {
    status: "ok",
    service: "api",
    version,
    recordings,
  };
}
