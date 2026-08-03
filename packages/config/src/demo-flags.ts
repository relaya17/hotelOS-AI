type DemoFlagEnv = {
  readonly NODE_ENV: "development" | "test" | "production";
  readonly ALLOW_DEMO_AUTH?: string;
  readonly ALLOW_DEMO_SEED?: string;
};

/**
 * Demo-only features (seeded admin, Google demo login) are on by default in
 * development/test, and off in production unless explicitly opted in.
 */
export function isDemoAuthEnabled(env: DemoFlagEnv): boolean {
  if (env.ALLOW_DEMO_AUTH === "true") return true;
  if (env.ALLOW_DEMO_AUTH === "false") return false;
  return env.NODE_ENV !== "production";
}

export function isDemoSeedEnabled(env: DemoFlagEnv): boolean {
  if (env.ALLOW_DEMO_SEED === "true") return true;
  if (env.ALLOW_DEMO_SEED === "false") return false;
  return env.NODE_ENV !== "production";
}
