import { createHealthStatus, type HealthStatus } from "../domain/health.js";
import type { ObjectStorageBackend } from "../infrastructure/object-storage.js";

export type GetHealth = () => HealthStatus;

export function createGetHealth(
  version: string,
  recordings: { readonly backend: ObjectStorageBackend; readonly root: string },
): GetHealth {
  return () => createHealthStatus(version, recordings);
}
