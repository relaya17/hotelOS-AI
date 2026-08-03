import { Hono } from "hono";
import { runCioDailyDigest, type RunCioDailyDigestDeps } from "../../application/run-cio-daily-digest.js";
import {
  runCfoDailyBrief,
  type RunCfoDailyBriefDeps,
} from "../../application/run-cfo-daily-brief.js";
import {
  runAnomalyScan,
  type RunAnomalyScanDeps,
} from "../../application/run-anomaly-scan.js";
import {
  drainNotificationOutbox,
  type DrainNotificationOutboxDeps,
} from "../../application/drain-notification-outbox.js";
import { mapUnknownError, sendError } from "./errors.js";

export type CronRouteDeps = {
  readonly cronSecret: string;
  readonly cioDaily: RunCioDailyDigestDeps;
  readonly cfoDaily: RunCfoDailyBriefDeps;
  readonly anomalyScan: RunAnomalyScanDeps;
  readonly notificationOutbox: DrainNotificationOutboxDeps;
};

function authorizeCron(c: { req: { header: (name: string) => string | undefined } }, secret: string): boolean {
  if (secret.trim().length === 0) return false;
  const auth = c.req.header("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerSecret = c.req.header("x-cron-secret") ?? "";
  return bearer === secret || headerSecret === secret;
}

/**
 * Vercel Cron / external scheduler entrypoints.
 * Auth: `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`).
 * Disabled when CRON_SECRET is empty.
 */
export function createCronRoutes(deps: CronRouteDeps): Hono {
  const routes = new Hono();

  const runCioDaily = async (c: Parameters<typeof sendError>[0]) => {
    if (deps.cronSecret.trim().length === 0) {
      return sendError(
        c,
        503,
        "CRON_DISABLED",
        "Set CRON_SECRET to enable scheduled jobs",
      );
    }
    if (!authorizeCron(c, deps.cronSecret)) {
      return sendError(c, 401, "UNAUTHORIZED", "Invalid cron secret");
    }

    try {
      const result = await runCioDailyDigest(deps.cioDaily);
      if (!result) {
        return sendError(
          c,
          404,
          "DIGEST_UNAVAILABLE",
          "No tenant/hotels available for digest",
        );
      }
      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  };

  // Vercel Cron uses GET + Authorization: Bearer $CRON_SECRET
  routes.get("/cio-daily", (c) => runCioDaily(c));
  routes.post("/cio-daily", (c) => runCioDaily(c));

  const runCfoDaily = async (c: Parameters<typeof sendError>[0]) => {
    if (deps.cronSecret.trim().length === 0) {
      return sendError(
        c,
        503,
        "CRON_DISABLED",
        "Set CRON_SECRET to enable scheduled jobs",
      );
    }
    if (!authorizeCron(c, deps.cronSecret)) {
      return sendError(c, 401, "UNAUTHORIZED", "Invalid cron secret");
    }

    try {
      const result = await runCfoDailyBrief(deps.cfoDaily);
      if (!result) {
        return sendError(
          c,
          404,
          "CFO_BRIEF_UNAVAILABLE",
          "No tenant/hotels available for finance brief",
        );
      }
      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  };

  routes.get("/cfo-daily", (c) => runCfoDaily(c));
  routes.post("/cfo-daily", (c) => runCfoDaily(c));

  const runAnomalies = async (c: Parameters<typeof sendError>[0]) => {
    if (deps.cronSecret.trim().length === 0) {
      return sendError(
        c,
        503,
        "CRON_DISABLED",
        "Set CRON_SECRET to enable scheduled jobs",
      );
    }
    if (!authorizeCron(c, deps.cronSecret)) {
      return sendError(c, 401, "UNAUTHORIZED", "Invalid cron secret");
    }

    try {
      const result = await runAnomalyScan(deps.anomalyScan);
      if (!result) {
        return sendError(
          c,
          404,
          "ANOMALY_SCAN_UNAVAILABLE",
          "No tenant/hotels available for anomaly scan",
        );
      }
      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  };

  routes.get("/anomaly-scan", (c) => runAnomalies(c));
  routes.post("/anomaly-scan", (c) => runAnomalies(c));

  const runNotificationOutbox = async (
    c: Parameters<typeof sendError>[0],
  ) => {
    if (deps.cronSecret.trim().length === 0) {
      return sendError(
        c,
        503,
        "CRON_DISABLED",
        "Set CRON_SECRET to enable scheduled jobs",
      );
    }
    if (!authorizeCron(c, deps.cronSecret)) {
      return sendError(c, 401, "UNAUTHORIZED", "Invalid cron secret");
    }

    try {
      const result = await drainNotificationOutbox(deps.notificationOutbox);
      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  };

  routes.get("/notification-outbox", (c) => runNotificationOutbox(c));
  routes.post("/notification-outbox", (c) => runNotificationOutbox(c));

  return routes;
}
