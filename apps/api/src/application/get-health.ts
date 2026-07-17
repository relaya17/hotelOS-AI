import { createHealthStatus, type HealthStatus } from "../domain/health.js";

export type GetHealth = () => HealthStatus;

export function createGetHealth(version: string): GetHealth {
  return () => createHealthStatus(version);
}
