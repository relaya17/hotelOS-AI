import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "@hotelos/config";
import { createLogger } from "@hotelos/logger";
import { createJwtTokenService, hashPassword } from "@hotelos/auth";
import {
  createAuditRepository,
  createDb,
  createHotelRepository,
  createRefreshSessionRepository,
  createUserRepository,
  seedDemoTenant,
} from "@hotelos/database";
import { createGetHealth } from "../application/get-health.js";
import { createApp } from "../presentation/http/create-app.js";

const API_VERSION = "0.2.0";

function resolveRepoPath(relativePath: string): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  return resolve(repoRoot, relativePath);
}

export async function composeApp() {
  const env = loadEnv();
  const logger = createLogger({ service: "api" }, env.LOG_LEVEL);
  const dbPath = resolveRepoPath(env.DATABASE_PATH);
  const { db } = createDb(dbPath);
  await seedDemoTenant(db, hashPassword);

  const users = createUserRepository(db);
  const sessions = createRefreshSessionRepository(db);
  const audit = createAuditRepository(db);
  const hotels = createHotelRepository(db);
  const tokens = createJwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  });

  const getHealth = createGetHealth(API_VERSION);
  const app = createApp({
    getHealth,
    logger,
    corsOrigin: env.CORS_ORIGIN,
    auth: { users, sessions, audit, tokens },
    hotels: { hotels, tokens },
  });

  logger.info("database ready", { path: dbPath });
  return { app, env, logger };
}
