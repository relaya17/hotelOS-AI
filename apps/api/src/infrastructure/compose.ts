import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnv,
  parseCorsOrigins,
  withVercelCorsFallback,
} from "@hotelos/config";
import { createLogger } from "@hotelos/logger";
import { createJwtTokenService, hashPassword } from "@hotelos/auth";
import { createAiGateway } from "@hotelos/ai-gateway";
import { createPmsConnector } from "@hotelos/connectors";
import { Ids } from "@hotelos/shared";
import {
  AGENT_CATALOG,
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
  createHrRepository,
  createCorrespondenceRepository,
  createApprovalRepository,
  createAssessmentRepository,
  createCompanyKnowledgeRepository,
  seedDemoTenant,
} from "@hotelos/database";
import { createGetHealth } from "../application/get-health.js";
import { createApp } from "../presentation/http/create-app.js";
import { initObservability } from "./observability.js";
import { createRecordingStorage } from "./recording-storage.js";

const API_VERSION = "0.9.0";

function resolveRepoPath(relativePath: string): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  return resolve(repoRoot, relativePath);
}

export async function composeApp() {
  const env = loadEnv();
  const logger = createLogger({ service: "api" }, env.LOG_LEVEL);
  await initObservability(env, logger);
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
  const hr = createHrRepository(db);
  const assessments = createAssessmentRepository(db);
  const companyKnowledge = createCompanyKnowledgeRepository(db);
  const correspondence = createCorrespondenceRepository(db);
  const approvals = createApprovalRepository(db);
  const recordings = createRecordingStorage(
    resolveRepoPath(env.RECORDINGS_PATH),
    {
      ...(env.BLOB_READ_WRITE_TOKEN.trim().length > 0
        ? { blobToken: env.BLOB_READ_WRITE_TOKEN.trim() }
        : {}),
    },
  );
  const tokens = createJwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  });

  const gateway = createAiGateway({
    agents: AGENT_CATALOG.map((entry) => ({
      id: entry.id,
      nameHe: entry.nameHe,
      domain: entry.domain,
      autonomyMode: entry.autonomyMode,
    })),
    ...(env.AI_GATEWAY_API_KEY.trim().length > 0
      ? {
          openai: {
            apiKey: env.AI_GATEWAY_API_KEY.trim(),
            baseUrl: env.AI_GATEWAY_BASE_URL,
            model: env.AI_GATEWAY_MODEL,
            embedModel: env.AI_GATEWAY_EMBED_MODEL,
          },
        }
      : {}),
    onAudit: async (event) => {
      await audit.append({
        id: randomUUID(),
        tenantId: Ids.tenant(event.tenantId),
        actorUserId: Ids.user(event.userId),
        action: event.action,
        resourceType: "ai_gateway",
        resourceId: event.agentId,
        metadata: {
          provider: event.provider,
          ok: event.ok,
          detail: event.detail,
        },
        createdAt: new Date().toISOString(),
      });
    },
  });

  const getHealth = createGetHealth(API_VERSION);
  const app = createApp({
    getHealth,
    logger,
    corsOrigins: withVercelCorsFallback(
      parseCorsOrigins(env.CORS_ORIGINS),
      env.NODE_ENV === "production",
    ),
    isProduction: env.NODE_ENV === "production",
    auth: { users, sessions, audit, tokens },
    hotels: { hotels, rooms, bookings, audit, tokens },
    overview: { overview, tokens },
    publicRoutes: { guestStays, feedback, hr },
    agents: { agents, tokens },
    briefing: {
      audit,
      briefing,
      agents,
      overview,
      users,
      tokens,
      recordings,
      gateway,
      approvals,
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
      gateway,
      companyKnowledge,
      trustedSources,
      tokens,
    },
    orgComms: { orgComms, tokens },
    knowledge: { trustedSources, companyKnowledge, gateway, tokens },
    kashrut: { kashrut, hotels, tokens },
    aiGateway: {
      gateway,
      overview,
      companyKnowledge,
      trustedSources,
      tokens,
    },
    hr: { hr, assessments, audit, tokens },
    correspondence: {
      correspondence,
      companyKnowledge,
      trustedSources,
      gateway,
      audit,
      tokens,
    },
    approvals: {
      approvals,
      audit,
      ops,
      procurement,
      maintenance,
      recruiting,
      hotels,
      kashrut,
      tokens,
    },
    autonomy: {
      approvals,
      audit,
      ops,
      procurement,
      maintenance,
      rooms,
      bookings,
      recruiting,
      feedback,
      tokens,
    },
    twin: { rooms, tokens, pms: createPmsConnector(env.PMS_PROVIDER) },
    cron: {
      cronSecret: env.CRON_SECRET,
      cioDaily: {
        overview,
        ops,
        maintenance,
        procurement,
        feedback,
        kashrut,
        hotels,
        turbo,
        orgComms,
        gateway,
        companyKnowledge,
        trustedSources,
      },
    },
    simulator: {
      overview,
      approvals,
      audit,
      gateway,
      tokens,
    },
  });

  logger.info("database ready", { url: dbUrl });
  logger.info("recordings storage ready", {
    path: recordings.root,
    backend: recordings.backend,
  });
  logger.info("ai gateway ready", { provider: gateway.primaryProvider });
  logger.info("pms connector ready", { provider: env.PMS_PROVIDER });
  return { app, env, logger };
}
