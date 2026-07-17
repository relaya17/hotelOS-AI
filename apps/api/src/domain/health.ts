export type HealthStatus = {
  readonly status: "ok";
  readonly service: "api";
  readonly version: string;
};

export function createHealthStatus(version: string): HealthStatus {
  return {
    status: "ok",
    service: "api",
    version,
  };
}
