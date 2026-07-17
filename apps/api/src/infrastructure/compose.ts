import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, parseCorsOrigins } from "@hotelos/config";
import { createLogger } from "@hotelos/logger";
import { createJwtTokenService, hashPassword } from "@hotelos/auth";
import {
  createAgentRepository,
  createAuditRepository,
  createBookingRepository,
  createBriefingRepository,
  createDb,
  createFeedbackRepository,
  createGuestStayRepository,
  createHotelRepository,
  createKashrutRepository,
  createMaintenanceRepository,
  createOpsRepository,
  createOrgCommsRepository,
  createOverviewRepository,
  createProcurementRepository,
  createRecruitingRepository,
  createRefreshSessionRepository,
  createRoomRepository,
  createTrustedSourcesRepository,
  createTrustRepository,
  createTurboRepository,
  createUserRepository,
  seedDemoTenant,
} from "@hotelos/database";
import { createGetHealth } from "../application/get-health.js";
import { createApp } from "../presentation/http/create-app.js";
import { createRecordingStorage } from "./recording-storage.js";

const API_VERSION = "0.8.0";

function resolveRepoPath(relativePath: string): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  return resolve(repoRoot, relativePath);
}

export async function composeApp() {
  const env = loadEnv();
  const logger = createLogger({ service: "api" }, env.LOG_LEVEL);
  const dbUrl = env.DATABASE_URL.startsWith("file:")
    ? `file:${resolveRepoPath(env.DATABASE_URL.slice("file:".length))}`
    : env.DATABASE_URL;
  const { db } = await createDb({
    url: dbUrl,
    ...(env.DATABASE_AUTH_TOKEN
      ? { authToken: env.DATABASE_AUTH_TOKEN }
      : {}),
  });
  await seedDemoTenant(db, hashPassword);

  const users = createUserRepository(db);
  const sessions = createRefreshSessionRepository(db);
  const audit = createAuditRepository(db);
  const hotels = createHotelRepository(db);
  const rooms = createRoomRepository(db);
  const bookings = createBookingRepository(db);
  const overview = createOverviewRepository(db);
  const guestStays = createGuestStayRepository(db);
  const agents = createAgentRepository(db);
  const briefing = createBriefingRepository(db);
  const turbo = createTurboRepository(db);
  const trust = createTrustRepository(db);
  const ops = createOpsRepository(db);
  const maintenance = createMaintenanceRepository(db);
  const procurement = createProcurementRepository(db);
  const feedback = createFeedbackRepository(db);
  const recruiting = createRecruitingRepository(db);
  const orgComms = createOrgCommsRepository(db);
  const trustedSources = createTrustedSourcesRepository(db);
  const kashrut = createKashrutRepository(db);
  const recordings = createRecordingStorage(
    resolveRepoPath(env.RECORDINGS_PATH),
  );
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
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    isProduction: env.NODE_ENV === "production",
    auth: { users, sessions, audit, tokens },
    hotels: { hotels, rooms, bookings, audit, tokens },
    overview: { overview, tokens },
    publicRoutes: { guestStays, feedback },
    agents: { agents, tokens },
    briefing: {
      audit,
      briefing,
      agents,
      overview,
      users,
      tokens,
      recordings,
    },
    turbo: { audit, turbo, users, tokens },
    trust: {
      trust,
      users,
      sessions,
      audit,
      tokens,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      googleRedirectUri: env.GOOGLE_REDIRECT_URI,
      googlePostLoginRedirect: env.GOOGLE_POST_LOGIN_REDIRECT,
      webauthnRpId: env.WEBAUTHN_RP_ID,
      webauthnRpName: env.WEBAUTHN_RP_NAME,
    },
    ops: {
      audit,
      ops,
      maintenance,
      procurement,
      feedback,
      recruiting,
      hotels,
      overview,
      kashrut,
      turbo,
      tokens,
    },
    orgComms: { orgComms, tokens },
    knowledge: { trustedSources, tokens },
    kashrut: { kashrut, hotels, tokens },
  });

  logger.info("database ready", { url: dbUrl });
  logger.info("recordings storage ready", { path: recordings.root });
  return { app, env, logger };
}
